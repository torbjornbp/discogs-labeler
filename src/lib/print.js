import { FONT_FAMILY, QR_BASE_MM } from "./templates.js";
import { FIELD_STYLES, FIELD_VALUE } from "./fields.js";
import { LABEL_LAYOUT } from "./layout.js";
import { paginateReleases } from "./pagination.js";
import { prepareQrCodes, qrDataUrl } from "./qr.js";

const esc = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

function buildTextField(key, release, tracklist, fields, fmm, pricePrefix = "") {
  if (!fields[key]?.on) return "";

  const style = FIELD_STYLES[key] || {};

  if (key === "priceWriteIn") {
    const color = style.color || "#111";
    const fontFamily = style.mono ? "monospace" : FONT_FAMILY;
    return `<div style="display:flex;align-items:center;gap:${LABEL_LAYOUT.fieldGapMm}mm;font-size:${fmm(style.mmSize || 2)}mm;font-weight:${style.weight || 400};font-family:${fontFamily};color:${color};line-height:1.25;white-space:nowrap;overflow:hidden;flex-shrink:0;${style.italic ? "font-style:italic;" : ""}${style.mono ? "letter-spacing:0.02em;" : ""}"><span>Price:</span><span aria-hidden="true" style="display:inline-block;flex-shrink:0;width:${LABEL_LAYOUT.writeInLineMm}mm;height:1em;border-bottom:${LABEL_LAYOUT.writeInBorderMm}mm solid ${color};"></span></div>`;
  }

  const value = key === "tracklist" ? tracklist : FIELD_VALUE(release, key, pricePrefix);
  if (!value) return "";

  if (key === "tracklist") {
    const lines = value.slice(0, style.clamp || 20);
    if (!lines.length) return "";
    const showDuration = Boolean(fields.tracklist?.showDuration);
    const linesHtml = lines.map(({ pos, title, duration }) => {
      const label = esc(pos ? `${pos} ${title}` : title);
      const durationHtml = showDuration && duration
        ? `<div style="flex-shrink:0;padding-left:1mm;opacity:0.7;">(${esc(duration)})</div>`
        : "";
      return `<div style="display:flex;align-items:baseline;font-size:${fmm(style.mmSize || 1.6)}mm;font-family:monospace;letter-spacing:0.02em;color:${style.color || "#555"};line-height:1.3;flex-shrink:0;"><div style="flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${label}</div>${durationHtml}</div>`;
    }).join("");
    return `<div style="overflow:hidden;flex-shrink:0;">${linesHtml}</div>`;
  }

  const fontFamily = style.mono ? "monospace" : FONT_FAMILY;
  const notesPrefix = key === "notes"
    ? '<span style="font-weight:700;font-style:normal;">Notes: </span>'
    : "";
  return `<div style="font-size:${fmm(style.mmSize || 2)}mm;font-weight:${style.weight || 400};font-family:${fontFamily};color:${style.color || "#888"};line-height:1.25;overflow:hidden;display:-webkit-box;-webkit-line-clamp:${style.clamp || 1};-webkit-box-orient:vertical;${style.italic ? "font-style:italic;" : ""}${style.mono ? "letter-spacing:0.02em;" : ""}flex-shrink:0;">${notesPrefix}${esc(value)}</div>`;
}

