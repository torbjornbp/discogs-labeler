import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchAllReleases } from "./discogs.js";
import { configureDiscogs, resetDiscogsClient } from "./discogsClient.js";

const jsonResponse = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => data,
});

beforeEach(() => {
  resetDiscogsClient();
  configureDiscogs({ intervalMs: 0, perMinute: 1000, retryDelayMs: 0 });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  resetDiscogsClient();
});

describe("fetchAllReleases", () => {
  it("follows pagination and reports progress", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ releases: [{ id: 1 }], pagination: { pages: 2 } })
      )
      .mockResolvedValueOnce(
        jsonResponse({ releases: [{ id: 2 }], pagination: { pages: 2 } })
      );
    vi.stubGlobal("fetch", fetchMock);

    const progress = [];
    const releases = await fetchAllReleases("user", 0, (update) => progress.push(update));

    expect(releases).toEqual([{ id: 1 }, { id: 2 }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(progress.at(-1)).toMatchObject({ page: 2, total: 2, count: 2 });
  });

  it("maps a private collection to a helpful error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      headers: { get: () => null },
    }));

    await expect(fetchAllReleases("user")).rejects.toThrow(/private/i);
  });

  it("gives token-specific guidance for an authenticated 401", async () => {
    configureDiscogs({ token: "bad", intervalMs: 0, perMinute: 1000, retryDelayMs: 0 });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: { get: () => null },
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchAllReleases("user")).rejects.toThrow(/token.*correct/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops after one automatic retry when still rate-limited", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: { get: (name) => (name === "Retry-After" ? "1" : null) },
    });
    vi.stubGlobal("fetch", fetchMock);

    const assertion = expect(fetchAllReleases("user")).rejects.toThrow(/rate-limiting/i);
    await vi.runAllTimersAsync();
    await assertion;

    expect(fetchMock).toHaveBeenCalledTimes(2); // initial try + one retry
  });

  it("propagates a user abort instead of treating it as a timeout", async () => {
    vi.stubGlobal("fetch", vi.fn((url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => {
        const error = new Error("Aborted");
        error.name = "AbortError";
        reject(error);
      });
    })));

    const controller = new AbortController();
    const promise = fetchAllReleases("user", 0, undefined, controller.signal);
    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });

  it("propagates a caller abort while reading the response body", async () => {
    let markBodyStarted;
    const bodyStarted = new Promise((resolve) => {
      markBodyStarted = resolve;
    });
    vi.stubGlobal("fetch", vi.fn((url, { signal }) => Promise.resolve({
      ...jsonResponse({}),
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
    })));

    const controller = new AbortController();
    const promise = fetchAllReleases("user", 0, undefined, controller.signal);
    await bodyStarted;
    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });

  it("fails fast when a low-usage network error is not retryable", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchAllReleases("user")).rejects.toThrow(/Could not reach Discogs/);
    // discogsFetch retries once internally; fetchAllReleases must not add more.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries timeouts and eventually reports them", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => {
        const error = new Error("Aborted");
        error.name = "AbortError";
        reject(error);
      });
    }));
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchAllReleases("user");
    const assertion = expect(promise).rejects.toThrow(/timed out/i);

    // 20s request timeout + 5s retry delay per attempt.
    for (let attempt = 0; attempt < 3; attempt++) {
      await vi.advanceTimersByTimeAsync(25000);
    }

    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
