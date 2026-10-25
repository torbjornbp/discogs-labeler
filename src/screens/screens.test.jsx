import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import App from "../App.jsx";
import SelectScreen from "./SelectScreen.jsx";
import PreviewScreen from "./PreviewScreen.jsx";
import { normalizeFieldOrder, normalizeFields } from "../lib/fields.js";
import { TEMPLATES } from "../lib/templates.js";

const makeRelease = (id) => ({
  id,
  releaseId: id,
  title: `Title ${id}`,
  artist: `Artist ${id}`,
  year: 1999,
  label: "Label",
  catno: `CAT ${id}`,
  format: "Vinyl, LP",
  thumb: "",
  url: `https://www.discogs.com/release/${id}`,
  dateAdded: "2020-01-02 10:00:00",
  rating: id % 6,
  mediaCond: "Near Mint (NM or M-)",
  sleeveCond: "Very Good Plus (VG+)",
  folder: "Jazz",
  notes: "Note",
});

const releases = Array.from({ length: 250 }, (_, index) => makeRelease(index + 1));

const memoryStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

beforeAll(() => {
  vi.stubGlobal("localStorage", memoryStorage);
  vi.stubGlobal("sessionStorage", memoryStorage);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

function renderSelect(records, { inputMode = "csv", pricePrefix = "" } = {}) {
  return renderToStaticMarkup(
    <SelectScreen
      releases={records}
      selected={new Set()}
      toggleSelect={vi.fn()}
      selectAll={vi.fn()}
      clearAll={vi.fn()}
      username=""
      inputMode={inputMode}
      pricePrefix={pricePrefix}
      sortKey={null}
      sortDir="asc"
      handleSortClick={vi.fn()}
      setSortKey={vi.fn()}
      sortedReleases={records}
      setScreen={vi.fn()}
    />
  );
}

function makeLabelConfig(overrides = {}) {
  return {
    fields: normalizeFields(null),
    setFields: vi.fn(),
    fieldOrder: normalizeFieldOrder(null),
    setFieldOrder: vi.fn(),
    fontScale: 1,
    setFontScale: vi.fn(),
    qrScale: 0.65,
    setQrScale: vi.fn(),
    pad: { t: 3.2, r: 4.5, b: 1.2, l: 4.5 },
    setPad: vi.fn(),
    layoutMode: "single",
    setLayoutMode: vi.fn(),
    col2Fields: new Set(["tracklist"]),
    setCol2Fields: vi.fn(),
    pricePrefix: "",
    setPricePrefix: vi.fn(),
    tracklistMap: {},
    cancelTracklists: vi.fn(),
    ...overrides,
  };
}

function renderPreview({
  selectedReleases = [releases[0], releases[1]],
  template = TEMPLATES[0],
  inputMode = "username",
  controlTab = "layout",
  labelConfig = {},
} = {}) {
  return renderToStaticMarkup(
    <PreviewScreen
      selectedReleases={selectedReleases}
      template={template}
      setTemplate={vi.fn()}
      labelConfig={makeLabelConfig(labelConfig)}
      fetchTracklists={vi.fn()}
      controlTab={controlTab}
      setControlTab={vi.fn()}
      sortKey={null}
      sortDir="asc"
      inputMode={inputMode}
      setScreen={vi.fn()}
    />
  );
}

describe("screen smoke tests", () => {
  it("renders the home screen", () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain("Discogs Username");
    expect(html).toContain("Fetch Collection");
  });

  it("renders the select screen with incremental rows and ratings", () => {
    const html = renderToStaticMarkup(
      <SelectScreen
        releases={releases}
        selected={new Set([releases[0].id])}
        toggleSelect={vi.fn()}
        selectAll={vi.fn()}
        clearAll={vi.fn()}
        username="tester"
        inputMode="username"
        pricePrefix=""
        sortKey={null}
        sortDir="asc"
        handleSortClick={vi.fn()}
        setSortKey={vi.fn()}
        sortedReleases={releases}
        setScreen={vi.fn()}
      />
    );

    expect(html).toContain("Showing 200 of 250");
    expect(html).toContain("Show all");
    expect(html).toContain("Select all matching records");
    // Rating is available in API mode too.
    expect(html).toContain("★");
  });

  it("renders inventory prices with and without a currency prefix", () => {
    const inventory = [{
      ...makeRelease(1),
      releaseId: "",
      listingId: 456,
      price: "49",
      url: "https://www.discogs.com/sell/item/456",
    }];

    const blankPrefixHtml = renderSelect(inventory);
    expect(blankPrefixHtml).toContain(">Price<");
    expect(blankPrefixHtml).toContain(">49</td>");

    expect(renderSelect(inventory, { pricePrefix: "$" })).toContain(">$49</td>");
    expect(renderSelect(inventory, { pricePrefix: "kr " })).toContain(">kr 49</td>");

    // The column still only appears for CSV records that contain prices.
    expect(renderSelect([makeRelease(2)])).not.toContain(">Price<");
  });

  it("renders the preview screen with page wording and pagination", () => {
    const html = renderPreview();

    expect(html).toContain("Print Pages");
    expect(html).toContain("2 records · 2 labels · 1 page");
    expect(html).toContain("Page 1 of 1");
    expect(html).toContain("Copies per record");
    expect(html).toContain("Start on label");
    expect(html).toContain("Title 1");
    expect(html).toContain("data:image/gif;base64,");
  });

  it("renders the currency prefix on preview labels", () => {
    const fields = normalizeFields(null);
    fields.price.on = true;
    const html = renderPreview({
      selectedReleases: [{ ...releases[0], price: "49" }],
      inputMode: "csv",
      labelConfig: { fields, pricePrefix: "$" },
    });

    expect(html).toContain("Price: $49");
  });

  it("renders a write-in price line without leaking the imported price", () => {
    const fields = normalizeFields(null);
    fields.priceWriteIn.on = true;
    const html = renderPreview({
      selectedReleases: [{ ...releases[0], price: "49" }],
      inputMode: "csv",
      labelConfig: { fields },
    });

    expect(html).toContain("Price:");
    expect(html).not.toContain("Price: 49");
    expect(html).toMatch(/border-bottom:[0-9.]+px solid #111/);
  });

  it("uses one-page wording for a single-cell Brother template", () => {
    const html = renderPreview({
      selectedReleases: [releases[0]],
      template: TEMPLATES[1],
    });

    expect(html).toContain("1 record · 1 label · 1 page");
    expect(html).toContain("Page 1 of 1");
    // A one-cell template has nowhere else to start.
    expect(html).not.toContain("Start on label");
  });
});
