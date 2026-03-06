export const DISCOGS_API = "https://api.discogs.com";

export const QR_API = (data) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(data)}&bgcolor=ffffff&color=111111&margin=2`;

export const QR_API_PRINT = (data) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(data)}&bgcolor=ffffff&color=111111&margin=2`;

const MM = 3.7795;

function makeTemplate(t) {
  return {
    ...t,
    labelW:    t.labelWmm    * MM,
    labelH:    t.labelHmm    * MM,
    pageW:     t.pageWmm     * MM,
    pageH:     t.pageHmm     * MM,
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
];
