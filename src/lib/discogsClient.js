import { abortError, isAbortError, sleep, TimeoutError } from "./async.js";

// Empirically verified Discogs behavior (Oct 2026):
// - 25 requests/min unauthenticated (per source IP), 60/min authenticated.
// - X-Discogs-Ratelimit-* headers are NOT exposed via CORS, so browser JS
//   cannot read them.
// - 429 responses omit Access-Control-Allow-Origin, so a browser fetch rejects
//   with a TypeError instead of exposing a 429 status.
// - No Retry-After header is sent.
// - Requests made while rate-limited still increment the counter, so retrying
//   during the block only extends it.
// - The Authorization header triggers a CORS preflight, and preflights consume
//   the authenticated quota too. Sending the token as ?token= keeps the request
//   a simple GET (no preflight), roughly halving quota usage. Trade-off: the
//   token is visible in the browser network panel and Discogs' logs.
//
// We therefore pace proactively below the limit, serialize every request, and
// pause the whole queue for a full window when a rate limit is likely.

export const UNAUTH_INTERVAL_MS = 3000; // 20/min, headroom under 25/min
export const AUTH_INTERVAL_MS = 1200; // 50/min, headroom under 60/min

const WINDOW_MS = 60000;
const BASE_RATE_LIMIT_WAIT_MS = 60000;
const MAX_RATE_LIMIT_WAIT_MS = 300000;
const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_RETRY_DELAY_MS = 3000;

export class RateLimitError extends Error {
  constructor(waitSecs, message = "Discogs rate limit hit") {
    super(message);
    this.name = "RateLimitError";
    this.waitSecs = waitSecs;
  }
}

export class DiscogsNetworkError extends Error {
  constructor(message, { retryable = false } = {}) {
    super(message);
    this.name = "DiscogsNetworkError";
    this.retryable = retryable;
  }
}

export class OfflineError extends DiscogsNetworkError {
  constructor() {
    super("You appear to be offline. Check your connection and try again.");
    this.name = "OfflineError";
  }
}

let token = "";
let intervalMs = UNAUTH_INTERVAL_MS;
let perMinute = 20;
let requestTimeoutMs = DEFAULT_TIMEOUT_MS;
let retryDelayMs = DEFAULT_RETRY_DELAY_MS;
let timestamps = [];
let pausedUntil = 0;
let rateLimitStreak = 0;
let queue = Promise.resolve();

export function configureDiscogs(options = {}) {
  if (Object.prototype.hasOwnProperty.call(options, "token")) {
    const nextToken = String(options.token || "").trim();
    if (nextToken !== token) {
      // A new token has its own quota window; don't carry over the previous
      // token's pause or request timestamps.
      token = nextToken;
      timestamps = [];
      pausedUntil = 0;
      rateLimitStreak = 0;
    }
  }
  intervalMs = options.intervalMs ?? (token ? AUTH_INTERVAL_MS : UNAUTH_INTERVAL_MS);
  perMinute = options.perMinute ?? (token ? 50 : 20);
  requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
}

export function getDiscogsIntervalMs() {
  return intervalMs;
}

export function getDiscogsStatus(now = Date.now()) {
  const recent = timestamps.filter((time) => now - time < WINDOW_MS);
  return {
    authenticated: Boolean(token),
    intervalMs,
    perMinute,
    requestsInWindow: recent.length,
    pausedMs: Math.max(0, pausedUntil - now),
  };
}

export function resetDiscogsClient() {
  token = "";
  intervalMs = UNAUTH_INTERVAL_MS;
  perMinute = 20;
  requestTimeoutMs = DEFAULT_TIMEOUT_MS;
  retryDelayMs = DEFAULT_RETRY_DELAY_MS;
  timestamps = [];
  pausedUntil = 0;
  rateLimitStreak = 0;
  queue = Promise.resolve();
}

function prune(now = Date.now()) {
  timestamps = timestamps.filter((time) => now - time < WINDOW_MS);
  return timestamps.length;
}

function nextWaitMs(now = Date.now()) {
  prune(now);

  const pauseWait = Math.max(0, pausedUntil - now);
  const lastRequest = timestamps.length ? timestamps[timestamps.length - 1] : 0;
  const spacingWait = Math.max(0, lastRequest + intervalMs - now);

  let windowWait = 0;
  if (timestamps.length >= perMinute) {
    // Keep the rolling 60s count below the server limit.
    windowWait = Math.max(0, timestamps[0] + WINDOW_MS + 500 - now);
  }

  return Math.max(pauseWait, spacingWait, windowWait);
}

