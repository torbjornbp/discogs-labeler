import { QR_API_PRINT, FONT_FAMILY, QR_BASE_MM } from "./templates.js";
import { FIELD_STYLES, FIELD_VALUE } from "./fields.js";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function buildTextField(key, r, tracklist, fields, fmm) {
  if (!fields[key]?.on) return "";
  const val = key === "tracklist" ? tracklist : FIELD_VALUE(r, key);
  if (!val) return "";
  const s = FIELD_STYLES[key] || {};
  if (key === "tracklist") {
    if (!val.length) return "";
    const showDur = fields.tracklist?.showDuration;
    return val.map(({ pos, title, duration }) => {
      const label = esc(pos ? `${pos} ${title}` : title);
      const dur = showDur && duration
        ? `<div style="flex-shrink:0;padding-left:1mm;opacity:0.7;">(${esc(duration)})</div>`
        : "";
      return `<div style="display:flex;align-items:baseline;font-size:${fmm(s.mmSize || 1.6)}mm;font-family:monospace;color:${s.color || "#555"};line-height:1.3;flex-shrink:0;"><div style="flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${label}</div>${dur}</div>`;
    }).join("");
  }
  const fontFamily = s.mono ? "monospace" : FONT_FAMILY;
  const notesPrefix = key === "notes" ? '<span style="font-weight:700;font-style:normal;">Notes: </span>' : "";
  return `<div style="font-size:${fmm(s.mmSize || 2)}mm;font-weight:${s.weight || 400};font-family:${fontFamily};color:${s.color || "#888"};line-height:1.25;overflow:hidden;display:-webkit-box;-webkit-line-clamp:${s.clamp || 1};-webkit-box-orient:vertical;${s.italic ? "font-style:italic;" : ""}flex-shrink:0;">${notesPrefix}${esc(val)}</div>`;
}

// Generates the HTML string for a single label.
// col2Fields (Set) determines which fields go in the right column in twoColumn mode.
// contentH clamps each column to the padded content area so bottom padding is respected
// and overflow is clipped cleanly rather than shrinking/overlapping field items.
function buildLabel(r, { template, fields, fieldOrder, pad, fontScale, qrScale, layoutMode, tracklistMap, col2Fields }) {
  if (!r) return `<div style="width:${template.labelWmm}mm;height:${template.labelHmm}mm;"></div>`;

  const qr = QR_API_PRINT(r.url);
  const fmm = (n) => (n * (fontScale || 1)).toFixed(2);
  const showQR = fieldOrder.includes("qr") && fields.qr.on;
  const qrSizeMm = (QR_BASE_MM * (qrScale || 1)).toFixed(1);
  const tracklist = tracklistMap?.[r.releaseId] || [];
  const qrHTML = showQR ? `<div style="flex-shrink:0;"><img src="${qr}" style="display:block;width:${qrSizeMm}mm;height:${qrSizeMm}mm;" /></div>` : "";
  const outerStyle = `width:${template.labelWmm}mm;height:${template.labelHmm}mm;display:flex;flex-direction:row;align-items:flex-start;padding:${pad.t}mm ${pad.r}mm ${pad.b}mm ${pad.l}mm;box-sizing:border-box;gap:1.5mm;background:#fff;overflow:hidden;`;

  if (layoutMode === "twoColumn") {
    const col2 = col2Fields ? [...col2Fields] : ["tracklist"];
    const col1Keys = fieldOrder.filter((k) => k !== "qr" && !col2.includes(k));
    const col2Keys = fieldOrder.filter((k) => col2.includes(k));
    const col1Html = col1Keys.map((key) => buildTextField(key, r, tracklist, fields, fmm)).join("");
    const col2Html = col2Keys.map((key) => buildTextField(key, r, tracklist, fields, fmm)).join("");
    const hasCol2 = col2Keys.some((k) => fields[k]?.on);
    const contentH = `${(template.labelHmm - pad.t - pad.b).toFixed(2)}mm`;
    const col2Col = hasCol2
      ? `<div style="flex:1;min-width:0;border-left:0.3mm solid #e0e0e0;padding-left:1.5mm;overflow:hidden;display:flex;flex-direction:column;gap:0.4mm;max-height:${contentH};">${col2Html}</div>`
      : "";
    return `<div style="${outerStyle}">${qrHTML}<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:0.4mm;max-height:${contentH};overflow:hidden;">${col1Html}</div>${col2Col}</div>`;
  }

  // Standard layout
  const textFields = fieldOrder
    .filter((k) => k !== "qr")
    .map((key) => buildTextField(key, r, tracklist, fields, fmm))
    .join("");
  const contentH = `${(template.labelHmm - pad.t - pad.b).toFixed(2)}mm`;
  return `<div style="${outerStyle}">${qrHTML}<div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:flex-start;gap:0.5mm;max-height:${contentH};overflow:hidden;">${textFields}</div></div>`;
}

export function openPrintWindow({ selectedReleases, template, fields, fieldOrder, pad, fontScale, qrScale, layoutMode, tracklistMap, col2Fields }) {
  const size = template.cols * template.rows;
  const sheetsCount = Math.ceil(selectedReleases.length / size);
  const opts = { template, fields, fieldOrder, pad, fontScale, qrScale, layoutMode, tracklistMap, col2Fields };

  let sheetsHTML = "";
  for (let s = 0; s < sheetsCount; s++) {
    const sheetReleases = selectedReleases.slice(s * size, (s + 1) * size);
    while (sheetReleases.length < size) sheetReleases.push(null);
    const pageBreak = s < sheetsCount - 1 ? "page-break-after:always;" : "";
    sheetsHTML += `
      <div style="width:${template.pageWmm}mm;height:${template.pageHmm}mm;background:#fff;padding-top:${template.marginTopMm}mm;padding-left:${template.marginLeftMm}mm;box-sizing:border-box;overflow:hidden;${pageBreak}">
        <div style="display:grid;grid-template-columns:repeat(${template.cols},${template.labelWmm}mm);grid-template-rows:repeat(${template.rows},${template.labelHmm}mm);gap:0;">
          ${sheetReleases.map((r) => buildLabel(r, opts)).join("")}
        </div>
      </div>`;
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
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
    html, body { width:210mm; background:#fff; font-family: ${FONT_FAMILY}; }
    @page { size: A4 portrait; margin: 0mm; }
    @media print { html, body { margin: 0; } }
  </style>
</head>
<body>${sheetsHTML}</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank", "width=900,height=700");
  if (!win) { URL.revokeObjectURL(url); alert("Popup blocked — please allow popups for this page and try again."); return; }

  let revoked = false;
  const cleanup = () => { if (!revoked) { revoked = true; URL.revokeObjectURL(url); } };

  const afterLoad = () => {
    const waitForImages = () => new Promise((resolve) => {
      const imgs = win.document.images;
      let loaded = 0;
      const total = imgs.length;
      if (total === 0) { resolve(); return; }
      const check = () => { if (++loaded >= total) resolve(); };
      Array.from(imgs).forEach((img) => {
        if (img.complete) check();
        else { img.onload = check; img.onerror = check; }
      });
    });
    const waitForFonts = () => win.document.fonts.ready;
    Promise.all([waitForImages(), waitForFonts()]).then(() => { win.print(); cleanup(); });
  };

  win.addEventListener("beforeunload", cleanup);
  if (win.document.readyState === "complete") afterLoad();
  else win.onload = afterLoad;
}