// Generates the HTML string for a single label.
function buildLabel(release, opts) {
  const {
    template, fields, fieldOrder, pad, fontScale, qrScale,
    layoutMode, tracklistMap, col2Fields, preparedQrCodes, pricePrefix = "",
  } = opts;

  if (!release) {
    return `<div style="width:${template.labelWmm}mm;height:${template.labelHmm}mm;"></div>`;
  }

  const fmm = (n) => (n * (fontScale || 1)).toFixed(2);
  const showQr = fieldOrder.includes("qr") && Boolean(fields.qr?.on);
  const qr = showQr
    ? preparedQrCodes?.has(release.url)
      ? preparedQrCodes.get(release.url)
      : qrDataUrl(release.url)
    : "";
  const qrSizeMm = (QR_BASE_MM * (qrScale || 1)).toFixed(1);
  const tracklist = tracklistMap?.[release.releaseId] || [];
  const qrHtml = qr
    ? `<div style="flex-shrink:0;"><img src="${qr}" alt="" style="display:block;width:${qrSizeMm}mm;height:${qrSizeMm}mm;" /></div>`
    : "";

  const outerStyle =
    `width:${template.labelWmm}mm;height:${template.labelHmm}mm;` +
    `display:flex;flex-direction:row;align-items:flex-start;` +
    `padding:${pad.t}mm ${pad.r}mm ${pad.b}mm ${pad.l}mm;` +
    `box-sizing:border-box;gap:${LABEL_LAYOUT.qrGapMm}mm;background:#fff;overflow:hidden;`;
  const contentH = `${(template.labelHmm - pad.t - pad.b).toFixed(2)}mm`;

  if (layoutMode === "twoColumn") {
    const col2 = col2Fields ? [...col2Fields] : ["tracklist"];
    const col1Keys = fieldOrder.filter((key) => key !== "qr" && !col2.includes(key));
    const col2Keys = fieldOrder.filter((key) => col2.includes(key));
    const col1Html = col1Keys.map((key) => buildTextField(key, release, tracklist, fields, fmm, pricePrefix)).join("");
    const col2Html = col2Keys.map((key) => buildTextField(key, release, tracklist, fields, fmm, pricePrefix)).join("");
    const hasCol2 = col2Keys.some((key) => fields[key]?.on);
    const col2HtmlBlock = hasCol2
      ? `<div style="flex:1;min-width:0;border-left:${LABEL_LAYOUT.twoColBorderMm}mm solid #e0e0e0;padding-left:${LABEL_LAYOUT.twoColPaddingMm}mm;overflow:hidden;display:flex;flex-direction:column;gap:${LABEL_LAYOUT.fieldGapMm}mm;max-height:${contentH};">${col2Html}</div>`
      : "";
    return `<div style="${outerStyle}">${qrHtml}<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:${LABEL_LAYOUT.fieldGapMm}mm;max-height:${contentH};overflow:hidden;">${col1Html}</div>${col2HtmlBlock}</div>`;
  }

  const textFields = fieldOrder
    .filter((key) => key !== "qr")
    .map((key) => buildTextField(key, release, tracklist, fields, fmm, pricePrefix))
    .join("");

  return `<div style="${outerStyle}">${qrHtml}<div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:flex-start;gap:${LABEL_LAYOUT.fieldGapMm}mm;max-height:${contentH};overflow:hidden;">${textFields}</div></div>`;
}

