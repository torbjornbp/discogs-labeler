import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { MM, TEMPLATES } from "./templates.js";
import { normalizeFieldOrder, normalizeFields } from "./fields.js";
import { buildDocument } from "./print.js";
import { clearQrCache } from "./qr.js";

const release = (id = 1, overrides = {}) => ({
  id,
  releaseId: id,
  title: `Title ${id}`,
  artist: `Artist ${id}`,
  year: 1999,
  label: "Label",
  catno: "CAT 1",
  format: "Vinyl, LP",
  url: `https://www.discogs.com/release/${id}`,
  rating: 0,
  ...overrides,
});

const makeOptions = (releases, overrides = {}) => ({
  selectedReleases: releases,
  template: TEMPLATES[0],
  fields: normalizeFields(null),
  fieldOrder: normalizeFieldOrder(null),
  pad: { t: 3.2, r: 4.5, b: 1.2, l: 4.5 },
  fontScale: 1,
  qrScale: 0.65,
  layoutMode: "single",
  tracklistMap: {},
  col2Fields: new Set(["tracklist"]),
  ...overrides,
});

const count = (html, pattern) => (html.match(pattern) || []).length;

const pageCells = (html) => {
  const document = new JSDOM(html).window.document;
  return [...document.body.children].map((page) =>
    [...page.firstElementChild.children]
  );
};

describe("buildDocument", () => {
  it("pads a short selection to a full sheet and paginates the rest", () => {
    const one = buildDocument(makeOptions([release(1)]));
    expect(count(one, /width:70mm;height:37mm/g)).toBe(24);

    const two = buildDocument(
      makeOptions(Array.from({ length: 25 }, (_, i) => release(i + 1)))
    );
    expect(count(two, /width:210mm;height:297mm/g)).toBe(2);
    expect(count(two, /page-break-after:always/g)).toBe(1);
  });

  it("uses the template's page size instead of hardcoding A4", () => {
    const template = { ...TEMPLATES[0], pageWmm: 100, pageHmm: 50 };
    const html = buildDocument(makeOptions([release(1)], { template }));
    expect(html).toContain("@page { size:100mm 50mm; margin:0; }");
    expect(html).toContain("html, body { width:100mm;");
  });

  it("escapes user-controlled text", () => {
    const html = buildDocument(
      makeOptions([
        release(1, {
          title: '<script>alert("x")</script>',
          artist: "Tom & Jerry",
        }),
      ])
    );

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Tom &amp; Jerry");
  });

  it("renders inventory prices without adding a currency", () => {
    const fields = normalizeFields(null);
    fields.price.on = true;
    const html = buildDocument(
      makeOptions([release(1, { price: "24.99" })], { fields })
    );

    expect(html).toContain("Price: 24.99");
  });

  it("renders the configured currency prefix exactly", () => {
    const fields = normalizeFields(null);
    fields.price.on = true;

    const dollars = buildDocument(
      makeOptions([release(1, { price: "24.99" })], {
        fields,
        pricePrefix: "$",
      })
    );
    expect(dollars).toContain("Price: $24.99");

    const kroner = buildDocument(
      makeOptions([release(1, { price: "1 234,50" })], {
        fields,
        pricePrefix: "kr ",
      })
    );
    expect(kroner).toContain("Price: kr 1 234,50");

    const empty = buildDocument(
      makeOptions([release(1)], { fields, pricePrefix: "$" })
    );
    expect(empty).not.toContain("Price: $");
  });

  it("renders a fixed write-in line without leaking an imported price", () => {
    const fields = normalizeFields(null);
    fields.priceWriteIn.on = true;

    const html = buildDocument(
      makeOptions([release(1, { price: "24.99" })], { fields })
    );

    expect(html).toContain("Price:");
    expect(html).toContain("width:20mm;height:1em;border-bottom:0.3mm");
    expect(html).not.toContain("Price: 24.99");
  });

  it("renders the write-in line for releases with no price", () => {
    const fields = normalizeFields(null);
    fields.priceWriteIn.on = true;

    const html = buildDocument(
      makeOptions(
        [
          release(1, { price: undefined }),
          release(2, { price: "" }),
          release(3, { price: null }),
        ],
        { fields, inputMode: "api" }
      )
    );
    expect(count(html, />Price:<\/span><span aria-hidden="true"/g)).toBe(3);
  });

  it("keeps the old sheet output when no start cell is given", () => {
    const pages = pageCells(
      buildDocument(makeOptions([release(1), release(2)]))
    );
    expect(pages).toHaveLength(1);
    expect(pages[0]).toHaveLength(24);
    expect(pages[0][0].textContent).toContain("Title 1");
    expect(pages[0][1].textContent).toContain("Title 2");
  });

  it("applies the start cell only to the first page", () => {
    const pages = pageCells(
      buildDocument(
        makeOptions([release(1), release(2)], { startCell: 23 })
      )
    );

    expect(pages).toHaveLength(2);
    expect(pages[0]).toHaveLength(24);
    expect(pages[1]).toHaveLength(24);
    expect(pages[0][22].textContent).toBe("");
    expect(pages[0][23].textContent).toContain("Title 1");
    expect(pages[1][0].textContent).toContain("Title 2");
    expect(pages[1][1].textContent).toBe("");
  });

  it("produces no pages for an empty selection", () => {
    const html = buildDocument(makeOptions([]));
    expect(pageCells(html)).toEqual([]);
    expect(html).toContain("<title>Discogs Label Sheets</title>");
  });

  it("uses local QR data URLs and can omit the QR field", () => {
    const withQr = buildDocument(makeOptions([release(1)]));
    expect(withQr).toContain("data:image/gif;base64,");
    expect(withQr).not.toContain("qrserver.com");

    const fields = normalizeFields(null);
    fields.qr.on = false;
    const withoutQr = buildDocument(makeOptions([release(1)], { fields }));
    expect(withoutQr).not.toContain("data:image/gif;base64,");
  });

  it("uses supplied prepared QR data after the global cache is cleared", () => {
    const item = release(1);
    const preparedUrl = "data:image/gif;base64,prepared-for-print";
    const preparedQrCodes = new Map([[item.url, preparedUrl]]);
    clearQrCache();

    const html = buildDocument(makeOptions([item], { preparedQrCodes }));

    expect(html).toContain(`src="${preparedUrl}"`);
  });

  it("limits the tracklist to the configured clamp", () => {
    const fields = normalizeFields(null);
    fields.tracklist.on = true;
    const tracklist = Array.from({ length: 25 }, (_, i) => ({
      pos: `A${i + 1}`,
      title: `Track ${i + 1}`,
      duration: "3:00",
    }));

    const html = buildDocument(
      makeOptions([release(1)], {
        fields,
        tracklistMap: { 1: tracklist },
      })
    );

    expect(html).toContain("Track 20");
    expect(html).not.toContain("Track 21");
  });

  it("wraps all track lines in one field child of the gapped column", () => {
    const fields = normalizeFields(null);
    for (const field of Object.values(fields)) field.on = false;
    fields.tracklist.on = true;

    const html = buildDocument(
      makeOptions([release(1)], {
        fields,
        tracklistMap: {
          1: [{ pos: "A1", title: "One" }, { pos: "A2", title: "Two" }],
        },
      })
    );
    const document = new JSDOM(html).window.document;
    const trackText = [...document.querySelectorAll("div")].find(
      (element) => element.style.textOverflow === "ellipsis" && element.textContent === "A1 One"
    );

    expect(trackText).toBeDefined();
    const tracklistField = trackText.parentElement.parentElement;
    const fieldColumn = tracklistField.parentElement;
    expect(tracklistField.style.overflow).toBe("hidden");
    expect(tracklistField.style.flexShrink).toBe("0");
    expect(tracklistField.children).toHaveLength(2);
    expect(fieldColumn.style.flexDirection).toBe("column");
    expect(fieldColumn.children).toHaveLength(1);
  });

  it("renders two columns with the shared layout constants", () => {
    const fields = normalizeFields(null);
    fields.tracklist.on = true;
    const html = buildDocument(
      makeOptions([release(1)], {
        fields,
        layoutMode: "twoColumn",
        tracklistMap: { 1: [{ pos: "A1", title: "One", duration: "3:00" }] },
      })
    );

    expect(html).toContain("border-left:0.3mm solid #e0e0e0");
    expect(html).toContain("padding-left:1.5mm");
  });

  it("includes a title and language on the print document", () => {
    const html = buildDocument(makeOptions([release(1)]));
    expect(html).toContain("<title>Discogs Label Sheets</title>");
    expect(html).toContain('<html lang="en">');
  });
});

