import { useState, useEffect, useRef, useCallback } from "react";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const DISCOGS_API = "https://api.discogs.com";
const QR_API = (data) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(data)}&bgcolor=ffffff&color=111111&margin=2`;
const QR_API_PRINT = (data) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(data)}&bgcolor=ffffff&color=111111&margin=2`;

const TEMPLATES = [
  {
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
    labelW: 264.57,
    labelH: 139.84,
    pageW: 793.7,
    pageH: 1122.5,
    marginTop: 1.89,
    marginLeft: 0,
  },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchAllReleases(username, folder = 0) {
  let page = 1;
  let allReleases = [];
  while (true) {
    const res = await fetch(
      `${DISCOGS_API}/users/${username}/collection/folders/${folder}/releases?per_page=100&page=${page}`,
      { headers: { "User-Agent": "DiscogsLabelPrinter/1.0" } }
    );
    if (!res.ok) throw new Error(`Discogs error: ${res.status}`);
    const data = await res.json();
    allReleases = allReleases.concat(data.releases || []);
    if (page >= (data.pagination?.pages || 1)) break;
    page++;
    await sleep(300);
  }
  return allReleases;
}


function formatRelease(r) {
  const info = r.basic_information || r;
  return {
    id: r.instance_id || r.id || info.id,
    releaseId: info.id,
    title: info.title || "Unknown Title",
    artist: (info.artists || []).map((a) => a.name.replace(/\s*\(\d+\)$/, "")).join(", ") || "Unknown Artist",
    year: info.year || "",
    label: (info.labels || [])[0]?.name || "",
    catno: (info.labels || [])[0]?.catno || "",
    format: [
      (info.formats || [])[0]?.name,
      ...((info.formats || [])[0]?.descriptions || [])
    ].filter(Boolean).join(", ") || "",
    thumb: info.thumb || "",
    url: `https://www.discogs.com/release/${info.id}`,
    dateAdded: r.date_added || "",
    rating: r.rating || 0,
  };
}

// ─── CSV PARSER ───────────────────────────────────────────────────────────────
function parseDiscogsCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error("CSV appears to be empty.");

  const header = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  const idx = (name) => header.findIndex(h => h.toLowerCase() === name.toLowerCase());

  const iCatno      = idx("Catalog#");
  const iArtist     = idx("Artist");
  const iTitle      = idx("Title");
  const iLabel      = idx("Label");
  const iFormat     = idx("Format");
  const iYear       = idx("Released");
  const iId         = idx("release_id");
  const iMediaCond  = idx("Collection Media Condition");
  const iSleeveCond = idx("Collection Sleeve Condition");
  const iFolder     = idx("CollectionFolder");
  const iDateAdded  = idx("Date Added");
  const iNotes      = idx("Collection Notes");
  const iRating     = idx("Rating");

  function parseRow(line) {
    const fields = [];
    let cur = "", inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === "," && !inQuote) { fields.push(cur); cur = ""; }
      else { cur += ch; }
    }
    fields.push(cur);
    return fields;
  }

  return lines.slice(1).filter(l => l.trim()).map((line, rowIdx) => {
    const cols = parseRow(line);
    const get = (i) => (i >= 0 && i < cols.length ? cols[i].trim().replace(/^"|"$/g, "") : "");
    const releaseId = get(iId);
    return {
      id: `csv-${rowIdx}-${releaseId}`,
      releaseId,
      title:      get(iTitle)      || "Unknown Title",
      artist:     get(iArtist)     || "Unknown Artist",
      year:       get(iYear)       || "",
      label:      get(iLabel)      || "",
      catno:      get(iCatno)      || "",
      format:     get(iFormat)     || "",
      thumb:      "",
      url: releaseId ? `https://www.discogs.com/release/${releaseId}` : "https://www.discogs.com",
      mediaCond:  get(iMediaCond)  || "",
      sleeveCond: get(iSleeveCond) || "",
      folder:     get(iFolder)     || "",
      dateAdded:  get(iDateAdded)  || "",
      notes:      get(iNotes)      || "",
      rating:     parseInt(get(iRating)) || 0,
    };
  });
}

// ─── SORT HELPER ──────────────────────────────────────────────────────────────
function sortReleases(list, sortKey, sortDir) {
  if (!sortKey) return list;
  return [...list].sort((a, b) => {
    let av = (a[sortKey] ?? "").toString().toLowerCase();
    let bv = (b[sortKey] ?? "").toString().toLowerCase();
    // Numeric sort for year
    if (sortKey === "year" || sortKey === "rating") {
      av = parseInt(av) || 0;
      bv = parseInt(bv) || 0;
      return sortDir === "asc" ? av - bv : bv - av;
    }
    // Date sort for dateAdded
    if (sortKey === "dateAdded") {
      av = av ? new Date(av).getTime() : 0;
      bv = bv ? new Date(bv).getTime() : 0;
      return sortDir === "asc" ? av - bv : bv - av;
    }
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });
}

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

