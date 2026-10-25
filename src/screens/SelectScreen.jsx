import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import SortIcon from "../components/SortIcon.jsx";
import { COLUMNS, csvOnlyCols, formatPrice, starsText } from "../lib/fields.js";
import { formatDateAdded } from "../lib/discogs.js";

const PAGE_SIZE = 200;

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
  pricePrefix = "",
}) {
  const [searchQ, setSearchQ] = useState("");
  const deferredSearchQ = useDeferredValue(searchQ);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const headerCheckboxRef = useRef(null);
  const sentinelRef = useRef(null);

  // A fresh search or sort starts back at the first chunk. Adjusting state
  // during render (rather than in an effect) avoids a flash of every row.
  const viewKey = `${deferredSearchQ}\u0000${sortKey}\u0000${sortDir}`;
  const [pagingKey, setPagingKey] = useState(viewKey);
  if (pagingKey !== viewKey) {
    setPagingKey(viewKey);
    setVisibleCount(PAGE_SIZE);
  }

  const filteredReleases = useMemo(() => {
    const q = deferredSearchQ.trim().toLowerCase();
    if (!q) return sortedReleases;
    return sortedReleases.filter(
      (r) =>
        r.artist.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.year?.toString().includes(q) ||
        r.catno?.toLowerCase().includes(q) ||
        r.label?.toLowerCase().includes(q)
    );
  }, [sortedReleases, deferredSearchQ]);

  const hasPrice = inputMode === "csv" && releases.some((release) => release.price);
  const visibleColumns = COLUMNS.filter((column) =>
    (inputMode === "csv" || !csvOnlyCols.includes(column.key)) &&
    (column.key !== "price" || hasPrice)
  );
  const shownReleases = filteredReleases.slice(0, visibleCount);
  const isTruncated = shownReleases.length < filteredReleases.length;

  const allShownSelected =
    filteredReleases.length > 0 && filteredReleases.every((r) => selected.has(r.id));
  const someShownSelected = filteredReleases.some((r) => selected.has(r.id));

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someShownSelected && !allShownSelected;
    }
  }, [someShownSelected, allShownSelected]);

  // Load the next chunk when the sentinel below the table scrolls into view.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !isTruncated || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((count) => Math.min(count + PAGE_SIZE, filteredReleases.length));
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [isTruncated, filteredReleases.length, visibleCount]);

  return (
    <div style={{ minHeight: "100dvh", background: "#fff" }}>
      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "#fff", borderBottom: "1px solid #aaa", padding: "10px 20px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn" onClick={() => { setScreen("home"); }}>← Back</button>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#000" }}>
          Torbjørn's <span style={{ color: "royalblue" }}>Discogs Labeler</span>
        </span>
        {username && <span style={{ fontSize: 12, color: "#777" }}>/ {username}</span>}
        <input
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Search artist, title, year…"
          aria-label="Search collection"
          style={{ padding: "0 10px", height: 27, background: "#fff", border: "1px solid #aaa", color: "#000", fontSize: 13, lineHeight: 1, width: 220, marginLeft: "auto", WebkitAppearance: "none", appearance: "none" }}
          onFocus={(e) => (e.target.style.borderColor = "royalblue")}
          onBlur={(e) => (e.target.style.borderColor = "#aaa")}
        />
        <button type="button" className="btn" onClick={() => selectAll(filteredReleases)}>{filteredReleases.length < releases.length ? `All (${filteredReleases.length})` : "All"}</button>
        <button type="button" className="btn" onClick={clearAll}>None</button>
        <span style={{ fontSize: 13, lineHeight: 1, color: "royalblue", fontWeight: 700, fontFamily: "monospace", padding: "0 10px", height: 27, display: "inline-flex", alignItems: "center", background: "#f9f9f9", border: "1px solid #aaa" }}>{selected.size} selected</span>
        {sortKey && (
          <span className="box" style={{ fontSize: 12, color: "#555", padding: "6px 10px", display: "flex", alignItems: "center", gap: 5 }}>
            Sorted by <strong style={{ color: "#000" }}>{COLUMNS.find((c) => c.key === sortKey)?.label}</strong> {sortDir === "asc" ? "↑" : "↓"}
            <button type="button" onClick={() => setSortKey(null)} aria-label="Clear sorting" style={{ marginLeft: 2, border: "none", background: "none", color: "#aaa", cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 0 }}>✕</button>
          </span>
        )}
        <button
          type="button"
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
        <span aria-live="polite">Showing {shownReleases.length} of {filteredReleases.length}</span>
        {isTruncated && (
          <button
            type="button"
            className="btn"
            onClick={() => setVisibleCount(filteredReleases.length)}
            style={{ fontSize: 11, padding: "2px 8px" }}
          >
            Show all
          </button>
        )}
        <span style={{ color: "#ccc" }} aria-hidden="true">·</span>
        <span>Click any column header to sort · print order follows sort</span>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table className="record-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, borderLeft: "4px solid #777" }}>
          <caption className="sr-only">Discogs records</caption>
          <thead>
            <tr>
              <th scope="col" style={{ width: 40, padding: "10px 12px", textAlign: "center" }}>
                <input
                  ref={headerCheckboxRef}
                  type="checkbox"
                  checked={allShownSelected}
                  onChange={(e) => e.target.checked ? selectAll(filteredReleases) : clearAll()}
                  aria-label="Select all matching records"
                  style={{ cursor: "pointer", accentColor: "royalblue" }}
                />
              </th>
              <th scope="col" style={{ width: 48, padding: "10px 8px" }}><span className="sr-only">Cover</span></th>
              {visibleColumns.map(({ label, key }) => (
                <th
                  key={key}
                  scope="col"
                  tabIndex={0}
                  aria-sort={sortKey === key ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                  className={`sortable${sortKey === key ? " active" : ""}`}
                  onClick={() => handleSortClick(key)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSortClick(key);
                    }
                  }}
                  style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: sortKey === key ? "royalblue" : "#000", fontSize: 12, letterSpacing: "0.02em", whiteSpace: "nowrap" }}
                >
                  {label}
                  <SortIcon active={sortKey === key} dir={sortDir} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredReleases.length === 0 && (
              <tr>
                <td colSpan={visibleColumns.length + 2} style={{ padding: "24px 12px", textAlign: "center", color: "#777", fontSize: 13 }}>
                  {deferredSearchQ.trim() ? `No records match “${deferredSearchQ.trim()}”.` : "No records to show."}
                </td>
              </tr>
            )}
            {shownReleases.map((r, i) => {
              const isSelected = selected.has(r.id);
              return (
                <tr
                  key={r.id}
                  onClick={() => toggleSelect(r.id)}
                  style={{ background: isSelected ? "#f0f0ff" : i % 2 === 0 ? "#fff" : "#eee", cursor: "pointer", userSelect: "none" }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "#e8e8ff"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = isSelected ? "#f0f0ff" : i % 2 === 0 ? "#fff" : "#eee"; }}
                >
                  <td style={{ padding: "9px 12px", textAlign: "center" }}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(r.id)} onClick={(e) => e.stopPropagation()} aria-label={`Select ${r.artist} — ${r.title}`} style={{ cursor: "pointer", accentColor: "royalblue" }} />
                  </td>
                  <td style={{ padding: "4px 8px", width: 48 }}>
                    {r.thumb
                      ? <img src={r.thumb} alt="" loading="lazy" decoding="async" style={{ width: 36, height: 36, objectFit: "cover", display: "block", background: "#f0f0f0" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
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
                  {hasPrice && <td style={{ padding: "9px 12px", color: "#555", fontFamily: "monospace", whiteSpace: "nowrap" }}>{formatPrice(r.price, pricePrefix) || "—"}</td>}
                  <td style={{ padding: "9px 12px", color: "#777", whiteSpace: "nowrap", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</td>
                  <td style={{ padding: "9px 12px", color: "#777", whiteSpace: "nowrap" }}>{formatDateAdded(r.dateAdded)}</td>
                  {inputMode === "csv" && <td style={{ padding: "9px 12px", color: "#777", whiteSpace: "nowrap" }}>{r.mediaCond || "—"}</td>}
                  {inputMode === "csv" && <td style={{ padding: "9px 12px", color: "#777", whiteSpace: "nowrap" }}>{r.sleeveCond || "—"}</td>}
                  {inputMode === "csv" && <td style={{ padding: "9px 12px", color: "#777", whiteSpace: "nowrap" }}>{r.folder || "—"}</td>}
                  {inputMode === "csv" && <td style={{ padding: "9px 12px", color: "#777", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.notes || "—"}</td>}
                  <td style={{ padding: "9px 12px", color: "#f5a623", whiteSpace: "nowrap", letterSpacing: 1 }}>{r.rating ? starsText(r.rating) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />
      </div>
    </div>
  );
}
