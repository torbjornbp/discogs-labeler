import { useState } from "react";
import SortIcon from "../components/SortIcon.jsx";
import { COLUMNS, csvOnlyCols, starsText } from "../lib/fields.js";

export default function SelectScreen({
  releases,
  selected,
  toggleSelect,
  selectAll,
  clearAll,
  username,
  inputMode,
  sortKey,
  sortDir,
  handleSortClick,
  setSortKey,
  sortedReleases,
  setScreen,
}) {
  const [searchQ, setSearchQ] = useState("");

  const filteredReleases = sortedReleases.filter((r) => {
    const q = searchQ.toLowerCase();
    return (
      !q ||
      r.artist.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q) ||
      r.year?.toString().includes(q) ||
      r.catno?.toLowerCase().includes(q) ||
      r.label?.toLowerCase().includes(q)
    );
  });

  const visibleColumns = COLUMNS.filter((c) => inputMode === "csv" || !csvOnlyCols.includes(c.key));

  return (
    <div style={{ minHeight: "100vh", background: "#fff" }}>
      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "#fffffff0", backdropFilter: "blur(12px)", borderBottom: "1px solid #e8e8e8", padding: "12px 20px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => { setScreen("home"); }}
          style={{ padding: "7px 12px", background: "transparent", border: "1px solid #e0e0e0", borderRadius: 7, color: "#555", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
        >
          ← Back
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#111", letterSpacing: "-0.01em" }}>
          Discogs<span style={{ color: "#1a6ef5" }}> Label Printer</span>
        </span>
        {username && <span style={{ fontSize: 12, color: "#aaa" }}>/ {username}</span>}
        <input
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Search artist, title, year…"
          style={{ padding: "7px 12px", background: "#f5f5f5", border: "1px solid #e0e0e0", borderRadius: 7, color: "#111", fontSize: 13, outline: "none", width: 220, marginLeft: "auto" }}
        />
        <button onClick={() => selectAll(filteredReleases)} style={{ padding: "7px 11px", background: "transparent", border: "1px solid #e0e0e0", borderRadius: 7, color: "#555", fontSize: 12, cursor: "pointer" }}>All</button>
        <button onClick={clearAll} style={{ padding: "7px 11px", background: "transparent", border: "1px solid #e0e0e0", borderRadius: 7, color: "#555", fontSize: 12, cursor: "pointer" }}>None</button>
        <span style={{ fontSize: 12, color: "#1a6ef5", fontWeight: 600, fontFamily: "monospace", padding: "7px 11px", background: "#eff6ff", borderRadius: 7 }}>{selected.size} selected</span>
        {sortKey && (
          <span style={{ fontSize: 12, color: "#888", padding: "7px 10px", background: "#f5f5f5", border: "1px solid #e0e0e0", borderRadius: 7, display: "flex", alignItems: "center", gap: 5 }}>
            Sorted by <strong style={{ color: "#333" }}>{COLUMNS.find((c) => c.key === sortKey)?.label}</strong> {sortDir === "asc" ? "↑" : "↓"}
            <button onClick={() => setSortKey(null)} style={{ marginLeft: 2, border: "none", background: "none", color: "#aaa", cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 0 }}>✕</button>
          </span>
        )}
        <button
          onClick={() => setScreen("preview")}
          disabled={selected.size === 0}
          style={{ padding: "8px 16px", background: selected.size > 0 ? "#1a6ef5" : "#e0e0e0", color: selected.size > 0 ? "#fff" : "#aaa", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: selected.size > 0 ? "pointer" : "not-allowed" }}
        >
          Preview Labels →
        </button>
      </div>

      {/* Stats bar */}
      <div style={{ padding: "8px 20px", background: "#fafafa", borderBottom: "1px solid #ebebeb", display: "flex", gap: 20, fontSize: 12, color: "#999", alignItems: "center" }}>
        <span>{releases.length} records</span>
        <span>{filteredReleases.length} shown</span>
        <span style={{ color: "#ccc" }}>·</span>
        <span style={{ color: "#bbb" }}>Click any column header to sort · print order follows sort</span>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f9f9f9", borderBottom: "2px solid #e8e8e8" }}>
              <th style={{ width: 40, padding: "10px 12px", textAlign: "center" }}>
                <input
                  type="checkbox"
                  checked={filteredReleases.length > 0 && filteredReleases.every((r) => selected.has(r.id))}
                  onChange={(e) => e.target.checked ? selectAll(filteredReleases) : clearAll()}
                  style={{ cursor: "pointer", accentColor: "#1a6ef5" }}
                />
              </th>
              <th style={{ width: 48, padding: "10px 8px" }} />
              {visibleColumns.map(({ label, key }) => (
                <th
                  key={key}
                  className={`sortable${sortKey === key ? " active" : ""}`}
                  onClick={() => handleSortClick(key)}
                  style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: sortKey === key ? "#1a6ef5" : "#555", fontSize: 12, letterSpacing: "0.02em", whiteSpace: "nowrap", transition: "color 0.15s" }}
                >
                  {label}
                  <SortIcon active={sortKey === key} dir={sortDir} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredReleases.map((r, i) => {
              const isSelected = selected.has(r.id);
              return (
                <tr
                  key={r.id}
                  onClick={() => toggleSelect(r.id)}
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
                    <a href={r.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "#333", textDecoration: "none", borderBottom: "1px dashed #ccc" }} onMouseEnter={(e) => (e.target.style.borderBottomColor = "#1a6ef5")} onMouseLeave={(e) => (e.target.style.borderBottomColor = "#ccc")}>{r.title}</a>
                  </td>
                  <td style={{ padding: "9px 12px", color: "#666", whiteSpace: "nowrap" }}>{r.year}</td>
                  <td style={{ padding: "9px 12px", color: "#666", whiteSpace: "nowrap" }}>{r.format}</td>
                  <td style={{ padding: "9px 12px", color: "#888", fontFamily: "monospace", fontSize: 12, whiteSpace: "nowrap" }}>{r.catno}</td>
                  <td style={{ padding: "9px 12px", color: "#888", whiteSpace: "nowrap", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</td>
                  <td style={{ padding: "9px 12px", color: "#888", whiteSpace: "nowrap" }}>{r.dateAdded ? new Date(r.dateAdded).toLocaleDateString() : "—"}</td>
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
      </div>
    </div>
  );
}