const FIELD_STYLES = {
  artist:     { size: 9.5, weight: 700, color: "#111", clamp: 2, italic: false, mono: false },
  title:      { size: 8.5, weight: 400, color: "#333", clamp: 2, italic: true,  mono: false },
  year:       { size: 7.5, weight: 400, color: "#666", clamp: 1, italic: false, mono: false },
  format:     { size: 7.5, weight: 400, color: "#666", clamp: 1, italic: false, mono: false },
  catno:      { size: 7,   weight: 400, color: "#888", clamp: 1, italic: false, mono: true  },
  label:      { size: 7,   weight: 400, color: "#888", clamp: 1, italic: false, mono: false },
  mediaCond:  { size: 7,   weight: 400, color: "#888", clamp: 1, italic: false, mono: false },
  sleeveCond: { size: 7,   weight: 400, color: "#777", clamp: 1, italic: false, mono: false },
  notes:      { size: 6.5, weight: 400, color: "#111", clamp: 2, italic: false, mono: false },
  folder:     { size: 6.5, weight: 400, color: "#aaa", clamp: 1, italic: false, mono: false },
  rating:     { size: 9.5, weight: 400, color: "#111", clamp: 1, italic: false, mono: false },
};

const starsText = (n) => "★".repeat(n) + "☆".repeat(5 - n);

const FIELD_VALUE = (r, key) => {
  const v = {
    artist: r.artist, title: r.title, year: r.year, format: r.format,
    catno: r.catno === "none" ? "" : r.catno, label: r.label,
    mediaCond: r.mediaCond, sleeveCond: r.sleeveCond, notes: r.notes, folder: r.folder,
    rating: r.rating ? starsText(r.rating) : "",
  };
  return v[key] || "";
};

