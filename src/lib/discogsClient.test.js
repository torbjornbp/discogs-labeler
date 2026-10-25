import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Avoid real pacing waits in tests.
vi.mock("./async.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, sleep: vi.fn(() => Promise.resolve()) };
});

import { TimeoutError } from "./async.js";
import {
  DiscogsNetworkError,
  RateLimitError,
  configureDiscogs,
  discogsFetch,
  getDiscogsIntervalMs,
  getDiscogsStatus,
  resetDiscogsClient,
} from "./discogsClient.js";

const response = (status = 200, headers = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: { get: (name) => headers[name] ?? null },
  json: async () => ({}),
});

beforeEach(() => {
  resetDiscogsClient();
  configureDiscogs({
    token: "",
    intervalMs: 0,
    perMinute: 1000,
    retryDelayMs: 0,
    requestTimeoutMs: 20,
  });
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  resetDiscogsClient();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("configureDiscogs", () => {
  it("uses conservative pacing with and without a token", () => {
    configureDiscogs({ token: "" });
    expect(getDiscogsIntervalMs()).toBe(3000);

    configureDiscogs({ token: "abc" });
    expect(getDiscogsIntervalMs()).toBe(1200);
    expect(getDiscogsStatus().perMinute).toBe(50);
  });

  it("clears the previous token's pause when the token changes", async () => {
    fetch.mockResolvedValue(response(429, { "Retry-After": "5" }));
    await discogsFetch("https://api.discogs.com/releases/1").catch(() => {});
    expect(getDiscogsStatus().pausedMs).toBeGreaterThan(0);

    configureDiscogs({ token: "different-token" });

    expect(getDiscogsStatus().pausedMs).toBe(0);
    expect(getDiscogsStatus().requestsInWindow).toBe(0);
  });
});

describe("discogsFetch", () => {
  it("adds the token as a query parameter instead of an Authorization header", async () => {
    configureDiscogs({ token: "secret", intervalMs: 0, perMinute: 1000 });
    fetch.mockResolvedValue(response(200));

    await discogsFetch("https://api.discogs.com/releases/1");

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe("https://api.discogs.com/releases/1?token=secret");
    expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it("trims whitespace from a pasted token", async () => {
    configureDiscogs({ token: "  secret\n", intervalMs: 0, perMinute: 1000 });
    fetch.mockResolvedValue(response(200));

    await discogsFetch("https://api.discogs.com/releases/1");

    expect(fetch.mock.calls[0][0]).toBe("https://api.discogs.com/releases/1?token=secret");
  });

  it("appends the token correctly to URLs that already have a query string", async () => {
    configureDiscogs({ token: "secret", intervalMs: 0, perMinute: 1000 });
    fetch.mockResolvedValue(response(200));

    await discogsFetch("https://api.discogs.com/users/me/collection?page=2");

    expect(fetch.mock.calls[0][0]).toBe(
      "https://api.discogs.com/users/me/collection?page=2&token=secret"
    );
  });

  it("does not send a token without one configured", async () => {
    fetch.mockResolvedValue(response(200));

    await discogsFetch("https://api.discogs.com/releases/1");

    expect(fetch.mock.calls[0][0]).toBe("https://api.discogs.com/releases/1");
    expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it("throws a 60s+ RateLimitError for an explicit 429", async () => {
    fetch.mockResolvedValue(response(429, { "Retry-After": "5" }));

    const error = await discogsFetch("https://api.discogs.com/releases/1").catch((e) => e);

    expect(error).toBeInstanceOf(RateLimitError);
    expect(error.waitSecs).toBeGreaterThanOrEqual(60);
    expect(getDiscogsStatus().pausedMs).toBeGreaterThan(0);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("treats a network failure after heavy usage as a rate limit", async () => {
    fetch.mockResolvedValue(response(200));
    for (let i = 0; i < 16; i++) {
      await discogsFetch(`https://api.discogs.com/releases/${i}`);
    }

    expect(getDiscogsStatus().requestsInWindow).toBe(16);
    fetch.mockRejectedValue(new TypeError("Failed to fetch"));

    const error = await discogsFetch("https://api.discogs.com/releases/100").catch((e) => e);

    // Browsers cannot read Discogs' 429 response (CORS headers are omitted),
    // so a high-usage network failure is the observable form of a 429.
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error.waitSecs).toBeGreaterThanOrEqual(60);
  });

  it("retries a low-usage network failure once, then fails fast", async () => {
    fetch.mockRejectedValue(new TypeError("Failed to fetch"));

    const error = await discogsFetch("https://api.discogs.com/releases/1").catch((e) => e);

    expect(error).toBeInstanceOf(DiscogsNetworkError);
    expect(error.message).toMatch(/Could not reach Discogs/);
    expect(error.retryable).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("mentions the token when an authenticated request cannot reach Discogs", async () => {
    configureDiscogs({ token: "bad", intervalMs: 0, perMinute: 1000, retryDelayMs: 0 });
    fetch.mockRejectedValue(new TypeError("Failed to fetch"));

    const error = await discogsFetch("https://api.discogs.com/releases/1").catch((e) => e);

    expect(error).toBeInstanceOf(DiscogsNetworkError);
    expect(error.message).toMatch(/token is valid/);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("propagates an abort without calling fetch", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      discogsFetch("https://api.discogs.com/releases/1", { signal: controller.signal })
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects an aborted request promptly while it is still queued", async () => {
    let markFirstStarted;
    const firstStarted = new Promise((resolve) => {
      markFirstStarted = resolve;
    });
    let finishFirst;
    fetch.mockImplementationOnce(() => {
      markFirstStarted();
      return new Promise((resolve) => {
        finishFirst = () => resolve(response(200));
      });
    });

    const first = discogsFetch("https://api.discogs.com/releases/1");
    await firstStarted;

    const controller = new AbortController();
    const second = discogsFetch("https://api.discogs.com/releases/2", {
      signal: controller.signal,
    });
    controller.abort();

    const outcome = await Promise.race([
      second.catch((err) => err),
      new Promise((resolve) => setTimeout(() => resolve("pending"), 0)),
    ]);

    // Let the predecessor and the internal queue finish even if the promptness
    // assertion fails, so this test never leaves a request behind.
    finishFirst();
    await first;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(outcome).toMatchObject({ name: "AbortError" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("serializes concurrent requests through one queue", async () => {
    let active = 0;
    let maxActive = 0;
    fetch.mockImplementation(async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return response(200);
    });

    await Promise.all([
      discogsFetch("https://api.discogs.com/releases/1"),
      discogsFetch("https://api.discogs.com/releases/2"),
    ]);

    expect(maxActive).toBe(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("turns its own timeout into a TimeoutError", async () => {
    fetch.mockImplementation((url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => {
        const error = new Error("Aborted");
        error.name = "AbortError";
        reject(error);
      });
    }));

    const error = await discogsFetch("https://api.discogs.com/releases/1").catch((e) => e);

    expect(error).toBeInstanceOf(TimeoutError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("times out when response-body parsing stalls after headers", async () => {
    fetch.mockImplementation((url, { signal }) => Promise.resolve({
      ...response(),
      json: () => new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => {
          const error = new Error("Aborted");
          error.name = "AbortError";
          reject(error);
        }, { once: true });
      }),
    }));

    const error = await discogsFetch("https://api.discogs.com/releases/1", {
      parseResponse: (res) => res.json(),
    }).catch((e) => e);

    expect(error).toBeInstanceOf(TimeoutError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("honors a caller abort while parsing the response body", async () => {
    const controller = new AbortController();
    let markBodyStarted;
    const bodyStarted = new Promise((resolve) => {
      markBodyStarted = resolve;
    });
    fetch.mockImplementation((url, { signal }) => Promise.resolve({
      ...response(),
      json: () => {
        markBodyStarted();
        return new Promise((resolve, reject) => {
          signal.addEventListener("abort", () => {
            const error = new Error("Aborted");
            error.name = "AbortError";
            reject(error);
          }, { once: true });
        });
      },
    }));

    const promise = discogsFetch("https://api.discogs.com/releases/1", {
      signal: controller.signal,
      parseResponse: (res) => res.json(),
    });
    await bodyStarted;
    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });

  it("detects an offline browser", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    fetch.mockRejectedValue(new TypeError("Failed to fetch"));

    const error = await discogsFetch("https://api.discogs.com/releases/1").catch((e) => e);

    expect(error.name).toBe("OfflineError");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
