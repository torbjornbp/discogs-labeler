// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { fetchAllReleases } from "../lib/discogs.js";
import { normalizeFieldOrder, normalizeFields } from "../lib/fields.js";
import { TEMPLATES } from "../lib/templates.js";
import { fetchReleaseTracklist, RateLimitError } from "../lib/tracklist.js";
import { openPrintWindow } from "../lib/print.js";
import PreviewScreen from "./PreviewScreen.jsx";

vi.mock("../components/LazySheet.jsx", () => ({ default: () => null }));
vi.mock("../lib/print.js", () => ({ openPrintWindow: vi.fn(() => true) }));
vi.mock("../lib/discogs.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, fetchAllReleases: vi.fn() };
});
vi.mock("../lib/tracklist.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, fetchReleaseTracklist: vi.fn() };
});

const noop = () => {};

function makeStorage() {
  const data = {};
  return {
    data,
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    },
    removeItem(key) {
      delete data[key];
    },
  };
}

const makeRawRelease = (id) => ({
  id,
  instance_id: id,
  date_added: "2020-01-02T10:00:00Z",
  rating: 0,
  basic_information: {
    id,
    title: `Title ${id}`,
    artists: [{ name: `Artist ${id}` }],
    year: 1999,
    labels: [{ name: "Label", catno: `CAT ${id}` }],
    formats: [{ name: "Vinyl", descriptions: ["LP"] }],
    thumb: "",
  },
});

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
  rating: 0,
});

let container;
let root;
let localStorageMock;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorageMock = makeStorage();
  vi.stubGlobal("localStorage", localStorageMock);
  vi.stubGlobal("sessionStorage", makeStorage());
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    disconnect() {}
  });
  vi.spyOn(console, "warn").mockImplementation(noop);

  fetchAllReleases.mockReset();
  fetchAllReleases.mockResolvedValue([makeRawRelease(1), makeRawRelease(2)]);
  fetchReleaseTracklist.mockReset();
  openPrintWindow.mockClear();

  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function mount(element) {
  await act(async () => root.render(element));
}

function findButton(text, exact = false) {
  const button = [...container.querySelectorAll("button")].find((item) => {
    const content = item.textContent.trim();
    return exact ? content === text : content.includes(text);
  });
  expect(button, `button containing ${text}`).toBeDefined();
  return button;
}

async function click(element) {
  await act(async () => {
    element.click();
    await Promise.resolve();
  });
}

async function setFormValue(element, value) {
  const prototype = element instanceof HTMLSelectElement
    ? HTMLSelectElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value").set;
  await act(async () => {
    setter.call(element, String(value));
    element.dispatchEvent(new Event(
      element instanceof HTMLSelectElement ? "change" : "input",
      { bubbles: true }
    ));
    await Promise.resolve();
  });
}

function pageCaptionCount() {
  return (container.textContent.match(/Page \d+ of \d+/g) || []).length;
}

async function pressAltArrow(element, key) {
  const event = new KeyboardEvent("keydown", {
    key,
    altKey: true,
    bubbles: true,
    cancelable: true,
  });
  await act(async () => element.dispatchEvent(event));
  return event;
}

function visibleFieldKeys() {
  return [...container.querySelectorAll("[data-field-key]")].map((item) => item.dataset.fieldKey);
}

function PreviewHarness({
  inputMode = "username",
  layoutMode = "single",
  initialCol2Fields = [],
  releases = [],
  tracklistOn = false,
  fetchTracklists = noop,
  template = TEMPLATES[0],
  controlTab = "fields",
  priceOn,
  initialPricePrefix = "",
  initialPriceScale = 1,
}) {
  const [fieldOrder, setFieldOrder] = useState(() => normalizeFieldOrder(null));
  const [fields, setFields] = useState(() => {
    const next = normalizeFields(null);
    next.tracklist.on = tracklistOn;
    if (typeof priceOn === "boolean") next.price.on = priceOn;
    return next;
  });
  const [col2Fields, setCol2Fields] = useState(() => new Set(initialCol2Fields));
  const [pricePrefix, setPricePrefix] = useState(initialPricePrefix);
  const [priceScale, setPriceScale] = useState(initialPriceScale);

  return (
    <PreviewScreen
      selectedReleases={releases}
      template={template}
      setTemplate={noop}
      labelConfig={{
        fields,
        setFields,
        fieldOrder,
        setFieldOrder,
        fontScale: 1,
        setFontScale: noop,
        priceScale,
        setPriceScale,
        qrScale: 0.65,
        setQrScale: noop,
        pad: { t: 3.2, r: 4.5, b: 1.2, l: 4.5 },
        setPad: noop,
        layoutMode,
        setLayoutMode: noop,
        col2Fields,
        setCol2Fields,
        pricePrefix,
        setPricePrefix,
        tracklistMap: {},
        cancelTracklists: noop,
      }}
      fetchTracklists={fetchTracklists}
      controlTab={controlTab}
      setControlTab={noop}
      sortKey={null}
      sortDir="asc"
      inputMode={inputMode}
      setScreen={noop}
    />
  );
}

