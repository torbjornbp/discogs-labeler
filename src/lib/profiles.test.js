import { describe, it, expect } from "vitest";
import { TEMPLATES } from "./templates.js";
import {
  DEFAULT_PAD,
  createDefaultProfile,
  normalizeProfile,
  serializeProfiles,
} from "./profiles.js";

const template = TEMPLATES[0];
const limitedTemplate = { ...template, id: "limited", maxQrScale: 1.1 };

describe("createDefaultProfile", () => {
  it("returns the default settings", () => {
    const profile = createDefaultProfile(template);

    expect(profile.fontScale).toBe(1);
    expect(profile.qrScale).toBe(0.65);
    expect(profile.pad).toEqual(DEFAULT_PAD);
    expect(profile.layoutMode).toBe("single");
    expect(profile.fieldOrder[0]).toBe("qr");
    expect(profile.col2Fields).toBeInstanceOf(Set);
    expect([...profile.col2Fields]).toEqual(["tracklist"]);
    expect(profile.fields.artist.on).toBe(true);
  });

  it("returns fresh nested objects on every call", () => {
    const first = createDefaultProfile(template);
    const second = createDefaultProfile(template);

    expect(first.fields).not.toBe(second.fields);
    expect(first.fieldOrder).not.toBe(second.fieldOrder);
    expect(first.pad).not.toBe(second.pad);
    expect(first.col2Fields).not.toBe(second.col2Fields);

    first.fields.artist.on = false;
    first.pad.t = 9;
    first.col2Fields.add("title");

    expect(second.fields.artist.on).toBe(true);
    expect(second.pad.t).toBe(DEFAULT_PAD.t);
    expect(second.col2Fields.has("title")).toBe(false);
  });
});

describe("normalizeProfile", () => {
  it("merges valid saved values over the defaults", () => {
    const profile = normalizeProfile(
      {
        fields: { artist: { on: false } },
        fieldOrder: ["title", "artist", "oldField"],
        fontScale: 1.25,
        qrScale: 0.8,
        pad: { t: 1, r: 2 },
        layoutMode: "twoColumn",
        col2Fields: ["tracklist", "qr", "tracklist", "artist"],
      },
      limitedTemplate
    );

    expect(profile.fields.artist.on).toBe(false);
    expect(profile.fieldOrder.slice(0, 2)).toEqual(["title", "artist"]);
    expect(profile.fieldOrder).not.toContain("oldField");
    expect(profile.fontScale).toBe(1.25);
    expect(profile.qrScale).toBe(0.8);
    expect(profile.pad).toEqual({ t: 1, r: 2, b: 1.2, l: 4.5 });
    expect(profile.layoutMode).toBe("twoColumn");
    expect(profile.col2Fields).toBeInstanceOf(Set);
    expect([...profile.col2Fields]).toEqual(["tracklist", "artist"]);
  });

  it("falls back safely from missing or invalid values", () => {
    const profile = normalizeProfile(
      {
        fields: "nope",
        fieldOrder: { nope: true },
        fontScale: "junk",
        qrScale: null,
        pad: "nope",
        layoutMode: "weird",
        col2Fields: "nope",
      },
      limitedTemplate
    );

    expect(profile.fields.artist.on).toBe(true);
    expect(profile.fieldOrder[0]).toBe("qr");
    expect(profile.fontScale).toBe(1);
    expect(profile.qrScale).toBe(0.65);
    expect(profile.pad).toEqual(DEFAULT_PAD);
    expect(profile.layoutMode).toBe("single");
    expect([...profile.col2Fields]).toEqual(["tracklist"]);
  });

  it("uses defaults for a non-record saved profile", () => {
    expect(normalizeProfile(null, template)).toEqual(
      createDefaultProfile(template)
    );
    expect(normalizeProfile("bad", template)).toEqual(
      createDefaultProfile(template)
    );
  });

  it("preserves a Set of column 2 fields", () => {
    const profile = normalizeProfile(
      { col2Fields: new Set(["artist", "tracklist"]) },
      template
    );
    expect([...profile.col2Fields]).toEqual(["artist", "tracklist"]);
  });
});

describe("QR scale clamping", () => {
  it("clamps to the template maximum on load", () => {
    expect(normalizeProfile({ qrScale: 9 }, limitedTemplate).qrScale).toBe(1.1);
    expect(normalizeProfile({ qrScale: 1.2 }, template).qrScale).toBe(1.2);
  });

  it("clamps to the global minimum", () => {
    expect(normalizeProfile({ qrScale: 0.1 }, template).qrScale).toBe(0.5);
    expect(normalizeProfile({ qrScale: 0.1 }, limitedTemplate).qrScale).toBe(0.5);
  });

  it("uses the default when the saved value is invalid", () => {
    expect(normalizeProfile({ qrScale: "huge" }, template).qrScale).toBe(0.65);
    expect(createDefaultProfile(limitedTemplate).qrScale).toBe(0.65);
  });
});

describe("serializeProfiles", () => {
  it("converts col2Fields Sets to plain arrays", () => {
    const profile = createDefaultProfile(template);
    profile.col2Fields = new Set(["tracklist", "artist"]);

    const serialized = serializeProfiles({ [template.id]: profile });

    expect(Array.isArray(serialized[template.id].col2Fields)).toBe(true);
    expect(serialized[template.id].col2Fields).toEqual(["tracklist", "artist"]);
    expect(serialized[template.id].fontScale).toBe(1);
    expect(serialized[template.id].pad).toEqual(DEFAULT_PAD);
    expect(() => JSON.stringify(serialized)).not.toThrow();
  });

  it("normalises arrays and does not mutate the original Set", () => {
    const profile = createDefaultProfile(template);
    profile.col2Fields = new Set(["tracklist"]);
    const serialized = serializeProfiles({
      a: profile,
      b: { col2Fields: ["qr", "tracklist", "tracklist"] },
    });

    expect(serialized.a.col2Fields).toEqual(["tracklist"]);
    expect(serialized.b.col2Fields).toEqual(["tracklist"]);
    expect(profile.col2Fields).toBeInstanceOf(Set);
    expect([...profile.col2Fields]).toEqual(["tracklist"]);
  });

  it("handles a corrupt profiles record", () => {
    expect(serializeProfiles(null)).toEqual({});
    expect(serializeProfiles([])).toEqual({});
    expect(serializeProfiles({ bad: "nope" })).toEqual({});
  });
});
