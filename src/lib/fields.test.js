import { describe, it, expect } from "vitest";
import {
  DEFAULT_FIELDS,
  DEFAULT_FIELD_ORDER,
  FIELD_STYLES,
  FIELD_VALUE,
  csvOnlyCols,
  formatPrice,
  normalizeCol2Fields,
  normalizeFieldOrder,
  normalizeFields,
  starsText,
} from "./fields.js";
import { MM } from "./templates.js";

describe("starsText", () => {
  it("renders five stars with the given rating", () => {
    expect(starsText(0)).toBe("☆☆☆☆☆");
    expect(starsText(4)).toBe("★★★★☆");
  });

  it("clamps out-of-range values instead of throwing", () => {
    expect(() => starsText(6)).not.toThrow();
    expect(starsText(6)).toBe("★★★★★");
    expect(starsText(-1)).toBe("☆☆☆☆☆");
  });
});

describe("FIELD_VALUE", () => {
  it("maps Discogs fields to label values", () => {
    expect(FIELD_VALUE({ catno: "none" }, "catno")).toBe("");
    expect(FIELD_VALUE({ rating: 4 }, "rating")).toBe("★★★★☆");
    expect(FIELD_VALUE({ rating: 0 }, "rating")).toBe("");
    expect(FIELD_VALUE({ year: 1999 }, "year")).toBe(1999);
    expect(FIELD_VALUE({ price: "24.99" }, "price")).toBe("Price: 24.99");
    expect(FIELD_VALUE({ price: "0" }, "price")).toBe("Price: 0");
    expect(FIELD_VALUE({}, "price")).toBe("");
  });

  it("adds the currency prefix without reformatting the price", () => {
    expect(FIELD_VALUE({ price: "24.99" }, "price", "")).toBe("Price: 24.99");
    expect(FIELD_VALUE({ price: "24.99" }, "price", "$")).toBe("Price: $24.99");
    expect(FIELD_VALUE({ price: "1 234,50" }, "price", "kr ")).toBe(
      "Price: kr 1 234,50"
    );
    expect(FIELD_VALUE({}, "price", "$")).toBe("");
  });

  it("never uses the imported price for the write-in field", () => {
    expect(FIELD_VALUE({ price: "24.99" }, "priceWriteIn")).toBe("");
    expect(FIELD_VALUE({ price: "24.99" }, "priceWriteIn", "$")).toBe("");
  });
});

describe("formatPrice", () => {
  it("returns an empty string for empty values", () => {
    expect(formatPrice(undefined)).toBe("");
    expect(formatPrice(null)).toBe("");
    expect(formatPrice("")).toBe("");
    expect(formatPrice("", "$")).toBe("");
  });

  it("preserves the numeric text and applies the prefix exactly", () => {
    expect(formatPrice("24.99")).toBe("24.99");
    expect(formatPrice("24.99", "$")).toBe("$24.99");
    expect(formatPrice("1 234,50", "kr ")).toBe("kr 1 234,50");
    expect(formatPrice(0, "$")).toBe("$0");
  });
});

describe("price write-in schema", () => {
  it("matches the price style and turns the field off by default", () => {
    expect(FIELD_STYLES.priceWriteIn).toEqual(FIELD_STYLES.price);
    expect(DEFAULT_FIELDS.priceWriteIn).toEqual({
      label: "Price (write-in)",
      on: false,
    });
  });

  it("sits directly after price and stays out of CSV-only columns", () => {
    const index = DEFAULT_FIELD_ORDER.indexOf("priceWriteIn");
    expect(index).toBe(DEFAULT_FIELD_ORDER.indexOf("price") + 1);
    expect(csvOnlyCols).not.toContain("priceWriteIn");
  });

  it("normalizes persisted write-in settings", () => {
    const fields = normalizeFields({ priceWriteIn: { on: true } });
    expect(fields.priceWriteIn.on).toBe(true);
    expect(normalizeFields(null).priceWriteIn.on).toBe(false);
    expect(normalizeFieldOrder(["qr", "price"])).toContain("priceWriteIn");
  });
});

describe("schema metadata", () => {
  it("no longer treats rating as CSV-only", () => {
    expect(csvOnlyCols).not.toContain("rating");
  });

  it("derives preview font sizes from the print mm size", () => {
    expect(FIELD_STYLES.artist.size).toBeCloseTo(2.8 * MM, 2);
    expect(FIELD_STYLES.tracklist.clamp).toBe(20);
  });
});

describe("normalizeFields", () => {
  it("returns a deep copy of the defaults", () => {
    const fields = normalizeFields(null);
    expect(fields).toEqual(DEFAULT_FIELDS);
    fields.artist.on = false;
    expect(DEFAULT_FIELDS.artist.on).toBe(true);
  });

  it("merges valid saved values and ignores junk", () => {
    const fields = normalizeFields({
      artist: { on: false },
      tracklist: { on: true, showDuration: false },
      unknown: { on: true },
      title: { on: "yes" },
    });

    expect(fields.artist.on).toBe(false);
    expect(fields.tracklist).toMatchObject({ on: true, showDuration: false });
    expect(fields.title.on).toBe(true);
    expect(fields.unknown).toBeUndefined();
  });
});

describe("normalizeFieldOrder", () => {
  it("appends new fields and prunes removed/stale keys", () => {
    const order = normalizeFieldOrder(["qr", "artist", "oldField", "tracklist"]);
    expect(order[0]).toBe("qr");
    expect(order[1]).toBe("artist");
    expect(order).not.toContain("oldField");
    expect(order).toContain("title");
    expect(order).toContain("tracklist");
    expect(new Set(order).size).toBe(order.length);
  });

  it("handles corrupt (non-array) stored values", () => {
    expect(normalizeFieldOrder({ nope: true })).toEqual(
      normalizeFieldOrder(null)
    );
  });
});

describe("normalizeCol2Fields", () => {
  it("defaults to tracklist", () => {
    expect(normalizeCol2Fields(null)).toEqual(["tracklist"]);
  });

  it("prunes qr, unknown keys, and duplicates", () => {
    expect(normalizeCol2Fields(["qr", "tracklist", "tracklist", "old"])).toEqual([
      "tracklist",
    ]);
  });
});