describe("Inventory CSV behavior", () => {
  it("shows the price toggle selected by default only when selected CSV records contain prices", async () => {
    await mount(
      <PreviewHarness inputMode="csv" releases={[{ ...makeRelease(1), price: "49" }]} />
    );
    const priceButton = container.querySelector('[data-field-key="price"]');
    expect(priceButton).not.toBeNull();
    expect(priceButton.getAttribute("aria-pressed")).toBe("true");

    await click(priceButton);
    expect(priceButton.getAttribute("aria-pressed")).toBe("false");

    await mount(<PreviewHarness inputMode="csv" releases={[makeRelease(2)]} />);
    expect(container.querySelector('[data-field-key="price"]')).toBeNull();
  });

  it("marks tracklist fetching unavailable for inventory-only rows", async () => {
    const inventory = { ...makeRelease(1), releaseId: "", listingId: "456", price: "49" };
    await mount(<PreviewHarness inputMode="csv" releases={[inventory]} tracklistOn />);

    const button = findButton("Tracklists unavailable");
    expect(button.disabled).toBe(true);
    expect(button.title).toMatch(/do not include release IDs/i);
  });
});

describe("Preview copies and pagination", () => {
  it("expands copies per record into label and page counts", async () => {
    const records = Array.from({ length: 13 }, (_, index) => makeRelease(index + 1));
    await mount(<PreviewHarness releases={records} controlTab="layout" />);

    expect(container.textContent).toContain("13 records · 13 labels · 1 page");
    expect(pageCaptionCount()).toBe(1);

    const copies = container.querySelector('input[aria-label="Copies per record"]');
    expect(copies.value).toBe("1");
    expect(copies.min).toBe("1");
    expect(copies.max).toBe("100");

    await setFormValue(copies, "2");

    expect(copies.value).toBe("2");
    expect(container.textContent).toContain("13 records · 26 labels · 2 pages");
    expect(pageCaptionCount()).toBe(2);

    await click(findButton("Print Pages"));
    const printOptions = openPrintWindow.mock.calls[0][0];
    expect(printOptions.selectedReleases).toHaveLength(26);
    expect(printOptions.selectedReleases.slice(0, 2).map((release) => release.id))
      .toEqual([1, 1]);

    await setFormValue(copies, "0");
    expect(copies.value).toBe("1");
    expect(container.textContent).toContain("13 records · 13 labels · 1 page");
  });

  it("changes the pagination preview from the start-on-label control", async () => {
    const records = Array.from({ length: 24 }, (_, index) => makeRelease(index + 1));
    await mount(<PreviewHarness releases={records} controlTab="layout" />);

    expect(container.textContent).toContain("24 records · 24 labels · 1 page");
    expect(pageCaptionCount()).toBe(1);

    const start = container.querySelector('select[aria-label="Start on label"]');
    expect(start).not.toBeNull();
    expect([...start.options].map((option) => option.value)).toContain("24");
    expect(start.value).toBe("1");

    // Starting on the last cell leaves room for only one label on page one.
    await setFormValue(start, "24");

    expect(start.value).toBe("24");
    expect(container.textContent).toContain("24 records · 24 labels · 2 pages");
    expect(pageCaptionCount()).toBe(2);

    await click(findButton("Print Pages"));
    expect(openPrintWindow.mock.calls[0][0].startCell).toBe(23);
  });

  it("uses one-page wording and hides the start cell for a single-cell template", async () => {
    await mount(
      <PreviewHarness
        template={TEMPLATES[1]}
        releases={[makeRelease(1)]}
        controlTab="layout"
      />
    );

    expect(container.textContent).toContain("1 record · 1 label · 1 page");
    expect(pageCaptionCount()).toBe(1);
    expect(container.querySelector('select[aria-label="Start on label"]')).toBeNull();

    const qr = container.querySelector('input[aria-label="QR size"]');
    expect(qr.max).toBe("100");
  });
});

