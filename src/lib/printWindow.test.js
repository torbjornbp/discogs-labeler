import { afterEach, describe, expect, it, vi } from "vitest";
import { TEMPLATES } from "./templates.js";
import { normalizeFieldOrder, normalizeFields } from "./fields.js";
import { openPrintWindow } from "./print.js";

const release = {
  id: 1,
  releaseId: 1,
  title: "Title",
  artist: "Artist",
  year: 1999,
  label: "Label",
  catno: "CAT 1",
  format: "Vinyl",
  url: "https://www.discogs.com/release/1",
  rating: 0,
};

const options = {
  selectedReleases: [release],
  template: TEMPLATES[0],
  fields: normalizeFields(null),
  fieldOrder: normalizeFieldOrder(null),
  pad: { t: 3.2, r: 4.5, b: 1.2, l: 4.5 },
  fontScale: 1,
  qrScale: 0.65,
  layoutMode: "single",
  tracklistMap: {},
  col2Fields: new Set(["tracklist"]),
};

function fakePrintWindow({ writeError = false } = {}) {
  const written = [];
  const print = vi.fn();
  const close = vi.fn();
  const status = { textContent: "" };
  const win = {
    closed: false,
    document: {
      open: vi.fn(),
      write: vi.fn((html) => {
        if (writeError) throw new Error("write failed");
        written.push(html);
      }),
      close: vi.fn(),
      images: [],
      fonts: { ready: Promise.resolve() },
      title: "",
      getElementById: vi.fn(() => status),
    },
    focus: vi.fn(),
    print,
    close,
  };
  return { win, written, print, close, status };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("openPrintWindow", () => {
  it("opens a progress window, writes the final document, and prints", async () => {
    const { win, written, print, status } = fakePrintWindow();
    const alert = vi.fn();
    vi.stubGlobal("window", { open: vi.fn(() => win), alert });

    expect(openPrintWindow(options)).toBe(true);
    expect(written[0]).toContain("Preparing labels");

    await vi.waitFor(() => {
      expect(written.some((html) => html.includes("Discogs Label Sheets"))).toBe(true);
    });
    await vi.waitFor(() => expect(print).toHaveBeenCalledTimes(1));

    expect(status.textContent).toMatch(/Preparing labels/);
    expect(win.focus).toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
  });

  it("alerts and returns false when the popup is blocked", () => {
    const alert = vi.fn();
    vi.stubGlobal("window", { open: vi.fn(() => null), alert });

    expect(openPrintWindow(options)).toBe(false);
    expect(alert).toHaveBeenCalledWith(expect.stringMatching(/popup/i));
  });

  it("handles a failure while writing the document", () => {
    const { win, close } = fakePrintWindow({ writeError: true });
    const alert = vi.fn();
    vi.stubGlobal("window", { open: vi.fn(() => win), alert });

    expect(openPrintWindow(options)).toBe(false);
    expect(close).toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith(expect.stringMatching(/prepare the print window/i));
  });

  it("does nothing when there are no releases", () => {
    const open = vi.fn();
    vi.stubGlobal("window", { open, alert: vi.fn() });

    expect(openPrintWindow({ ...options, selectedReleases: [] })).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  it("does not print if the user closes the window while waiting", async () => {
    const { win, print } = fakePrintWindow();
    win.closed = true;
    const alert = vi.fn();
    vi.stubGlobal("window", { open: vi.fn(() => win), alert });

    expect(openPrintWindow(options)).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(print).not.toHaveBeenCalled();
  });
});