async function waitForSlot(signal, onWait) {
  while (true) {
    if (signal?.aborted) throw abortError();
    const now = Date.now();
    const wait = nextWaitMs(now);
    if (wait <= 0) return;

    const reason = pausedUntil > now ? "rate-limit" : "pace";
    onWait?.(wait, reason);

    // Sleep in short slices so callers can show a live countdown.
    await sleep(Math.min(wait, 1000), signal);
  }
}

function markRateLimit(now, retryAfterSecs) {
  rateLimitStreak = Math.min(rateLimitStreak + 1, 6);
  const base = Math.max(
    Number.isFinite(retryAfterSecs) ? retryAfterSecs * 1000 : BASE_RATE_LIMIT_WAIT_MS,
    BASE_RATE_LIMIT_WAIT_MS
  );
  const wait = Math.min(
    base * 2 ** (rateLimitStreak - 1),
    MAX_RATE_LIMIT_WAIT_MS
  ) + 2000;
  pausedUntil = Math.max(pausedUntil, now + wait);
  return Math.ceil(wait / 1000);
}

function requestHeaders() {
  return { Accept: "application/json" };
}

function withToken(url) {
  if (!token) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}token=${encodeURIComponent(token)}`;
}

async function doFetch(url, { signal, onWait, parseResponse } = {}) {
  let lowUsageFailures = 0;

  while (true) {
    if (signal?.aborted) throw abortError();

    await waitForSlot(signal, onWait);

    const now = Date.now();
    const recent = prune(now);
    timestamps.push(now);

    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, requestTimeoutMs);
    const onAbort = () => controller.abort();

    if (signal) {
      if (signal.aborted) {
        clearTimeout(timeout);
        throw abortError();
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }

    try {
      let res;
      try {
        res = await fetch(withToken(url), { signal: controller.signal, headers: requestHeaders() });
      } catch (err) {
        if (signal?.aborted) throw abortError();
        if (isAbortError(err) && timedOut) {
          throw new TimeoutError("Discogs request timed out.");
        }
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          throw new OfflineError();
        }

        // A browser cannot read a 429 here (Discogs omits CORS headers on 429),
        // so a network-level failure after heavy usage is treated as a rate limit.
        const highUsage = recent >= (token ? 40 : 15);
        if (highUsage) {
          throw new RateLimitError(markRateLimit(Date.now()));
        }

        lowUsageFailures++;
        if (lowUsageFailures <= 1) {
          await sleep(retryDelayMs, signal);
          continue;
        }

        throw new DiscogsNetworkError(
          token
            ? "Could not reach Discogs. Check that the token is valid, or wait a minute if this account is already rate-limited."
            : "Could not reach Discogs. This can mean the collection is private, this IP is rate-limited, or the network is down. Wait a minute and try again, or use a CSV export."
        );
      }

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get("Retry-After") || "", 10);
        throw new RateLimitError(
          markRateLimit(Date.now(), Number.isFinite(retryAfter) ? retryAfter : undefined)
        );
      }

      // A real response means the connection/limit is healthy again.
      rateLimitStreak = 0;
      if (!parseResponse) return res;

      try {
        return await parseResponse(res);
      } catch (err) {
        if (signal?.aborted) throw abortError();
        if (isAbortError(err) && timedOut) {
          throw new TimeoutError("Discogs request timed out.");
        }
        throw err;
      }
    } finally {
      clearTimeout(timeout);
      if (signal) signal.removeEventListener("abort", onAbort);
    }
  }
}

// Serialize every Discogs request through one queue so collection and
// tracklist fetching can never race past the rate limit together.
export function discogsFetch(url, options = {}) {
  const run = () => doFetch(url, options);
  const result = queue.then(run, run);
  queue = result.then(() => undefined, () => undefined);

  const { signal } = options;
  if (!signal) return result;
  if (signal.aborted) return Promise.reject(abortError());

  // Reject callers immediately even if this request is still behind the queue.
  // The queued run remains in place and will see the aborted signal without fetching.
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort);
      reject(abortError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
    result.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (err) => {
        signal.removeEventListener("abort", onAbort);
        reject(err);
      }
    );
  });
}