describe("Preview currency prefix", () => {
  it("shows price size and prefix controls when price is on, hides them when untoggled, and passes both to print", async () => {
    const releases = [{ ...makeRelease(1), price: "49" }];
    await mount(<PreviewHarness inputMode="csv" releases={releases} priceOn={false} />);

    expect(container.querySelector('input[aria-label="Price size"]')).toBeNull();
    expect(container.querySelector('input[aria-label="Currency prefix"]')).toBeNull();

    await click(container.querySelector('[data-field-key="price"]'));

    const priceSize = container.querySelector('input[aria-label="Price size"]');
    const prefix = container.querySelector('input[aria-label="Currency prefix"]');
    expect(priceSize).not.toBeNull();
    expect(prefix).not.toBeNull();
    expect(prefix.maxLength).toBe(8);

    await setFormValue(priceSize, "150");
    expect(priceSize.value).toBe("150");

    await setFormValue(prefix, "$");
    expect(prefix.value).toBe("$");

    await click(findButton("Print Pages"));

    expect(openPrintWindow).toHaveBeenCalledTimes(1);
    expect(openPrintWindow.mock.calls[0][0]).toMatchObject({
      pricePrefix: "$",
      priceScale: 1.5,
      startCell: 0,
    });
    expect(openPrintWindow.mock.calls[0][0].selectedReleases).toHaveLength(1);

    await click(container.querySelector('[data-field-key="price"]'));
    expect(container.querySelector('input[aria-label="Price size"]')).toBeNull();
    expect(container.querySelector('input[aria-label="Currency prefix"]')).toBeNull();
  });

  it("shows price size (without currency prefix) when only write-in price is enabled", async () => {
    await mount(<PreviewHarness />);
    const writeIn = container.querySelector('[data-field-key="priceWriteIn"]');
    expect(writeIn.getAttribute("aria-pressed")).toBe("false");
    expect(container.querySelector('input[aria-label="Price size"]')).toBeNull();

    await click(writeIn);
    expect(container.querySelector('input[aria-label="Price size"]')).not.toBeNull();
    expect(container.querySelector('input[aria-label="Currency prefix"]')).toBeNull();
  });

  it("keeps the write-in price field visible in API mode and CSV without prices", async () => {
    await mount(<PreviewHarness />);
    const writeIn = container.querySelector('[data-field-key="priceWriteIn"]');
    expect(writeIn).not.toBeNull();
    expect(writeIn.textContent).toContain("Price (write-in)");
    expect(container.querySelector('[data-field-key="price"]')).toBeNull();

    await mount(<PreviewHarness inputMode="csv" releases={[makeRelease(2)]} />);
    expect(container.querySelector('[data-field-key="priceWriteIn"]')).not.toBeNull();
    expect(container.querySelector('[data-field-key="price"]')).toBeNull();
  });
});

describe("Preview field keyboard reordering", () => {
  it("moves past hidden CSV-only fields in one visible step in API mode", async () => {
    await mount(<PreviewHarness />);
    expect(visibleFieldKeys()).toEqual([
      "qr", "artist", "title", "year", "format", "catno", "priceWriteIn", "label", "rating", "tracklist",
    ]);

    const event = await pressAltArrow(container.querySelector('[data-field-key="label"]'), "ArrowDown");

    expect(event.defaultPrevented).toBe(true);
    expect(visibleFieldKeys()).toEqual([
      "qr", "artist", "title", "year", "format", "catno", "priceWriteIn", "rating", "label", "tracklist",
    ]);
  });

  it("reorders only within the current column in two-column mode", async () => {
    await mount(<PreviewHarness layoutMode="twoColumn" initialCol2Fields={["label", "tracklist"]} />);
    const columnTwo = () => container.querySelector('[data-col="2"]');
    const columnTwoKeys = () => [...columnTwo().querySelectorAll("[data-field-key]")]
      .map((item) => item.dataset.fieldKey);
    const columnOneKeys = () => [...container.querySelectorAll("[data-field-key]")]
      .filter((item) => !item.closest('[data-col="2"]'))
      .map((item) => item.dataset.fieldKey);

    expect(columnOneKeys()).toEqual(["qr", "artist", "title", "year", "format", "catno", "priceWriteIn", "rating"]);
    expect(columnTwoKeys()).toEqual(["label", "tracklist"]);

    await pressAltArrow(columnTwo().querySelector('[data-field-key="label"]'), "ArrowDown");

    expect(columnTwoKeys()).toEqual(["tracklist", "label"]);
    expect(columnOneKeys()).toEqual(["qr", "artist", "title", "year", "format", "catno", "priceWriteIn", "rating"]);
  });

  it("does not move fields onto or from the QR position", async () => {
    await mount(<PreviewHarness />);
    const before = visibleFieldKeys();

    await pressAltArrow(container.querySelector('[data-field-key="artist"]'), "ArrowUp");
    expect(visibleFieldKeys()).toEqual(before);

    await pressAltArrow(container.querySelector('[data-field-key="qr"]'), "ArrowDown");
    expect(visibleFieldKeys()).toEqual(before);
  });
});

