import { describe, it, expect } from "vitest";
import { clearQrCache, prepareQrCodes, qrDataUrl } from "./qr.js";

describe("qrDataUrl", () => {
  it("generates a local GIF data URL", () => {
    clearQrCache();
    const url = qrDataUrl("https://www.discogs.com/release/123");
    expect(url.startsWith("data:image/gif;base64,")).toBe(true);
    expect(url.length).toBeGreaterThan(100);
  });

  it("caches results per URL", () => {
    clearQrCache();
    const first = qrDataUrl("https://example.com/a");
    const second = qrDataUrl("https://example.com/a");
    const third = qrDataUrl("https://example.com/b");
    expect(second).toBe(first);
    expect(third).not.toBe(first);
  });

  it("returns an empty string for missing data", () => {
    expect(qrDataUrl("")).toBe("");
    expect(qrDataUrl(null)).toBe("");
  });

  it("prepares unique QR codes and reports progress", async () => {
    clearQrCache();
    const progress = [];
    const prepared = await prepareQrCodes(
      ["https://example.com/a", "https://example.com/b", "https://example.com/a"],
      (done, count) => progress.push([done, count])
    );

    expect(prepared.size).toBe(2);
    expect(progress[0]).toEqual([0, 2]);
    expect(progress.at(-1)).toEqual([2, 2]);
    expect(prepared.get("https://example.com/a")).not.toBe("");
    expect(prepared.get("https://example.com/b")).not.toBe("");
    expect(qrDataUrl("https://example.com/a")).toBe(prepared.get("https://example.com/a"));
    expect(qrDataUrl("https://example.com/b")).toBe(prepared.get("https://example.com/b"));
  });

  it("stops preparing when the consumer cancels", async () => {
    clearQrCache();
    const prepared = await prepareQrCodes(
      ["https://example.com/a", "https://example.com/b"],
      undefined,
      () => false
    );
    expect(prepared.size).toBe(0);
  });
});
