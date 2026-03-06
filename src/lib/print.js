import { QR_API_PRINT } from "./templates.js";
import { FIELD_STYLES, FIELD_VALUE } from "./fields.js";

function buildTextField(key, r, tracklist, fields, fmm) {
  if (!fields[key]?.on) return "";
  const val = key === "tracklist" ? tracklist : FIELD_VALUE(r, key);
  if (!val) return "";
  const s = FIELD_STYLES[key] || {};
  const fontFamily = s.mono ? "monospace" : "'Inter',sans-serif";
  const notesPrefix = key === "notes" ? '<span style="font-weight:700;font-style:normal;">Notes: </span>' : "";
  return `<div style="font-size:${fmm(s.mmSize || 2)}mm;font-weight:${s.weight || 400};font-family:${fontFamily};color:${s.color || "#888"};line-height:1.25;overflow:hidden;display:-webkit-box;-webkit-line-clamp:${s.clamp || 1};-webkit-box-orient:vertical;${s.italic ? "font-style:italic;" : ""}">${notesPrefix}${val}</div>`;
}

function buildLabel(r, { template, fields, fieldOrder, pad, fontScale, qrScale, layoutMode, tracklistMap }) {
  if (!r) return `<div style="width:${template.labelWmm}mm;height:${template.labelHmm}mm;"></div>`;

  const qr = QR_API_PRINT(r.url);
  const fmm = (n) => (n * (fontScale || 1)).toFixed(2);
  const showQR = fieldOrder.includes("qr") && fields.qr.on;
  const qrSizeMm = (20 * (qrScale || 1)).toFixed(1);
  const tracklist = tracklistMap?.[r.releaseId] || "";
  const showTracklist = fields.tracklist?.on;
  const qrHTML = showQR ? `<div style="flex-shrink:0;"><img src="${qr}" style="display:block;width:${qrSizeMm}mm;height:${qrSizeMm}mm;" /></div>` : "";
  const outerStyle = `width:${template.labelWmm}mm;height:${template.labelHmm}mm;display:flex;flex-direction:row;align-items:flex-start;padding:${pad.t}mm ${pad.r}mm ${pad.b}mm ${pad.l}mm;box-sizing:border-box;gap:1.5mm;background:#fff;overflow:hidden;`;

  if (layoutMode === "twoColumn") {
    const mainFields = fieldOrder
      .filter((k) => k !== "qr" && k !== "tracklist")
      .map((key) => buildTextField(key, r, tracklist, fields, fmm))
      .join("");
    const qrHTML = showQR ? `<div style="flex-shrink:0;"><img src="${qr}" style="display:block;width:${qrSizeMm}mm;height:${qrSizeMm}mm;" /></div>` : "";
    const tracklistLines = tracklist
      ? tracklist.split("\n").map((line) => `<div style="font-size:${fmm(1.6)}mm;font-family:monospace;color:#555;line-height:1.3;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${line}</div>`).join("")
      : `<div style="font-size:${fmm(1.4)}mm;color:#ccc;font-style:italic;">—</div>`;
    const tracklistCol = showTracklist
      ? `<div style="flex:1;min-width:0;border-left:0.3mm solid #e0e0e0;padding-left:1.5mm;overflow:hidden;">${tracklistLines}</div>`
      : "";
    return `<div style="${outerStyle}">${qrHTML}<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:0.4mm;">${mainFields}</div>${tracklistCol}</div>`;
  }

  // Standard layout
  const textFields = fieldOrder
    .filter((k) => k !== "qr")
    .map((key) => buildTextField(key, r, tracklist, fields, fmm))
    .join("");
  return `<div style="${outerStyle}">${qrHTML}<div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:flex-start;gap:0.5mm;">${textFields}</div></div>`;
}

export function openPrintWindow({ selectedReleases, template, fields, fieldOrder, pad, fontScale, qrScale, layoutMode, tracklistMap }) {
  const size = template.cols * template.rows;
  const sheetsCount = Math.ceil(selectedReleases.length / size);
  const opts = { template, fields, fieldOrder, pad, fontScale, qrScale, layoutMode, tracklistMap };

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
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { width:210mm; background:#fff; }
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
  win.onload = () => {
    const imgs = win.document.images;
    let loaded = 0;
    const total = imgs.length;
    const done = () => { win.print(); URL.revokeObjectURL(url); };
    if (total === 0) { done(); return; }
    const tryPrint = () => { if (++loaded >= total) done(); };
    Array.from(imgs).forEach((img) => {
      if (img.complete) tryPrint();
      else { img.onload = tryPrint; img.onerror = tryPrint; }
    });
  };
}
