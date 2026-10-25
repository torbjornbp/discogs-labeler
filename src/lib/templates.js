export const DISCOGS_API = "https://api.discogs.com";

export const FONT_FAMILY = "'Iosevka Aile', Arial, sans-serif";

export const MM = 3.7795; // CSS px per mm at 96dpi

export const QR_BASE_MM = 20; // printed QR size in mm
export const QR_BASE_PX = QR_BASE_MM * MM;

export const mmToPx = (mm) => mm * MM;

export function makeTemplate(t) {
  return {
    maxQrScale: 1.5,
    ...t,
    labelW: t.labelWmm * MM,
    labelH: t.labelHmm * MM,
    pageW: t.pageWmm * MM,
    pageH: t.pageHmm * MM,
    marginTop: t.marginTopMm * MM,
    marginLeft: t.marginLeftMm * MM,
  };
}

export const TEMPLATES = [
  makeTemplate({
    id: "avery-3448",
    name: "Avery 3448",
    description: "70 × 37 mm · 24 per sheet · A4",
    cols: 3,
    rows: 8,
    labelWmm: 70,
    labelHmm: 37,
    pageWmm: 210,
    pageHmm: 297,
    marginTopMm: 0.5,
    marginLeftMm: 0,
  }),
  makeTemplate({
    id: "brother-dk1201",
    name: "Brother DK-1201 (experimental)",
    description: "90.3 × 29 mm · 1 per page",
    cols: 1,
    rows: 1,
    labelWmm: 90.3,
    labelHmm: 29,
    pageWmm: 90.3,
    pageHmm: 29,
    marginTopMm: 0,
    marginLeftMm: 0,
    maxQrScale: 1.0,
  }),
];
