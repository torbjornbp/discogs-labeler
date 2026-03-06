// size: preview font size in px
// mmSize: print font size in mm
// These are the single source of truth for both LabelCell (preview) and print.js (print output).
export const FIELD_STYLES = {
  artist:     { size: 9.5, mmSize: 2.8, weight: 700, color: "#111", clamp: 2, italic: false, mono: false },
  title:      { size: 8.5, mmSize: 2.5, weight: 400, color: "#333", clamp: 2, italic: true,  mono: false },
  year:       { size: 7.5, mmSize: 2.2, weight: 400, color: "#666", clamp: 1, italic: false, mono: false },
  format:     { size: 7.5, mmSize: 2.2, weight: 400, color: "#666", clamp: 1, italic: false, mono: false },
  catno:      { size: 7,   mmSize: 2.0, weight: 400, color: "#888", clamp: 1, italic: false, mono: true  },
  label:      { size: 7,   mmSize: 2.0, weight: 400, color: "#888", clamp: 1, italic: false, mono: false },
  mediaCond:  { size: 7,   mmSize: 2.0, weight: 400, color: "#888", clamp: 1, italic: false, mono: false },
  sleeveCond: { size: 7,   mmSize: 2.0, weight: 400, color: "#777", clamp: 1, italic: false, mono: false },
  notes:      { size: 6.5, mmSize: 1.8, weight: 400, color: "#111", clamp: 2, italic: false, mono: false },
  folder:     { size: 6.5, mmSize: 1.8, weight: 400, color: "#aaa", clamp: 1, italic: false, mono: false },
  rating:     { size: 9.5, mmSize: 2.8, weight: 400, color: "#111", clamp: 1,  italic: false, mono: false },
  tracklist:  { size: 5.5, mmSize: 1.6, weight: 400, color: "#555", clamp: 20, italic: false, mono: true  },
};

export const starsText = (n) => "★".repeat(n) + "☆".repeat(5 - n);

export const FIELD_VALUE = (r, key) => {
  const v = {
    artist: r.artist,
    title: r.title,
    year: r.year,
    format: r.format,
    catno: r.catno === "none" ? "" : r.catno,
    label: r.label,
    mediaCond: r.mediaCond,
    sleeveCond: r.sleeveCond,
    notes: r.notes,
    folder: r.folder,
    rating: r.rating ? starsText(r.rating) : "",
  };
  return v[key] || "";
};

// Fields that only exist in CSV exports (not available via API)
export const csvOnlyCols = ["mediaCond", "sleeveCond", "notes", "folder", "rating"];

export const COLUMNS = [
  { label: "Artist",           key: "artist"     },
  { label: "Title",            key: "title"      },
  { label: "Year",             key: "year"       },
  { label: "Format",           key: "format"     },
  { label: "Cat No.",          key: "catno"      },
  { label: "Label",            key: "label"      },
  { label: "Date Added",       key: "dateAdded"  },
  { label: "Media Condition",  key: "mediaCond"  },
  { label: "Sleeve Condition", key: "sleeveCond" },
  { label: "Folder",           key: "folder"     },
  { label: "Notes",            key: "notes"      },
  { label: "Rating",           key: "rating"     },
];