export function buildDocument({
  selectedReleases = [],
  template,
  fields,
  fieldOrder,
  pad,
  fontScale,
  qrScale,
  layoutMode,
  tracklistMap,
  col2Fields,
  preparedQrCodes,
  pricePrefix = "",
  startCell = 0,
}) {
  const perSheet = template.cols * template.rows;
  const pages = paginateReleases(selectedReleases, perSheet, startCell);
  const opts = {
    template, fields, fieldOrder, pad, fontScale, qrScale,
    layoutMode, tracklistMap, col2Fields, preparedQrCodes, pricePrefix,
  };

  let sheetsHtml = "";
  pages.forEach((sheetReleases, sheet) => {
    const pageBreak = sheet < pages.length - 1
      ? "page-break-after:always;break-after:page;"
      : "";
    sheetsHtml += `
      <div style="width:${template.pageWmm}mm;height:${template.pageHmm}mm;background:#fff;padding-top:${template.marginTopMm}mm;padding-left:${template.marginLeftMm}mm;box-sizing:border-box;overflow:hidden;break-inside:avoid;${pageBreak}">
        <div style="display:grid;grid-template-columns:repeat(${template.cols},${template.labelWmm}mm);grid-template-rows:repeat(${template.rows},${template.labelHmm}mm);gap:0;">
          ${sheetReleases.map((release) => buildLabel(release, opts)).join("")}
        </div>
      </div>`;
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Discogs Label Sheets</title>
  <style>
    @font-face {
      font-family: 'Iosevka Aile';
      src: url('https://torbjorn.no/fonts/IosevkaCustomAile-Regular-reducedmore.woff2') format('woff2');
      font-weight: normal;
      font-style: normal;
    }
    @font-face {
      font-family: 'Iosevka Aile';
      src: url('https://torbjorn.no/fonts/IosevkaCustomAile-Bold-reducedmore.woff2') format('woff2');
      font-weight: 700;
      font-style: normal;
    }
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { width:${template.pageWmm}mm; background:#fff; font-family:${FONT_FAMILY}; }
    @page { size:${template.pageWmm}mm ${template.pageHmm}mm; margin:0; }
    @media print { html, body { margin:0; } }
    html { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  </style>
</head>
<body>${sheetsHtml}</body>
</html>`;
}

const PRINT_WAIT_MS = 10000;

// Race a promise against a timeout without leaving a timer (or rejection)
// behind after the promise settles.
function withTimeout(promise, ms) {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, ms);
    Promise.resolve(promise).then(done, done);
  });
}

const PROGRESS_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Preparing Labels…</title>
  <style>
    html, body { height:100%; margin:0; }
    body { display:flex; align-items:center; justify-content:center; background:#fff; color:#555; font-family:Arial, sans-serif; font-size:14px; }
    #print-status { max-width:80%; text-align:center; }
  </style>
</head>
<body><p id="print-status" role="status">Preparing labels…</p></body>
</html>`;

// Opens the print window synchronously (to stay inside the click's popup
// permission), shows progress while QR codes are generated in chunks, then
// writes the final document and prints once fonts/images are ready.
export function openPrintWindow(options) {
  if (!options.selectedReleases?.length) return false;

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    window.alert("Popup blocked — please allow popups for this page and try again.");
    return false;
  }

  try {
    win.document.open();
    win.document.write(PROGRESS_HTML);
    win.document.close();
  } catch (err) {
    console.error("Could not open print window:", err);
    try { win.close(); } catch { /* already closed */ }
    window.alert("Could not prepare the print window. Please try again.");
    return false;
  }

  const needsQr =
    options.fieldOrder.includes("qr") && Boolean(options.fields.qr?.on);
  const urls = needsQr ? options.selectedReleases.map((release) => release.url) : [];

  const updateProgress = (done, total) => {
    try {
      win.document.title = "Preparing Labels…";
      const status = win.document.getElementById("print-status");
      if (status) {
        status.textContent = total
          ? `Preparing labels… ${done} / ${total}`
          : "Preparing labels…";
      }
    } catch {
      // The user may have closed the window while we were preparing.
    }
  };

  const waitForReady = async () => {
    if (win.closed) return;

    const images = Array.from(win.document.images || []);
    await withTimeout(
      Promise.all(images.map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()))),
      PRINT_WAIT_MS
    );

    if (win.closed) return;
    const fontsReady = win.document.fonts?.ready ?? Promise.resolve();
    await withTimeout(fontsReady.catch(() => {}), PRINT_WAIT_MS);
  };

  const run = async () => {
    const preparedQrCodes = await prepareQrCodes(urls, updateProgress, () => !win.closed);
    if (win.closed) return;

    win.document.open();
    win.document.write(buildDocument({ ...options, preparedQrCodes }));
    win.document.close();

    await waitForReady();
    if (win.closed) return;

    win.focus();
    win.print();
  };

  run().catch((err) => {
    console.error("Could not prepare print document:", err);
    try {
      const status = win.document.getElementById("print-status");
      if (status) status.textContent = "Could not prepare the labels. Close this tab and try again.";
    } catch {
      // The window was closed.
    }
  });

  return true;
}