describe("templates", () => {
  const brother = TEMPLATES.find((template) => template.id === "brother-dk1201");

  it("defaults existing templates to a 1.5 QR scale", () => {
    expect(TEMPLATES[0].maxQrScale).toBe(1.5);
  });

  it("defines the Brother DK-1201 single-label page", () => {
    expect(brother).toBeDefined();
    expect(brother.name).toBe("Brother DK-1201 (experimental)");
    expect(brother.description).toBe("90.3 × 29 mm · 1 per page");
    expect(brother.cols).toBe(1);
    expect(brother.rows).toBe(1);
    expect(brother.labelWmm).toBe(90.3);
    expect(brother.labelHmm).toBe(29);
    expect(brother.pageWmm).toBe(90.3);
    expect(brother.pageHmm).toBe(29);
    expect(brother.labelW).toBeCloseTo(90.3 * MM, 5);
    expect(brother.labelH).toBeCloseTo(29 * MM, 5);
    expect(brother.pageW).toBeCloseTo(90.3 * MM, 5);
    expect(brother.pageH).toBeCloseTo(29 * MM, 5);
    expect(brother.maxQrScale).toBe(1);
  });

  it("prints one record per Brother page", () => {
    const html = buildDocument(
      makeOptions([release(1), release(2), release(3)], {
        template: brother,
      })
    );

    expect(count(html, /width:90\.3mm;height:29mm;display:flex/g)).toBe(3);
    expect(count(html, /width:90\.3mm;height:29mm;background:#fff/g)).toBe(3);
    expect(count(html, /page-break-after:always/g)).toBe(2);
    expect(html).toContain("@page { size:90.3mm 29mm; margin:0; }");
  });
});
