import { MM } from "./templates.js";

// Typography is defined once in mm. `size` is derived for the preview so the
// React preview and print output have identical physical proportions.
const style = (mmSize, opts = {}) => ({
  mmSize,
  size: Number((mmSize * MM).toFixed(2)),
  ...opts,
});

export const FIELD_STYLES = {
  artist:     style(2.8, { weight: 700, color: "#111", clamp: 2, italic: false, mono: false }),
  title:      style(2.5, { weight: 400, color: "#333", clamp: 2, italic: true,  mono: false }),
  year:       style(2.2, { weight: 400, color: "#666", clamp: 1, italic: false, mono: false }),
  format:     style(2.2, { weight: 400, color: "#666", clamp: 1, italic: false, mono: false }),
  catno:      style(2.0, { weight: 400, color: "#888", clamp: 1, italic: false, mono: true  }),
  price:      style(2.0, { weight: 400, color: "#111", clamp: 1, italic: false, mono: false }),
  priceWriteIn: style(2.0, { weight: 400, color: "#111", clamp: 1, italic: false, mono: false }),
  label:      style(2.0, { weight: 400, color: "#888", clamp: 1, italic: false, mono: false }),
  mediaCond:  style(2.0, { weight: 400, color: "#888", clamp: 1, italic: false, mono: false }),
  sleeveCond: style(2.0, { weight: 400, color: "#777", clamp: 1, italic: false, mono: false }),
  notes:      style(1.8, { weight: 400, color: "#111", clamp: 2, italic: false, mono: false }),
  folder:     style(1.8, { weight: 400, color: "#888", clamp: 1, italic: false, mono: false }),
  rating:     style(2.8, { weight: 400, color: "#111", clamp: 1, italic: false, mono: false }),
  tracklist:  style(1.6, { weight: 400, color: "#555", clamp: 20, italic: false, mono: true  }),
};

export const starsText = (value) => {
  const n = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
  return "★".repeat(n) + "☆".repeat(5 - n);
};

// Keep the imported price text exactly as provided (no number parsing or
// locale formatting) and only prepend the configured currency prefix.
export const formatPrice = (value, pricePrefix = "") => {
  if (value === undefined || value === null || value === "") return "";
  return `${pricePrefix}${value}`;
};

export const FIELD_VALUE = (r, key, pricePrefix = "") => {
  const v = {
    artist: r.artist,
    title: r.title,
    year: r.year,
    format: r.format,
    catno: r.catno === "none" ? "" : r.catno,
    price: r.price === undefined || r.price === null || r.price === ""
      ? ""
      : `Price: ${formatPrice(r.price, pricePrefix)}`,
    label: r.label,
    mediaCond: r.mediaCond,
    sleeveCond: r.sleeveCond,
    notes: r.notes,
    folder: r.folder,
    rating: r.rating ? starsText(r.rating) : "",
  };
  return v[key] || "";
};

// Fields that only exist in CSV exports. Rating is available from the API too;
// price is available from inventory exports.
export const csvOnlyCols = ["mediaCond", "sleeveCond", "notes", "folder", "price"];

export const COLUMNS = [
  { label: "Artist",           key: "artist"     },
  { label: "Title",            key: "title"      },
  { label: "Year",             key: "year"       },
  { label: "Format",           key: "format"     },
  { label: "Cat No.",          key: "catno"      },
  { label: "Price",            key: "price"      },
  { label: "Label",            key: "label"      },
  { label: "Date Added",       key: "dateAdded"  },
  { label: "Media Condition",  key: "mediaCond"  },
  { label: "Sleeve Condition", key: "sleeveCond" },
  { label: "Folder",           key: "folder"     },
  { label: "Notes",            key: "notes"      },
  { label: "Rating",           key: "rating"     },
];

export const DEFAULT_FIELDS = {
  qr:         { label: "QR Code",          on: true  },
  artist:     { label: "Artist",           on: true  },
  title:      { label: "Title",            on: true  },
  year:       { label: "Year",             on: false },
  format:     { label: "Format",           on: false },
  catno:      { label: "Cat No.",          on: true  },
  price:      { label: "Price",            on: false },
  priceWriteIn: { label: "Price (write-in)", on: false },
  label:      { label: "Label",            on: false },
  mediaCond:  { label: "Media Condition",  on: false },
  sleeveCond: { label: "Sleeve Condition", on: false },
  notes:      { label: "Notes",            on: false },
  folder:     { label: "Folder",           on: false },
  rating:     { label: "Rating",           on: false },
  tracklist:  { label: "Tracklist",        on: false, showDuration: true },
};

export const FIELD_KEYS = Object.keys(DEFAULT_FIELDS);

export const DEFAULT_FIELD_ORDER = [
  "qr", "artist", "title", "year", "format", "catno", "price", "priceWriteIn",
  "label", "mediaCond", "sleeveCond", "notes", "folder", "rating", "tracklist",
];

const isRecord = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

// Merge persisted settings over the defaults, ignoring unknown keys and
// invalid values. This keeps a stale/corrupt localStorage entry from crashing
// the app.
export function normalizeFields(saved) {
  const result = {};
  for (const [key, def] of Object.entries(DEFAULT_FIELDS)) {
    const next = { ...def };
    if (isRecord(saved) && isRecord(saved[key])) {
      if (typeof saved[key].on === "boolean") next.on = saved[key].on;
      if (typeof saved[key].showDuration === "boolean") next.showDuration = saved[key].showDuration;
      if (typeof saved[key].label === "string") next.label = saved[key].label;
    }
    result[key] = next;
  }
  return result;
}

export function normalizeFieldOrder(saved) {
  const valid = Array.isArray(saved)
    ? saved.filter((key) => FIELD_KEYS.includes(key))
    : [];
  const seen = new Set();
  return [...valid, ...DEFAULT_FIELD_ORDER].filter((key) => {
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizeCol2Fields(saved) {
  const source = Array.isArray(saved) ? saved : ["tracklist"];
  const seen = new Set();
  return source.filter((key) => {
    if (key === "qr" || !FIELD_KEYS.includes(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
