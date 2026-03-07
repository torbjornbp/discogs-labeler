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
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "#fff", borderBottom: "1px solid #aaa", padding: "10px 20px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button className="btn" onClick={() => { setScreen("home"); }}>← Back</button>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#000" }}>
          Discogs<span style={{ color: "royalblue" }}> Label Printer</span>
        </span>
        {username && <span style={{ fontSize: 12, color: "#aaa" }}>/ {username}</span>}
        <input
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Search artist, title, year…"
          style={{ padding: "6px 10px", background: "#fff", border: "1px solid #aaa", color: "#000", fontSize: 13, outline: "none", width: 220, marginLeft: "auto" }}
          onFocus={(e) => (e.target.style.borderColor = "royalblue")}
          onBlur={(e) => (e.target.style.borderColor = "#aaa")}
        />
        <button className="btn" onClick={() => selectAll(filteredReleases)}>All</button>
        <button className="btn" onClick={clearAll}>None</button>
        <span style={{ fontSize: 12, color: "royalblue", fontWeight: 700, fontFamily: "monospace", padding: "6px 10px", background: "#f9f9f9", border: "1px solid #aaa" }}>{selected.size} selected</span>
        {sortKey && (
          <span className="box" style={{ fontSize: 12, color: "#555", padding: "6px 10px", display: "flex", alignItems: "center", gap: 5 }}>
            Sorted by <strong style={{ color: "#000" }}>{COLUMNS.find((c) => c.key === sortKey)?.label}</strong> {sortDir === "asc" ? "↑" : "↓"}
            <button onClick={() => setSortKey(null)} style={{ marginLeft: 2, border: "none", background: "none", color: "#aaa", cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 0 }}>✕</button>
          </span>
        )}
        <button
          className={selected.size > 0 ? "btn-primary" : "btn"}
          onClick={() => setScreen("preview")}
          disabled={selected.size === 0}
        >
          Preview Labels →
        </button>
      </div>

      {/* Stats bar */}
      <div style={{ padding: "7px 20px", background: "#f9f9f9", borderBottom: "1px solid #aaa", display: "flex", gap: 20, fontSize: 12, color: "#777", alignItems: "center" }}>
        <span>{releases.length} records</span>
        <span>{filteredReleases.length} shown</span>
        <span style={{ color: "#ccc" }}>·</span>
        <span>Click any column header to sort · print order follows sort</span>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, borderLeft: "4px solid #777" }}>
          <thead>
            <tr style={{ background: "#eee", borderBottom: "2px solid #aaa" }}>
              <th style={{ width: 40, padding: "10px 12px", textAlign: "center" }}>
                <input
                  type="checkbox"
                  checked={filteredReleases.length > 0 && filteredReleases.every((r) => selected.has(r.id))}
                  onChange={(e) => e.target.checked ? selectAll(filteredReleases) : clearAll()}
                  style={{ cursor: "pointer", accentColor: "royalblue" }}
                />
              </th>
              <th style={{ width: 48, padding: "10px 8px" }} />
              {visibleColumns.map(({ label, key }) => (
                <th
                  key={key}
                  className={`sortable${sortKey === key ? " active" : ""}`}
                  onClick={() => handleSortClick(key)}
                  style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: sortKey === key ? "royalblue" : "#000", fontSize: 12, letterSpacing: "0.02em", whiteSpace: "nowrap" }}
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
                  style={{ background: isSelected ? "#f0f0ff" : i % 2 === 0 ? "#fff" : "#eee", borderBottom: "1px dotted #aaa", cursor: "pointer", userSelect: "none" }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "#e8e8ff"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = isSelected ? "#f0f0ff" : i % 2 === 0 ? "#fff" : "#eee"; }}
                >
                  <td style={{ padding: "9px 12px", textAlign: "center" }}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(r.id)} onClick={(e) => e.stopPropagation()} style={{ cursor: "pointer", accentColor: "royalblue" }} />
                  </td>
                  <td style={{ padding: "4px 8px", width: 48 }}>
                    {r.thumb
                      ? <img src={r.thumb} alt="" style={{ width: 36, height: 36, objectFit: "cover", display: "block", background: "#f0f0f0" }} />
                      : <div style={{ width: 36, height: 36, background: "#f0f0f0" }} />
                    }
                  </td>
                  <td style={{ padding: "9px 12px", fontWeight: 700, color: "#000", whiteSpace: "nowrap", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{r.artist}</td>
                  <td style={{ padding: "9px 12px", color: "#333", fontStyle: "italic", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <a href={r.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "#333", textDecoration: "none", borderBottom: "1px dashed #aaa" }} onMouseEnter={(e) => { e.target.style.color = "royalblue"; e.target.style.borderBottomColor = "royalblue"; }} onMouseLeave={(e) => { e.target.style.color = "#333"; e.target.style.borderBottomColor = "#aaa"; }}>{r.title}</a>
                  </td>
                  <td style={{ padding: "9px 12px", color: "#555", whiteSpace: "nowrap" }}>{r.year}</td>
                  <td style={{ padding: "9px 12px", color: "#555", whiteSpace: "nowrap" }}>{r.format}</td>
                  <td style={{ padding: "9px 12px", color: "#777", fontFamily: "monospace", fontSize: 12, whiteSpace: "nowrap" }}>{r.catno}</td>
                  <td style={{ padding: "9px 12px", color: "#777", whiteSpace: "nowrap", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</td>
                  <td style={{ padding: "9px 12px", color: "#777", whiteSpace: "nowrap" }}>{r.dateAdded ? new Date(r.dateAdded).toLocaleDateString() : "—"}</td>
                  {inputMode === "csv" && <td style={{ padding: "9px 12px", color: "#777", whiteSpace: "nowrap" }}>{r.mediaCond || "—"}</td>}
                  {inputMode === "csv" && <td style={{ padding: "9px 12px", color: "#777", whiteSpace: "nowrap" }}>{r.sleeveCond || "—"}</td>}
                  {inputMode === "csv" && <td style={{ padding: "9px 12px", color: "#777", whiteSpace: "nowrap" }}>{r.folder || "—"}</td>}
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