function LabelCell({ release, template, fields, fontScale, qrScale, fieldOrder, pad }) {
  const fs = (n) => n * (fontScale || 1);
  const MM = 3.7795;
  const qrUrl = QR_API(release.url);
  const showQR = fields.qr.on && fieldOrder.includes("qr");
  return (
    <div style={{ width: template.labelW, height: template.labelH, display: "flex", flexDirection: "row", alignItems: "flex-start", padding: `${pad.t*MM}px ${pad.r*MM}px ${pad.b*MM}px ${pad.l*MM}px`, boxSizing: "border-box", gap: 6, background: "#fff", overflow: "hidden", borderRight: "0.5px dashed #ccc", borderBottom: "0.5px dashed #ccc" }}>
      {showQR && (
        <div style={{ flexShrink: 0 }}>
          <img src={qrUrl} alt="QR" style={{ width: 76 * (qrScale||1), height: 76 * (qrScale||1), display: "block" }} crossOrigin="anonymous" />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "flex-start", gap: 2 }}>
        {fieldOrder.filter(k => k !== "qr").map(key => {
          if (!fields[key]?.on) return null;
          const val = FIELD_VALUE(release, key);
          if (!val) return null;
          const s = FIELD_STYLES[key] || {};
          return (
            <div key={key} style={{
              fontSize: fs(s.size || 7),
              fontWeight: s.weight || 400,
              fontFamily: s.mono ? "monospace" : "'Inter', sans-serif",
              color: s.color || "#888",
              fontStyle: s.italic ? "italic" : "normal",
              lineHeight: 1.25,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: s.clamp || 1,
              WebkitBoxOrient: "vertical",
              letterSpacing: s.mono ? "0.02em" : "normal",
            }}>
              {key === "notes" && <span style={{ fontWeight: 700, fontStyle: "normal" }}>Notes: </span>}
              {val}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PrintSheet({ releases, template, fields, fontScale, qrScale, fieldOrder, pad }) {
  const total = template.cols * template.rows;
  const cells = releases.slice(0, total);
  while (cells.length < total) cells.push(null);

  return (
    <div
      id="print-sheet"
      style={{
        width: template.pageW,
        height: template.pageH,
        background: "#fff",
        position: "relative",
        paddingTop: template.marginTop,
        paddingLeft: template.marginLeft,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${template.cols}, ${template.labelW}px)`,
          gridTemplateRows: `repeat(${template.rows}, ${template.labelH}px)`,
          gap: 0,
        }}
      >
        {cells.map((r, i) =>
          r ? (
            <LabelCell key={i} release={r} template={template} fields={fields} fontScale={fontScale} qrScale={qrScale} fieldOrder={fieldOrder} pad={pad} />
          ) : (
            <div
              key={i}
              style={{
                width: template.labelW,
                height: template.labelH,
                borderRight: "0.5px dashed #ddd",
                borderBottom: "0.5px dashed #ddd",
              }}
            />
          )
        )}
      </div>
    </div>
  );
}

// ─── LOCALSTORAGE HELPERS ─────────────────────────────────────────────────────
const LS = {
  get: (key, fallback) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set: (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
};

// ─── SORT INDICATOR ───────────────────────────────────────────────────────────
function SortIcon({ active, dir }) {
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", marginLeft: 4, gap: 1, opacity: active ? 1 : 0.25, verticalAlign: "middle" }}>
      <svg width="7" height="4" viewBox="0 0 7 4" fill="none">
        <path d="M3.5 0L7 4H0L3.5 0Z" fill={active && dir === "asc" ? "#1a6ef5" : "#999"} />
      </svg>
      <svg width="7" height="4" viewBox="0 0 7 4" fill="none">
        <path d="M3.5 4L0 0H7L3.5 4Z" fill={active && dir === "desc" ? "#1a6ef5" : "#999"} />
      </svg>
    </span>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("home");
  const [username, setUsername] = useState("");
  const [releases, setReleases] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [template, setTemplate] = useState(TEMPLATES[0]);
  const [error, setError] = useState("");
  const [loadingMsg, setLoadingMsg] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [visibleCount, setVisibleCount] = useState(80);
  const sentinelRef = useRef(null);
  const [fontScale, setFontScale] = useState(1.0);
  const [qrScale, setQrScale] = useState(0.65);
  const [pad, setPad] = useState({ t: 3.2, r: 4.5, b: 1.2, l: 4.5 });
  const [controlTab, setControlTab] = useState("layout"); // "layout" | "fields"
  const [fieldOrder, setFieldOrder] = useState(() => LS.get("fieldOrder", [
    "qr","artist","title","year","format","catno","label","mediaCond","sleeveCond","notes","folder","rating"
  ]));
  const dragField = useRef(null);
  const [fields, setFields] = useState(() => LS.get("fields", {
    qr:         { label: "QR Code",          on: true  },
    artist:     { label: "Artist",           on: true  },
    title:      { label: "Title",            on: true  },
    year:       { label: "Year",             on: false },
    format:     { label: "Format",           on: false },
    catno:      { label: "Cat No.",          on: true  },
    label:      { label: "Label",            on: false },
    mediaCond:  { label: "Media Condition",  on: false },
    sleeveCond: { label: "Sleeve Condition", on: false },
    notes:      { label: "Notes",            on: false },
    folder:     { label: "Folder",           on: false },
    rating:     { label: "Rating",           on: false },
  }));
  const [inputMode, setInputMode] = useState('username');
  const [csvDrag, setCsvDrag] = useState(false);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);

  // ── Sort state ──────────────────────────────────────────────────────────────
  const [sortKey, setSortKey] = useState(() => LS.get("sortKey", null));
  const [sortDir, setSortDir] = useState(() => LS.get("sortDir", "asc"));

  function handleSortClick(key) {
    setSortKey(prev => {
      if (prev === key) {
        // Same column: toggle direction or clear if already desc
        if (sortDir === "asc") { setSortDir("desc"); return key; }
        else { setSortDir("asc"); return null; } // third click clears sort
      } else {
        setSortDir("asc");
        return key;
      }
    });
  }

  // ── Persist preferences ──────────────────────────────────────────────────────
  useEffect(() => { LS.set("fields",     fields);    }, [fields]);
  useEffect(() => { LS.set("fieldOrder", fieldOrder); }, [fieldOrder]);
  useEffect(() => { LS.set("sortKey",    sortKey);   }, [sortKey]);
  useEffect(() => { LS.set("sortDir",    sortDir);   }, [sortDir]);

  // ── Derived lists ────────────────────────────────────────────────────────────
  const filteredReleases = releases.filter((r) => {
    const q = searchQ.toLowerCase();
    return (
      !q ||
      r.artist.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q) ||
      r.year?.toString().includes(q)
    );
  });

  const sortedFilteredReleases = sortReleases(filteredReleases, sortKey, sortDir);
  const visibleReleases = sortedFilteredReleases.slice(0, visibleCount);

  // selectedReleases preserves the current sort order → sets print order
  const selectedReleases = sortedFilteredReleases.filter((r) => selected.has(r.id));

  // Infinite scroll
  useEffect(() => {
    if (!sentinelRef.current) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setVisibleCount((c) => c + 80);
    }, { threshold: 0.1 });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [sentinelRef.current, filteredReleases.length]);

  async function handleFetch() {
    if (!username.trim()) return;
    setError("");
    setScreen("loading");
    setLoadingMsg("Connecting to Discogs…");
    try {
      setLoadingMsg("Fetching your collection…");
      const raw = await fetchAllReleases(username.trim());
      if (raw.length === 0) throw new Error("Collection is empty or private.");
      const formatted = raw.map(formatRelease);
      setReleases(formatted);
      setSelected(new Set(formatted.map((r) => r.id)));
      setScreen("select");
    } catch (e) {
      setError(e.message || "Failed to fetch collection.");
      setScreen("home");
    }
  }

  function handleCSV(file) {
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      setError("Please upload a .csv file exported from Discogs.");
      return;
    }
    setError("");
    setScreen("loading");
    setLoadingMsg("Reading CSV…");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        setLoadingMsg("Parsing collection…");
        const formatted = parseDiscogsCSV(e.target.result);
        if (formatted.length === 0) throw new Error("No records found in CSV.");
        setReleases(formatted);
        setSelected(new Set(formatted.map((r) => r.id)));
        setScreen("select");
      } catch (err) {
        setError(err.message || "Failed to parse CSV.");
        setScreen("home");
      }
    };
    reader.onerror = () => { setError("Failed to read file."); setScreen("home"); };
    reader.readAsText(file);
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() { setSelected(new Set(sortedFilteredReleases.map((r) => r.id))); }
  function clearAll()  { setSelected(new Set()); }

  function handlePrint() {
    const sheetsCount = Math.ceil(selectedReleases.length / (template.cols * template.rows));
    const size = template.cols * template.rows;
    const lw = template.labelWmm;
    const lh = template.labelHmm;
    const f = fields;
    const sc = fontScale || 1;
    const fmm = (n) => (n * sc).toFixed(2);

    const buildLabel = (r) => {
      if (!r) return `<div style="width:${lw}mm;height:${lh}mm;"></div>`;
      const qr = QR_API_PRINT(r.url);
      const PMMSIZES = { artist:2.8, title:2.5, year:2.2, format:2.2, catno:2, label:2, mediaCond:2, sleeveCond:2, notes:1.8, folder:1.8, rating:2.8 };
      const PCOLORS  = { artist:"#111", title:"#333", year:"#666", format:"#666", catno:"#888", label:"#888", mediaCond:"#888", sleeveCond:"#777", notes:"#111", folder:"#aaa", rating:"#111" };
      const PVAL = (key) => {
        const v = { artist:r.artist, title:r.title, year:r.year, format:r.format,
          catno: r.catno==='none'?'':r.catno, label:r.label,
          mediaCond:r.mediaCond, sleeveCond:r.sleeveCond, notes:r.notes, folder:r.folder,
          rating: r.rating ? starsText(r.rating) : "" };
        return v[key]||'';
      };
      const showQR = fieldOrder.includes('qr') && f.qr.on;
      const textFields = fieldOrder.filter(k=>k!=='qr').map(key => {
        if (!f[key]?.on) return '';
        const val = PVAL(key); if (!val) return '';
        const isItalic = key==='title';
        const isMono = key==='catno';
        return `<div style="font-size:${fmm(PMMSIZES[key]||2)}mm;font-family:${isMono?'monospace':"'Inter',sans-serif"};color:${PCOLORS[key]||'#888'};line-height:1.25;overflow:hidden;display:-webkit-box;-webkit-line-clamp:${key==='artist'||key==='title'||key==='notes'?2:1};-webkit-box-orient:vertical;${isItalic?'font-style:italic;':''}${key==='artist'?'font-weight:700;':''}">${key==='notes'?'<span style="font-weight:700;font-style:normal;">Notes: </span>':''}${val}</div>`;
      }).join('');
      return `
        <div style="width:${lw}mm;height:${lh}mm;display:flex;flex-direction:row;align-items:flex-start;padding:${pad.t}mm ${pad.r}mm ${pad.b}mm ${pad.l}mm;box-sizing:border-box;gap:1.5mm;background:#fff;overflow:hidden;">
          ${showQR ? `<div style="flex-shrink:0;"><img src="${qr}" style="display:block;width:${(20*(qrScale||1)).toFixed(1)}mm;height:${(20*(qrScale||1)).toFixed(1)}mm;" /></div>` : ''}
          <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:flex-start;gap:0.5mm;">${textFields}</div>
        </div>`;
    };

    const mt = template.marginTopMm;
    const ml = template.marginLeftMm;
    let sheetsHTML = '';
    for (let s = 0; s < sheetsCount; s++) {
      const sheetReleases = selectedReleases.slice(s * size, (s + 1) * size);
      while (sheetReleases.length < size) sheetReleases.push(null);
      const isLast = s === sheetsCount - 1;
      sheetsHTML += `
        <div style="width:${template.pageWmm}mm;height:${template.pageHmm}mm;background:#fff;padding-top:${mt}mm;padding-left:${ml}mm;box-sizing:border-box;overflow:hidden;${isLast ? '' : 'page-break-after:always;'}">
          <div style="display:grid;grid-template-columns:repeat(${template.cols},${lw}mm);grid-template-rows:repeat(${template.rows},${lh}mm);gap:0mm 0mm;">
            ${sheetReleases.map(buildLabel).join('')}
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

    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(html);
    win.document.close();
    win.onload = () => {
      const imgs = win.document.images;
      let loaded = 0;
      const total = imgs.length;
      if (total === 0) { win.print(); return; }
      const tryPrint = () => { if (++loaded >= total) win.print(); };
      Array.from(imgs).forEach(img => {
        if (img.complete) tryPrint();
        else { img.onload = tryPrint; img.onerror = tryPrint; }
      });
    };
  }

  const sheetsNeeded = Math.ceil(selectedReleases.length / (template.cols * template.rows));
  const getSheetReleases = (sheetIdx) => {
    const size = template.cols * template.rows;
    return selectedReleases.slice(sheetIdx * size, (sheetIdx + 1) * size);
  };

  // Column definitions for the select table
  const COLUMNS = [
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
  const csvOnlyCols = ["mediaCond","sleeveCond","notes","folder","dateAdded","rating"];
  const visibleColumns = COLUMNS.filter(c => inputMode === "csv" || !csvOnlyCols.includes(c.key));

  return (
    <div style={{ width: '100vw', minHeight: '100vh', overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        body, h1, h2, h3, h4, p, ul, li, div, span, input, button { margin: 0; padding: 0; }
        html, body { width: 100%; min-height: 100vh; background: #f5f5f5; font-family: 'Inter', sans-serif; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #f0f0f0; }
        ::-webkit-scrollbar-thumb { background: #cccccc; border-radius: 3px; }
        input, button { font-family: inherit; }
        th.sortable { cursor: pointer; user-select: none; }
        th.sortable:hover { background: #f0f0f0; }
        th.sortable.active { color: #1a6ef5; }
      `}</style>

      {/* ── HOME ── */}
      {screen === "home" && (
        <div style={{ minHeight: "100vh", width: "100vw", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, background: "#f5f5f5", boxSizing: "border-box" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32, width: "100%", maxWidth: 440, margin: "0 auto" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#1a6ef5", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 3px #fff, 0 0 0 5px #1a6ef544" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f5f5f5" }} />
                </div>
                <span style={{ fontSize: 28, fontWeight: 700, color: "#111111", letterSpacing: "-0.02em" }}>
                  Discogs<span style={{ color: "#1a6ef5" }}> Label Printer</span>
                </span>
              </div>
              <p style={{ fontSize: 14, color: "#666666", lineHeight: 1.5, maxWidth: 320, textAlign: "center" }}>
                Generate printable QR label sheets from your Discogs collection
              </p>
            </div>

            <div style={{ background: "#ffffff", border: "1px solid #e0e0e0", borderRadius: 16, padding: 28, width: "100%", display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", background: "#f5f5f5", borderRadius: 10, padding: 3, gap: 3 }}>
                {[["username", "Discogs Username"], ["csv", "CSV Upload"]].map(([mode, label]) => (
                  <button key={mode} onClick={() => { setInputMode(mode); setError(""); }}
                    style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "none", background: inputMode === mode ? "#ffffff" : "transparent", color: inputMode === mode ? "#111" : "#999", fontWeight: inputMode === mode ? 600 : 400, fontSize: 13, cursor: "pointer", boxShadow: inputMode === mode ? "0 1px 3px #0000001a" : "none", transition: "all 0.15s" }}
                  >{label}</button>
                ))}
              </div>

              {inputMode === "username" && (
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#666666", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Discogs Username</label>
                  <input ref={inputRef} value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleFetch()} placeholder="e.g. vinylhunter99" autoComplete="off"
                    style={{ width: "100%", padding: "12px 16px", background: "#f5f5f5", border: "1px solid #e0e0e0", borderRadius: 10, color: "#111111", fontSize: 15, outline: "none", transition: "border-color 0.2s" }}
                    onFocus={(e) => (e.target.style.borderColor = "#1a6ef5")}
                    onBlur={(e) => (e.target.style.borderColor = "#e0e0e0")}
                  />
                </div>
              )}

              {inputMode === "csv" && (
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#666666", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Discogs Collection Export (.csv)</label>
                  <input ref={fileInputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => handleCSV(e.target.files[0])} />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setCsvDrag(true); }}
                    onDragLeave={() => setCsvDrag(false)}
                    onDrop={(e) => { e.preventDefault(); setCsvDrag(false); handleCSV(e.dataTransfer.files[0]); }}
                    style={{ border: `2px dashed ${csvDrag ? "#1a6ef5" : "#d0d0d0"}`, borderRadius: 10, padding: "28px 20px", textAlign: "center", cursor: "pointer", background: csvDrag ? "#eff6ff" : "#fafafa", transition: "all 0.15s" }}
                  >
                    <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#333", marginBottom: 4 }}>Drop your CSV here or click to browse</div>
                    <div style={{ fontSize: 12, color: "#999" }}>Export from Discogs → My Collection → Export</div>
                  </div>
                </div>
              )}

              {error && (
                <div style={{ padding: "10px 14px", background: "#fff0f0", border: "1px solid #ffaaaa", borderRadius: 8, color: "#cc2222", fontSize: 13 }}>{error}</div>
              )}

              {inputMode === "username" && (
                <button onClick={handleFetch} disabled={!username.trim()}
                  style={{ padding: "14px 24px", background: username.trim() ? "#1a6ef5" : "#e0e0e0", color: username.trim() ? "#ffffff" : "#999999", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: username.trim() ? "pointer" : "not-allowed", transition: "all 0.2s", letterSpacing: "-0.01em" }}>
                  Fetch Collection →
                </button>
              )}
            </div>

            <p style={{ fontSize: 12, color: "#bbbbbb", textAlign: "center" }}>
              {inputMode === "username" ? "Only public Discogs collections are supported" : "Export via Discogs → My Collection → Export Collection"}
            </p>
          </div>
        </div>
      )}

      {/* ── LOADING ── */}
      {screen === "loading" && (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: "#f5f5f5" }}>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #e0e0e0", borderTop: "3px solid #1a6ef5", animation: "spin 0.8s linear infinite" }} />
          <p style={{ color: "#666666", fontSize: 14, textAlign: "center" }}>{loadingMsg}</p>
        </div>
      )}

      {/* ── SELECT ── */}
      {screen === "select" && (
        <div style={{ minHeight: "100vh", background: "#fff" }}>
          {/* Header */}
          <div style={{ position: "sticky", top: 0, zIndex: 100, background: "#fffffff0", backdropFilter: "blur(12px)", borderBottom: "1px solid #e8e8e8", padding: "12px 20px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button onClick={() => { setScreen("home"); setReleases([]); setSelected(new Set()); setSearchQ(""); setSortKey(null); }}
              style={{ padding: "7px 12px", background: "transparent", border: "1px solid #e0e0e0", borderRadius: 7, color: "#555", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              ← Back
            </button>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#111", letterSpacing: "-0.01em" }}>
              Discogs<span style={{ color: "#1a6ef5" }}> Label Printer</span>
            </span>
            {username && <span style={{ fontSize: 12, color: "#aaa" }}>/ {username}</span>}
            <input
              value={searchQ}
              onChange={(e) => { setSearchQ(e.target.value); setVisibleCount(80); }}
              placeholder="Search artist, title, year…"
              style={{ padding: "7px 12px", background: "#f5f5f5", border: "1px solid #e0e0e0", borderRadius: 7, color: "#111", fontSize: 13, outline: "none", width: 220, marginLeft: "auto" }}
            />
            <button onClick={selectAll} style={{ padding: "7px 11px", background: "transparent", border: "1px solid #e0e0e0", borderRadius: 7, color: "#555", fontSize: 12, cursor: "pointer" }}>All</button>
            <button onClick={clearAll}  style={{ padding: "7px 11px", background: "transparent", border: "1px solid #e0e0e0", borderRadius: 7, color: "#555", fontSize: 12, cursor: "pointer" }}>None</button>
            <span style={{ fontSize: 12, color: "#1a6ef5", fontWeight: 600, fontFamily: "monospace", padding: "7px 11px", background: "#eff6ff", borderRadius: 7 }}>{selected.size} selected</span>
            {sortKey && (
              <span style={{ fontSize: 12, color: "#888", padding: "7px 10px", background: "#f5f5f5", border: "1px solid #e0e0e0", borderRadius: 7, display: "flex", alignItems: "center", gap: 5 }}>
                Sorted by <strong style={{ color: "#333" }}>{COLUMNS.find(c => c.key === sortKey)?.label}</strong> {sortDir === "asc" ? "↑" : "↓"}
                <button onClick={() => setSortKey(null)} style={{ marginLeft: 2, border: "none", background: "none", color: "#aaa", cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 0 }}>✕</button>
              </span>
            )}
            <button onClick={() => setScreen("preview")} disabled={selected.size === 0}
              style={{ padding: "8px 16px", background: selected.size > 0 ? "#1a6ef5" : "#e0e0e0", color: selected.size > 0 ? "#fff" : "#aaa", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: selected.size > 0 ? "pointer" : "not-allowed" }}>
              Preview Labels →
            </button>
          </div>

          {/* Stats bar */}
          <div style={{ padding: "8px 20px", background: "#fafafa", borderBottom: "1px solid #ebebeb", display: "flex", gap: 20, fontSize: 12, color: "#999", alignItems: "center" }}>
            <span>{releases.length} records</span>
            <span>{filteredReleases.length} shown</span>
            {visibleCount < filteredReleases.length && <span style={{ color: "#bbb" }}>showing {visibleCount} of {filteredReleases.length}</span>}
            <span style={{ color: "#ccc" }}>·</span>
            <span style={{ color: "#bbb" }}>Click any column header to sort · print order follows sort</span>
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f9f9f9", borderBottom: "2px solid #e8e8e8" }}>
                  <th style={{ width: 40, padding: "10px 12px", textAlign: "center" }}>
                    <input type="checkbox"
                      checked={sortedFilteredReleases.length > 0 && sortedFilteredReleases.every(r => selected.has(r.id))}
                      onChange={(e) => e.target.checked ? selectAll() : clearAll()}
                      style={{ cursor: "pointer", accentColor: "#1a6ef5" }}
                    />
                  </th>
                  <th style={{ width: 48, padding: "10px 8px" }} />
                  {visibleColumns.map(({ label, key }) => (
                    <th
                      key={key}
                      className={`sortable${sortKey === key ? " active" : ""}`}
                      onClick={() => handleSortClick(key)}
                      style={{
                        padding: "10px 12px",
                        textAlign: "left",
                        fontWeight: 600,
                        color: sortKey === key ? "#1a6ef5" : "#555",
                        fontSize: 12,
                        letterSpacing: "0.02em",
                        whiteSpace: "nowrap",
                        transition: "color 0.15s",
                      }}
                    >
                      {label}
                      <SortIcon active={sortKey === key} dir={sortDir} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleReleases.map((r, i) => {
                  const isSelected = selected.has(r.id);
                  return (
                    <tr key={r.id} onClick={() => toggleSelect(r.id)}
                      style={{ background: isSelected ? "#eff6ff" : i % 2 === 0 ? "#fff" : "#fafafa", borderBottom: "1px solid #f0f0f0", cursor: "pointer", userSelect: "none", transition: "background 0.1s" }}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "#f5f9ff"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = isSelected ? "#eff6ff" : i % 2 === 0 ? "#fff" : "#fafafa"; }}
                    >
                      <td style={{ padding: "9px 12px", textAlign: "center" }}>
                        <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${isSelected ? "#1a6ef5" : "#ccc"}`, background: isSelected ? "#1a6ef5" : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                          {isSelected && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3 5.5L8 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                      </td>
                      <td style={{ padding: "4px 8px", width: 48 }}>
                        {r.thumb
                          ? <img src={r.thumb} alt="" style={{ width: 36, height: 36, borderRadius: 4, objectFit: "cover", display: "block", background: "#f0f0f0" }} />
                          : <div style={{ width: 36, height: 36, borderRadius: 4, background: "#f0f0f0" }} />
                        }
                      </td>
                      <td style={{ padding: "9px 12px", fontWeight: 500, color: "#111", whiteSpace: "nowrap", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{r.artist}</td>
                      <td style={{ padding: "9px 12px", color: "#333", fontStyle: "italic", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <a href={r.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: "#333", textDecoration: "none", borderBottom: "1px dashed #ccc" }} onMouseEnter={e => e.target.style.borderBottomColor="#1a6ef5"} onMouseLeave={e => e.target.style.borderBottomColor="#ccc"}>{r.title}</a>
                      </td>
                      <td style={{ padding: "9px 12px", color: "#666", whiteSpace: "nowrap" }}>{r.year}</td>
                      <td style={{ padding: "9px 12px", color: "#666", whiteSpace: "nowrap" }}>{r.format}</td>
                      <td style={{ padding: "9px 12px", color: "#888", fontFamily: "monospace", fontSize: 12, whiteSpace: "nowrap" }}>{r.catno}</td>
                      <td style={{ padding: "9px 12px", color: "#888", whiteSpace: "nowrap", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</td>
                      {inputMode === "csv" && <td style={{ padding: "9px 12px", color: "#888", whiteSpace: "nowrap" }}>{r.dateAdded ? new Date(r.dateAdded).toLocaleDateString() : "—"}</td>}
                      {inputMode === "csv" && <td style={{ padding: "9px 12px", color: "#888", whiteSpace: "nowrap" }}>{r.mediaCond || "—"}</td>}
                      {inputMode === "csv" && <td style={{ padding: "9px 12px", color: "#888", whiteSpace: "nowrap" }}>{r.sleeveCond || "—"}</td>}
                      {inputMode === "csv" && <td style={{ padding: "9px 12px", color: "#888", whiteSpace: "nowrap" }}>{r.folder || "—"}</td>}
                      {inputMode === "csv" && <td style={{ padding: "9px 12px", color: "#aaa", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.notes || "—"}</td>}
                      {inputMode === "csv" && <td style={{ padding: "9px 12px", color: "#f5a623", whiteSpace: "nowrap", letterSpacing: 1 }}>{r.rating ? starsText(r.rating) : "—"}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div ref={sentinelRef} style={{ height: 40 }} />
          </div>
        </div>
      )}

      {/* ── PREVIEW ── */}
      {screen === "preview" && (
        <div style={{ minHeight: "100vh", background: "#f5f5f5" }}>
          <div style={{ position: "sticky", top: 0, zIndex: 100, background: "#ffffffee", backdropFilter: "blur(12px)", borderBottom: "1px solid #e0e0e0" }}>
            <div style={{ padding: "12px 20px", display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => setScreen("select")}
                style={{ padding: "7px 12px", background: "transparent", border: "1px solid #e0e0e0", borderRadius: 7, color: "#555", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                ← Back
              </button>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>Label Preview</span>
              <span style={{ fontSize: 13, color: "#999" }}>{selectedReleases.length} labels · {sheetsNeeded} sheet{sheetsNeeded !== 1 ? "s" : ""}</span>
              {sortKey && (
                <span style={{ fontSize: 12, color: "#888", padding: "4px 8px", background: "#f5f5f5", border: "1px solid #e8e8e8", borderRadius: 6 }}>
                  Sorted by <strong style={{ color: "#555" }}>{COLUMNS.find(c => c.key === sortKey)?.label}</strong> {sortDir === "asc" ? "↑" : "↓"}
                </span>
              )}
              <div style={{ marginLeft: "auto" }} />
              <button onClick={handlePrint}
                style={{ padding: "8px 20px", background: "#1a6ef5", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <rect x="3" y="6" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M5 6V3h6v3" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                  <path d="M5 10h6M5 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Print Sheets
              </button>
            </div>

            <div style={{ borderTop: "1px solid #f0f0f0" }}>
              {/* Tab strip */}
              <div style={{ display: "flex", padding: "0 20px", borderBottom: "1px solid #f0f0f0", gap: 0 }}>
                {[["layout", "Layout"], ["fields", "Fields"], ["padding", "Padding"]].map(([id, label]) => (
                  <div key={id} onClick={() => setControlTab(id)} style={{
                    padding: "9px 16px", fontSize: 12,
                    fontWeight: controlTab === id ? 600 : 400,
                    color: controlTab === id ? "#1a6ef5" : "#999",
                    cursor: "pointer",
                    borderBottom: `2px solid ${controlTab === id ? "#1a6ef5" : "transparent"}`,
                    marginBottom: "-1px",
                    userSelect: "none",
                  }}>{label}</div>
                ))}
              </div>

              {/* Layout tab */}
              {controlTab === "layout" && (
                <div style={{ padding: "8px 20px 10px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#f5f5f5", border: "1px solid #e0e0e0", borderRadius: 7, padding: "5px 10px" }}>
                    <span style={{ fontSize: 11, color: "#999", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Template</span>
                    <select value={template.id} onChange={(e) => setTemplate(TEMPLATES.find(t => t.id === e.target.value))}
                      style={{ border: "none", background: "transparent", fontSize: 12, color: "#111", fontFamily: "inherit", cursor: "pointer", outline: "none" }}>
                      {TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name} — {t.description}</option>)}
                    </select>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#f5f5f5", border: "1px solid #e0e0e0", borderRadius: 7, padding: "5px 10px" }}>
                    <span style={{ fontSize: 11, color: "#999", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Font size</span>
                    <input type="range" min="60" max="200" step="5" value={Math.round(fontScale * 100)}
                      onChange={(e) => setFontScale(parseInt(e.target.value) / 100)}
                      style={{ width: 80, accentColor: "#1a6ef5", cursor: "pointer" }} />
                    <span style={{ fontSize: 11, fontFamily: "monospace", color: "#555", minWidth: 28, textAlign: "right" }}>{Math.round(fontScale * 100)}%</span>
                  </div>

                  {fields.qr.on && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#f5f5f5", border: "1px solid #e0e0e0", borderRadius: 7, padding: "5px 10px" }}>
                      <span style={{ fontSize: 11, color: "#999", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap" }}>QR size</span>
                      <input type="range" min="50" max="150" step="5" value={Math.round(qrScale * 100)}
                        onChange={(e) => setQrScale(parseInt(e.target.value) / 100)}
                        style={{ width: 80, accentColor: "#1a6ef5", cursor: "pointer" }} />
                      <span style={{ fontSize: 11, fontFamily: "monospace", color: "#555", minWidth: 28, textAlign: "right" }}>{Math.round(qrScale * 100)}%</span>
                    </div>
                  )}
                </div>
              )}

              {/* Fields tab */}
              {controlTab === "fields" && (
                <div style={{ padding: "8px 20px 10px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {fieldOrder.filter(key => {
                    const csvOnly = ["mediaCond","sleeveCond","notes","folder","rating"];
                    return inputMode === "csv" || !csvOnly.includes(key);
                  }).map((key) => {
                    const f = fields[key];
                    return (
                      <button key={key}
                        draggable={key !== 'qr'}
                        onDragStart={() => { if (key !== 'qr') dragField.current = key; }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const from = dragField.current;
                          if (!from || from === key) return;
                          setFieldOrder(prev => {
                            const next = [...prev];
                            const fi = next.indexOf(from); const ti = next.indexOf(key);
                            next.splice(fi, 1); next.splice(ti, 0, from);
                            return next;
                          });
                        }}
                        onDragEnd={() => { dragField.current = null; }}
                        onClick={() => setFields(prev => ({ ...prev, [key]: { ...prev[key], on: !prev[key].on } }))}
                        style={{
                          padding: "4px 9px", borderRadius: 6,
                          border: `1px solid ${f.on ? "#1a6ef5" : "#e0e0e0"}`,
                          background: f.on ? "#eff6ff" : "#fafafa",
                          color: f.on ? "#1a6ef5" : "#aaa",
                          fontSize: 12, fontWeight: f.on ? 600 : 400,
                          cursor: key === 'qr' ? 'pointer' : 'grab',
                          display: "flex", alignItems: "center", gap: 4,
                          userSelect: "none", whiteSpace: "nowrap",
                        }}
                      >
                        {key !== 'qr' && <span style={{ fontSize: 9, opacity: 0.35 }}>⠿</span>}
                        {f.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Padding tab */}
              {controlTab === "padding" && (
                <div style={{ padding: "8px 20px 10px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  {[["Top", "t"], ["Right", "r"], ["Bottom", "b"], ["Left", "l"]].map(([label, key]) => (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 5, background: "#f5f5f5", border: "1px solid #e0e0e0", borderRadius: 7, padding: "5px 10px" }}>
                      <span style={{ fontSize: 11, color: "#999", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{label}</span>
                      <input type="range" min="0" max="10" step="0.5" value={pad[key]}
                        onChange={(e) => setPad(prev => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                        style={{ width: 80, accentColor: "#1a6ef5", cursor: "pointer" }} />
                      <span style={{ fontSize: 11, fontFamily: "monospace", color: "#555", minWidth: 26, textAlign: "right" }}>{pad[key]}mm</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ padding: "32px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>
            {Array.from({ length: sheetsNeeded }).map((_, sheetIdx) => (
              <div key={sheetIdx}>
                <div style={{ fontSize: 12, color: "#999999", marginBottom: 10, textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>
                  Sheet {sheetIdx + 1} of {sheetsNeeded}
                </div>
                <div style={{ boxShadow: "0 8px 40px #00000022", borderRadius: 4, overflow: "hidden", transform: "scale(0.72)", transformOrigin: "top center", marginBottom: -(template.pageH * 0.28) - 8 }}>
                  <PrintSheet
                    releases={getSheetReleases(sheetIdx)}
                    template={template}
                    fields={fields}
                    fontScale={fontScale}
                    qrScale={qrScale}
                    fieldOrder={fieldOrder}
                    pad={pad}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}