describe("Preview tracklist errors", () => {
  it("shows the progress error and removes the spinner", async () => {
    const fetchTracklists = vi.fn((releases, onProgress) => {
      onProgress(0, 1, null, "Check your connection, then try again.");
    });
    await mount(
      <PreviewHarness releases={[makeRelease(1)]} tracklistOn fetchTracklists={fetchTracklists} />
    );

    await click(findButton("↓ Fetch Tracklists"));

    expect(container.querySelector('[role="alert"]').textContent)
      .toBe("Check your connection, then try again.");
    expect(container.querySelector('[role="status"]')).toBeNull();
  });
});

async function openAppPreview() {
  await mount(<App />);
  const input = container.querySelector("#discogs-username");
  const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  await act(async () => {
    setInputValue.call(input, "tester");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

  await click(findButton("Fetch Collection"));
  await click(findButton("All", true));
  await click(findButton("Preview Labels"));
}

async function openAppTracklistPreview() {
  await openAppPreview();
  await click(findButton("Fields", true));
  await click(container.querySelector('[data-field-key="tracklist"]'));
  return findButton("↓ Fetch Tracklists");
}

describe("App tracklist failures", () => {
  it.each([
    ["offline", Object.assign(new Error("You appear to be offline"), { name: "OfflineError" })],
    ["network", new TypeError("Could not reach Discogs")],
    ["HTTP", new Error("Discogs API error: 500")],
    ["JSON", new SyntaxError("Unexpected token in JSON")],
  ])("surfaces a %s failure and stops the run", async (name, error) => {
    fetchReleaseTracklist.mockRejectedValue(error);
    const fetchButton = await openAppTracklistPreview();

    await click(fetchButton);

    const alert = container.querySelector('[role="alert"]');
    expect(alert.textContent).toContain(error.message);
    expect(alert.textContent).toContain("Check your connection");
    expect(alert.textContent).toContain("try Fetch Tracklists again");
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(fetchReleaseTracklist).toHaveBeenCalledTimes(1);
    expect(findButton("↓ Fetch Tracklists")).toBeDefined();
  });

  it("preserves the dedicated rate-limit error handling", async () => {
    fetchReleaseTracklist.mockRejectedValue(new RateLimitError(60));
    const fetchButton = await openAppTracklistPreview();

    await click(fetchButton);

    expect(container.querySelector('[role="alert"]').textContent)
      .toContain("Discogs is rate-limiting tracklist requests");
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(fetchReleaseTracklist).toHaveBeenCalledTimes(2);
  });
});

describe("App template profiles", () => {
  const fieldButton = (key) => container.querySelector(`[data-field-key="${key}"]`);
  const pressed = (key) => fieldButton(key).getAttribute("aria-pressed");
  const chooseTemplate = async (id) => {
    await click(findButton("Layout", true));
    await setFormValue(container.querySelector('select[aria-label="Label template"]'), id);
  };

  it("keeps field settings isolated per template", async () => {
    await openAppPreview();
    await click(findButton("Fields", true));

    expect(pressed("artist")).toBe("true");
    await click(fieldButton("artist"));
    expect(pressed("artist")).toBe("false");

    await chooseTemplate("brother-dk1201");
    await click(findButton("Fields", true));
    expect(pressed("artist")).toBe("true");
    expect(pressed("title")).toBe("true");
    await click(fieldButton("title"));
    expect(pressed("title")).toBe("false");

    await chooseTemplate("avery-3448");
    await click(findButton("Fields", true));
    expect(pressed("artist")).toBe("false");
    expect(pressed("title")).toBe("true");

    await chooseTemplate("brother-dk1201");
    await click(findButton("Fields", true));
    expect(pressed("artist")).toBe("true");
    expect(pressed("title")).toBe("false");

    const saved = JSON.parse(localStorageMock.data["discogs-labeler.profiles"]);
    expect(saved["avery-3448"].fields.artist.on).toBe(false);
    expect(saved["brother-dk1201"].fields.title.on).toBe(false);
  });

  it("migrates legacy individual settings into the Avery profile", async () => {
    const legacyFields = normalizeFields(null);
    legacyFields.artist.on = false;
    localStorageMock.data["discogs-labeler.fields"] = JSON.stringify(legacyFields);

    await openAppPreview();
    await click(findButton("Fields", true));

    expect(pressed("artist")).toBe("false");
    const saved = JSON.parse(localStorageMock.data["discogs-labeler.profiles"]);
    expect(saved["avery-3448"].fields.artist.on).toBe(false);
  });
});
