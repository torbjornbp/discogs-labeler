import {
  normalizeCol2Fields,
  normalizeFieldOrder,
  normalizeFields,
} from "./fields.js";

export const MIN_FONT_SCALE = 0.6;
export const MAX_FONT_SCALE = 2;
export const DEFAULT_FONT_SCALE = 1;

export const MIN_PRICE_SCALE = 0.8;
export const MAX_PRICE_SCALE = 2.5;
export const DEFAULT_PRICE_SCALE = 1;

export const MIN_QR_SCALE = 0.5;
export const MAX_QR_SCALE = 1.5;
export const DEFAULT_QR_SCALE = 0.65;

export const DEFAULT_PAD = { t: 3.2, r: 4.5, b: 1.2, l: 4.5 };

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

// Clamp a numeric setting, treating missing/invalid values as the fallback.
// Strings are accepted (range inputs) but booleans, objects, null, and blank
// strings are not.
export function clamp(value, min, max, fallback) {
  if (typeof value !== "number" && typeof value !== "string") return fallback;
  if (typeof value === "string" && value.trim() === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(max, Math.max(min, number))
    : fallback;
}

export function normalizePad(value) {
  const pad = isRecord(value) ? value : {};
  return {
    t: clamp(pad.t, 0, 10, DEFAULT_PAD.t),
    r: clamp(pad.r, 0, 10, DEFAULT_PAD.r),
    b: clamp(pad.b, 0, 10, DEFAULT_PAD.b),
    l: clamp(pad.l, 0, 10, DEFAULT_PAD.l),
  };
}

function maxQrScaleFor(template) {
  const max = Number(template?.maxQrScale);
  if (!Number.isFinite(max) || max <= 0) return MAX_QR_SCALE;
  return Math.max(MIN_QR_SCALE, max);
}

// A fresh profile (including fresh nested objects) for the given template.
export function createDefaultProfile(template) {
  return {
    fields: normalizeFields(null),
    fieldOrder: normalizeFieldOrder(null),
    fontScale: DEFAULT_FONT_SCALE,
    priceScale: DEFAULT_PRICE_SCALE,
    qrScale: clamp(
      DEFAULT_QR_SCALE,
      MIN_QR_SCALE,
      maxQrScaleFor(template),
      DEFAULT_QR_SCALE
    ),
    pad: { ...DEFAULT_PAD },
    layoutMode: "single",
    col2Fields: new Set(normalizeCol2Fields(null)),
  };
}

// Merge a persisted profile over the defaults, dropping invalid values. The
// template supplies the QR size ceiling, so switching templates can never
// restore a QR scale that is too large for the label.
export function normalizeProfile(saved, template) {
  const defaults = createDefaultProfile(template);
  if (!isRecord(saved)) return defaults;

  const col2Source =
    saved.col2Fields instanceof Set ? [...saved.col2Fields] : saved.col2Fields;

  return {
    fields: normalizeFields(saved.fields),
    fieldOrder: normalizeFieldOrder(saved.fieldOrder),
    fontScale: clamp(
      saved.fontScale,
      MIN_FONT_SCALE,
      MAX_FONT_SCALE,
      defaults.fontScale
    ),
    priceScale: clamp(
      saved.priceScale,
      MIN_PRICE_SCALE,
      MAX_PRICE_SCALE,
      defaults.priceScale
    ),
    qrScale: clamp(
      saved.qrScale,
      MIN_QR_SCALE,
      maxQrScaleFor(template),
      defaults.qrScale
    ),
    pad: normalizePad(saved.pad),
    layoutMode: saved.layoutMode === "twoColumn" ? "twoColumn" : "single",
    col2Fields: new Set(normalizeCol2Fields(col2Source)),
  };
}

// localStorage can't hold Sets, so convert each profile's col2Fields to an
// array (normalised to drop unknown/duplicate keys) before persisting.
export function serializeProfiles(profiles) {
  if (!isRecord(profiles)) return {};
  const result = {};
  for (const [id, profile] of Object.entries(profiles)) {
    if (!isRecord(profile)) continue;
    const source =
      profile.col2Fields instanceof Set
        ? [...profile.col2Fields]
        : profile.col2Fields;
    result[id] = {
      ...profile,
      col2Fields: normalizeCol2Fields(source),
    };
  }
  return result;
}
