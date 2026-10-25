import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RateLimitError,
  fetchReleaseTracklist,
  formatTracklist,
} from "./tracklist.js";
import { configureDiscogs, resetDiscogsClient } from "./discogsClient.js";

const response = ({ status = 200, headers = {}, json = async () => ({}) } = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: { get: (name) => headers[name] ?? null },
  json,
});

beforeEach(() => {
  resetDiscogsClient();
  configureDiscogs({ intervalMs: 0, perMinute: 1000, retryDelayMs: 0 });
});

afterEach(() => {
  resetDiscogsClient();
  vi.unstubAllGlobals();
});

describe("formatTracklist", () => {
  it("drops headings and empty titles and normalizes fields", () => {
    expect(
      formatTracklist([
        { type_: "heading", title: "Side A" },
        { position: "A1", title: "One", duration: "3:00" },
        { position: "", title: "Two", duration: "" },
        { position: "A3", title: "", duration: "2:00" },
      ])
    ).toEqual([
      { pos: "A1", title: "One", duration: "3:00" },
      { pos: "", title: "Two", duration: "" },
    ]);
  });
});

describe("fetchReleaseTracklist", () => {
  it("returns formatted tracks on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      response({
        json: async () => ({
          tracklist: [{ type_: "heading", title: "Side A" }, { position: "A1", title: "One", duration: "3:00" }],
        }),
      })
    ));

    await expect(fetchReleaseTracklist(123)).resolves.toEqual([
      { pos: "A1", title: "One", duration: "3:00" },
    ]);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.discogs.com/releases/123",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("throws RateLimitError for 429 with a minimum 60s wait", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      response({ status: 429, headers: { "Retry-After": "5" } })
    ));

    const error = await fetchReleaseTracklist(1).catch((e) => e);

    expect(error).toBeInstanceOf(RateLimitError);
    expect(error.waitSecs).toBeGreaterThanOrEqual(60);
  });

  it("returns an empty list for a release without a tracklist (404)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ status: 404 })));
    await expect(fetchReleaseTracklist(1)).resolves.toEqual([]);
  });

  it("throws (and does not cache an empty list) for server errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ status: 500 })));
    await expect(fetchReleaseTracklist(1)).rejects.toThrow(/Discogs API error: 500/);
  });

  it("throws a readable error for network failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(fetchReleaseTracklist(1)).rejects.toThrow(/Could not reach Discogs/);
  });

  it("times out when the response body stalls after headers", async () => {
    configureDiscogs({ requestTimeoutMs: 20 });
    vi.stubGlobal("fetch", vi.fn((url, { signal }) => Promise.resolve(response({
      json: () => new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => {
          const error = new Error("Aborted");
          error.name = "AbortError";
          reject(error);
        }, { once: true });
      }),
    }))));

    await expect(fetchReleaseTracklist(1)).rejects.toMatchObject({ name: "TimeoutError" });
  });

  it("respects an already-aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchReleaseTracklist(1, controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("aborts an in-flight request", async () => {
    vi.stubGlobal("fetch", vi.fn((url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => {
        const error = new Error("Aborted");
        error.name = "AbortError";
        reject(error);
      });
    })));

    const controller = new AbortController();
    const promise = fetchReleaseTracklist(1, controller.signal);
    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });
});
