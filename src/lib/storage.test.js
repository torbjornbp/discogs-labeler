import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LS, SS, clearAllSettings } from "./storage.js";

function makeStorage() {
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(this, key) ? this[key] : null;
    },
    setItem(key, value) {
      this[key] = String(value);
    },
    removeItem(key) {
      delete this[key];
    },
  };
}

const LEGACY_VALUES = {
  fields: { artist: { on: true } },
  fieldOrder: ["artist", "title"],
  sortKey: "artist",
  sortDir: "desc",
  fontScale: 1.2,
  qrScale: 0.8,
  pad: { t: 1.2 },
  templateId: "a4",
  layoutMode: "twoColumn",
  col2Fields: ["tracklist"],
  inputMode: "csv",
};

let data;
let session;

beforeEach(() => {
  data = makeStorage();
  session = makeStorage();
  vi.stubGlobal("localStorage", data);
  vi.stubGlobal("sessionStorage", session);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LS", () => {
  it("namespaces keys and round-trips JSON", () => {
    LS.set("pad", { t: 1.2 });
    expect(data["discogs-labeler.pad"]).toBe('{"t":1.2}');
    expect(LS.get("pad", null)).toEqual({ t: 1.2 });
  });

  it("lazily migrates every known legacy setting", () => {
    for (const [key, value] of Object.entries(LEGACY_VALUES)) {
      data[key] = JSON.stringify(value);
    }

    for (const [key, value] of Object.entries(LEGACY_VALUES)) {
      expect(LS.get(key, "fallback")).toEqual(value);
      expect(data[`discogs-labeler.${key}`]).toBe(JSON.stringify(value));
    }
  });

  it("keeps namespaced values authoritative before and after migration", () => {
    data.fontScale = "1.2";
    data["discogs-labeler.fontScale"] = "1.4";
    expect(LS.get("fontScale", 1)).toBe(1.4);

    data.pad = '{"t":1}';
    expect(LS.get("pad", null)).toEqual({ t: 1 });
    LS.set("pad", { t: 2 });
    expect(LS.get("pad", null)).toEqual({ t: 2 });
  });

  it("does not migrate unknown unprefixed keys", () => {
    data["other-app-state"] = '"keep me"';

    expect(LS.get("other-app-state", "fallback")).toBe("fallback");
    expect(data["discogs-labeler.other-app-state"]).toBeUndefined();
    expect(data["other-app-state"]).toBe('"keep me"');
  });

  it("returns the fallback for missing or corrupt values", () => {
    expect(LS.get("missing", { ok: true })).toEqual({ ok: true });
    data["discogs-labeler.bad"] = "{not json";
    expect(LS.get("bad", "fallback")).toBe("fallback");
    data.pad = "{not json";
    expect(LS.get("pad", "fallback")).toBe("fallback");
    expect(data["discogs-labeler.pad"]).toBeUndefined();
  });

  it("swallows storage errors", () => {
    data.setItem = () => { throw new Error("quota"); };
    data.getItem = () => { throw new Error("blocked"); };
    expect(() => LS.set("x", 1)).not.toThrow();
    expect(LS.get("x", 2)).toBe(2);
  });

  it("returns a legacy value when saving its migration fails", () => {
    data.pad = '{"t":1}';
    data.setItem = () => { throw new Error("quota"); };

    expect(LS.get("pad", null)).toEqual({ t: 1 });
    expect(data["discogs-labeler.pad"]).toBeUndefined();
  });

  it("removes a single key", () => {
    LS.set("x", 1);
    LS.remove("x");
    expect(data["discogs-labeler.x"]).toBeUndefined();
  });
});

describe("SS", () => {
  it("keeps session-only credentials out of persistent storage", () => {
    LS.set("pad", { t: 1 });
    SS.set("token", "secret");

    expect(data["discogs-labeler.pad"]).toBe('{"t":1}');
    expect(data["discogs-labeler.token"]).toBeUndefined();
    expect(session["discogs-labeler.token"]).toBe('"secret"');
    expect(SS.get("token", "")).toBe("secret");
  });
});

describe("clearAllSettings", () => {
  it("removes namespaced and known legacy keys but leaves unrelated keys", () => {
    data["discogs-labeler.fields"] = "{}";
    data["discogs-labeler.pad"] = "{}";
    for (const key of Object.keys(LEGACY_VALUES)) data[key] = '"legacy"';
    data["other-app-state"] = "keep me";
    session["discogs-labeler.token"] = '"secret"';

    clearAllSettings();

    expect(data["discogs-labeler.fields"]).toBeUndefined();
    expect(data["discogs-labeler.pad"]).toBeUndefined();
    for (const key of Object.keys(LEGACY_VALUES)) {
      expect(data[key]).toBeUndefined();
    }
    expect(data["other-app-state"]).toBe("keep me");
    expect(session["discogs-labeler.token"]).toBeUndefined();
  });

  it("cannot resurrect migrated legacy settings after a reset", () => {
    data.pad = '{"t":1}';
    expect(LS.get("pad", null)).toEqual({ t: 1 });

    clearAllSettings();

    expect(LS.get("pad", "fallback")).toBe("fallback");
    expect(data.pad).toBeUndefined();
    expect(data["discogs-labeler.pad"]).toBeUndefined();
  });
});
