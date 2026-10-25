import { useRef, useState, useEffect, useMemo } from "react";
import LazySheet from "../components/LazySheet.jsx";
import { TEMPLATES } from "../lib/templates.js";
import { COLUMNS, csvOnlyCols } from "../lib/fields.js";
import { expandCopies, paginateReleases } from "../lib/pagination.js";
import { openPrintWindow } from "../lib/print.js";
import { getDiscogsIntervalMs } from "../lib/discogsClient.js";

const clampCopies = (value) => {
  const copies = Number.parseInt(value, 10);
  if (!Number.isFinite(copies)) return 1;
  return Math.min(100, Math.max(1, copies));
};

export default function PreviewScreen({
  selectedReleases,
  template,
  setTemplate,
  labelConfig,
  fetchTracklists,
  controlTab,
  setControlTab,
  sortKey,
  sortDir,
  inputMode,
  setScreen,
}) {
  const {
    fields, setFields, fieldOrder, setFieldOrder, fontScale, setFontScale,
    qrScale, setQrScale, pad, setPad, layoutMode, setLayoutMode,
    col2Fields, setCol2Fields, tracklistMap, cancelTracklists,
    pricePrefix = "", setPricePrefix,
  } = labelConfig;
  const [copiesPerRecord, setCopiesPerRecord] = useState(1);
  const [startCell, setStartCell] = useState(0);
  const [fetchProgress, setFetchProgress] = useState(null);
  const [fetchError, setFetchError] = useState("");
  const [draggingKey, setDraggingKey] = useState(null);
  const dragField = useRef(null);
  const dragOverField = useRef(null);
  const touchDrag = useRef(null); // { key, startX, startY, moved, lastOver }
  const clickGuardRef = useRef(0);

  const reorderFields = (from, to) => setFieldOrder((prev) => {
    const next = [...prev];
    const fi = next.indexOf(from);
    const ti = next.indexOf(to);
    if (fi === -1 || ti === -1 || fi === ti || to === "qr") return prev;
    next.splice(fi, 1);
    next.splice(ti, 0, from);
    return next;
  });
  const sheetsAreaRef = useRef(null);
  const [sheetScale, setSheetScale] = useState(0.72);
  const size = template.cols * template.rows;
  const maxQrScale = template.maxQrScale ?? 1.5;
  const expandedReleases = useMemo(
    () => expandCopies(selectedReleases, copiesPerRecord),
    [selectedReleases, copiesPerRecord]
  );
  const pages = useMemo(
    () => paginateReleases(expandedReleases, size, startCell),
    [expandedReleases, size, startCell]
  );

  // A start cell only makes sense for the current template's cell count.
  // Adjusting state during render (React's derived-state pattern) avoids a
  // frame where an old cell offset is applied to the new template.
  const [paginationTemplateId, setPaginationTemplateId] = useState(template.id);
  if (paginationTemplateId !== template.id) {
    setPaginationTemplateId(template.id);
    setStartCell(0);
  }

  // The QR size is stored globally, but each template caps it so the code can
  // never overflow a short label.
  useEffect(() => {
    if (qrScale > maxQrScale) setQrScale(maxQrScale);
  }, [qrScale, maxQrScale, setQrScale]);

  useEffect(() => {
    const el = sheetsAreaRef.current;
    if (!el) return;
    const update = () => {
      const available = el.clientWidth - 48;
      setSheetScale(Math.max(0.1, Math.min(0.72, available / template.pageW)));
    };
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, [template.pageW]);

  const handlePrint = () => openPrintWindow({
    selectedReleases: expandedReleases,
    template,
    fields,
    fieldOrder,
    pad,
    fontScale,
    qrScale,
    layoutMode,
    tracklistMap,
    col2Fields,
    pricePrefix,
    startCell,
  });

  const sheetProps = { template, fields, fontScale, qrScale, fieldOrder, pad, layoutMode, tracklistMap, col2Fields, pricePrefix };
  const hasPrice = inputMode === "csv" && selectedReleases.some((release) => release.price);
  const hasReleaseIds = selectedReleases.some((release) => release.releaseId);

  const unfetchedCount = useMemo(
    () => selectedReleases.filter((r) => r.releaseId && tracklistMap[r.releaseId] === undefined).length,
    [selectedReleases, tracklistMap]
  );

  const requestIntervalMs = getDiscogsIntervalMs();
  const tracklistEtaMinutes = unfetchedCount
    ? Math.max(1, Math.ceil((unfetchedCount * requestIntervalMs) / 60000))
    : 0;
  const tracklistEtaRemaining = (done, total) =>
    total > done
      ? Math.max(1, Math.ceil(((total - done) * requestIntervalMs) / 60000))
      : 0;

  const selectStyle = { border: "none", background: "transparent", fontSize: 12, color: "#000", fontFamily: "inherit", cursor: "pointer", appearance: "none", WebkitAppearance: "none" };
const TABS = [["layout", "Layout"], ["fields", "Fields"], ["padding", "Padding"]];

  const handleFetchTracklists = () => {
    if (fetchProgress) return;
    setFetchError("");
    setFetchProgress({ done: 0, total: unfetchedCount, waiting: null });
    fetchTracklists(selectedReleases, (done, total, waitSecs, error) => {
      if (error) {
        setFetchProgress(null);
        setFetchError(error);
        return;
      }
      if (total === 0 || done >= total) setFetchProgress(null);
      else setFetchProgress({ done, total, waiting: waitSecs });
    });
  };

  return (
    <div style={{ minHeight: "100dvh", background: "#f9f9f9" }}>
      {/* Sticky header */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "#fff", borderBottom: "1px solid #aaa" }}>
        <div style={{ padding: "10px 20px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn" onClick={() => { cancelTracklists(); setScreen("select"); }}>← Back</button>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#000" }}>Label Preview</span>
          <span style={{ fontSize: 13, color: "#777" }}>
            {selectedReleases.length} record{selectedReleases.length !== 1 ? "s" : ""} · {expandedReleases.length} label{expandedReleases.length !== 1 ? "s" : ""} · {pages.length} page{pages.length !== 1 ? "s" : ""}
          </span>
          {sortKey && (
            <span className="box" style={{ fontSize: 12, color: "#555", padding: "5px 10px", boxShadow: "none" }}>
              Sorted by <strong style={{ color: "#000" }}>{COLUMNS.find((c) => c.key === sortKey)?.label}</strong> {sortDir === "asc" ? "↑" : "↓"}
            </span>
          )}
          <div style={{ marginLeft: "auto" }} />
          <button className="btn-primary" type="button" onClick={handlePrint} style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 18px", whiteSpace: "nowrap" }}>
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="3" y="6" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M5 6V3h6v3" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M5 10h6M5 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Print Pages
          </button>
        </div>

        {/* Tab strip */}
        <div style={{ borderTop: "1px solid #aaa" }}>
          <div
            role="tablist"
            aria-label="Label settings"
            onKeyDown={(e) => {
              if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
              e.preventDefault();
              const current = TABS.findIndex(([id]) => id === controlTab);
              const next = TABS[(current + (e.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length][0];
              setControlTab(next);
              document.getElementById(`tab-${next}`)?.focus();
            }}
            style={{ display: "flex", padding: "0 20px", borderBottom: "1px solid #aaa", gap: 0 }}
          >
            {TABS.map(([id, label]) => (
              <button key={id} type="button" role="tab" id={`tab-${id}`} aria-controls={`panel-${id}`} aria-selected={controlTab === id} tabIndex={controlTab === id ? 0 : -1} onClick={() => setControlTab(id)} style={{
                padding: "9px 16px",
                fontSize: 12,
                fontWeight: controlTab === id ? 700 : 400,
                color: controlTab === id ? "royalblue" : "#777",
                cursor: "pointer",
                background: "transparent",
                border: "none",
                borderBottom: `2px solid ${controlTab === id ? "royalblue" : "transparent"}`,
                marginBottom: "-1px",
                userSelect: "none",
                fontFamily: "inherit",
              }}>{label}</button>
            ))}
          </div>

          {/* Layout tab */}
          {controlTab === "layout" && (
            <div role="tabpanel" id="panel-layout" aria-labelledby="tab-layout" style={{ padding: "8px 20px 10px", display: "flex", alignItems: "stretch", gap: 10, flexWrap: "wrap" }}>
              <div className="box" style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px" }}>
                <span style={{ fontSize: 11, color: "#777", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Template</span>
                <select
                  aria-label="Label template"
                  value={template.id}
                  onChange={(e) => setTemplate(TEMPLATES.find((t) => t.id === e.target.value))}
                  style={selectStyle}
                >
                  {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.description}</option>)}
                </select>
                <span style={{ fontSize: 10, color: "#777", lineHeight: 1, pointerEvents: "none", userSelect: "none" }}>▾</span>
              </div>

              <div className="box" style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px" }}>
                <span style={{ fontSize: 11, color: "#777", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Copies per record</span>
                <input
                  type="number"
                  aria-label="Copies per record"
                  min="1"
                  max="100"
                  step="1"
                  value={copiesPerRecord}
                  onChange={(e) => setCopiesPerRecord(clampCopies(e.target.value))}
                  style={{ width: 52, padding: "2px 4px", border: "1px solid #aaa", background: "#fff", color: "#000", fontSize: 12, fontFamily: "monospace" }}
                />
              </div>

              {size > 1 && (
                <div className="box" style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px" }}>
                  <span style={{ fontSize: 11, color: "#777", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Start on label</span>
                  <select
                    aria-label="Start on label"
                    value={Math.min(Math.max(startCell, 0), size - 1) + 1}
                    onChange={(e) => setStartCell(Number.parseInt(e.target.value, 10) - 1)}
                    style={selectStyle}
                  >
                    {Array.from({ length: size }, (_, index) => (
                      <option key={index} value={index + 1}>{index + 1}</option>
                    ))}
                  </select>
                  <span style={{ fontSize: 10, color: "#777", lineHeight: 1, pointerEvents: "none", userSelect: "none" }}>▾</span>
                </div>
              )}

              <div className="box" style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px" }}>
                <span style={{ fontSize: 11, color: "#777", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Font size</span>
                <input type="range" aria-label="Font size" min="60" max="200" step="5" value={Math.round(fontScale * 100)}
                  onChange={(e) => setFontScale(parseInt(e.target.value) / 100)}
                  style={{ width: 80, accentColor: "royalblue", cursor: "pointer" }} />
                <span style={{ fontSize: 11, fontFamily: "monospace", color: "#555", minWidth: 28, textAlign: "right" }}>{Math.round(fontScale * 100)}%</span>
              </div>

              {fields.qr?.on && (
                <div className="box" style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px" }}>
                  <span style={{ fontSize: 11, color: "#777", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap" }}>QR size</span>
                  <input type="range" aria-label="QR size" min="50" max={Math.round(maxQrScale * 100)} step="5" value={Math.round(Math.min(qrScale, maxQrScale) * 100)}
                    onChange={(e) => setQrScale(Math.min(maxQrScale, Number.parseInt(e.target.value, 10) / 100))}
                    style={{ width: 80, accentColor: "royalblue", cursor: "pointer" }} />
                  <span style={{ fontSize: 11, fontFamily: "monospace", color: "#555", minWidth: 28, textAlign: "right" }}>{Math.round(Math.min(qrScale, maxQrScale) * 100)}%</span>
                </div>
              )}

              <div className="box" style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px" }}>
                <span style={{ fontSize: 11, color: "#777", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Label layout</span>
                <select
                  aria-label="Label layout"
                  value={layoutMode}
                  onChange={(e) => setLayoutMode(e.target.value)}
                  style={selectStyle}
                >
                  <option value="single">Standard</option>
                  <option value="twoColumn">Two Column</option>
                </select>
                <span style={{ fontSize: 10, color: "#777", lineHeight: 1, pointerEvents: "none", userSelect: "none" }}>▾</span>
              </div>
            </div>
          )}

          {/* Fields tab */}
          {controlTab === "fields" && (
            <div role="tabpanel" id="panel-fields" aria-labelledby="tab-fields" style={{ padding: "8px 20px 10px" }}>
              {(() => {
                const colLabelStyle = { fontSize: 10, color: "#777", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap", flexShrink: 0 };

                const renderFieldButton = (key) => {
                  const f = fields[key];
                  return (
                    <button
                      key={key}
                      data-field-key={key}
                      draggable={key !== "qr"}
                      onDragStart={(e) => {
                        if (key === "qr") return;
                        dragField.current = key;
                        setDraggingKey(key);
                        e.dataTransfer.setData("text/plain", key);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        const from = dragField.current;
                        if (!from || from === key || dragOverField.current === key) return;
                        dragOverField.current = key;
                        if (layoutMode === "twoColumn") {
                          const fromInCol2 = col2Fields.has(from);
                          const toInCol2 = col2Fields.has(key);
                          if (fromInCol2 !== toInCol2) {
                            setCol2Fields((prev) => {
                              const next = new Set(prev);
                              if (toInCol2) next.add(from); else next.delete(from);
                              return next;
                            });
                          }
                        }
                        reorderFields(from, key);
                      }}
                      onDragEnd={() => { dragField.current = null; dragOverField.current = null; setDraggingKey(null); }}
                      onTouchStart={(e) => {
                        if (key === "qr") return;
                        clickGuardRef.current = 0;
                        touchDrag.current = { key, startX: e.touches[0].clientX, startY: e.touches[0].clientY, moved: false, lastOver: null };
                        setDraggingKey(key);
                      }}
                      onTouchMove={(e) => {
                        if (!touchDrag.current) return;
                        const { clientX, clientY } = e.touches[0];
                        const dx = clientX - touchDrag.current.startX;
                        const dy = clientY - touchDrag.current.startY;
                        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) touchDrag.current.moved = true;
                        if (!touchDrag.current.moved) return;
                        clickGuardRef.current = Date.now();
                        const el = document.elementFromPoint(clientX, clientY);
                        const to = el?.closest("[data-field-key]")?.dataset?.fieldKey;
                        const from = touchDrag.current.key;
                        if (!to) {
                          if (layoutMode === "twoColumn" && el?.closest('[data-col="2"]')) {
                            if (touchDrag.current.lastOver === "col2") return;
                            touchDrag.current.lastOver = "col2";
                            setCol2Fields((prev) => (prev.has(from) ? prev : new Set([...prev, from])));
                          }
                          return;
                        }
                        if (to === from || to === touchDrag.current.lastOver) return;
                        touchDrag.current.lastOver = to;
                        if (layoutMode === "twoColumn") {
                          const fromInCol2 = col2Fields.has(from);
                          const toInCol2 = col2Fields.has(to);
                          if (fromInCol2 !== toInCol2) {
                            setCol2Fields((prev) => {
                              const next = new Set(prev);
                              if (toInCol2) next.add(from); else next.delete(from);
                              return next;
                            });
                          }
                        }
                        reorderFields(from, to);
                      }}
                      onTouchEnd={() => { touchDrag.current = null; setDraggingKey(null); }}
                      onTouchCancel={() => { touchDrag.current = null; setDraggingKey(null); clickGuardRef.current = 0; }}
                      onKeyDown={(e) => {
                        if (!e.altKey || key === "qr") return;
                        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                        const columnKeys = visibleKeys.filter((fieldKey) =>
                          layoutMode !== "twoColumn" || col2Fields.has(fieldKey) === col2Fields.has(key)
                        );
                        const index = columnKeys.indexOf(key);
                        const target = columnKeys[e.key === "ArrowUp" ? index - 1 : index + 1];
                        if (!target || target === "qr") return;
                        e.preventDefault();
                        reorderFields(key, target);
                      }}
                      onClick={() => {
                        if (Date.now() - clickGuardRef.current < 500) {
                          clickGuardRef.current = 0;
                          return;
                        }
                        setFields((prev) => ({ ...prev, [key]: { ...prev[key], on: !prev[key].on } }));
                      }}
                      type="button"
                      aria-pressed={f.on}
                      aria-describedby="field-order-hint"
                      title={key === "qr" ? f.label : `${f.label} — drag, or Alt+↑/↓ to reorder`}
                      style={{
                        padding: "4px 9px",
                        border: `1px solid ${f.on ? "royalblue" : "#aaa"}`,
                        background: f.on ? "royalblue" : "#f9f9f9",
                        color: f.on ? "#fff" : "#777",
                        boxShadow: "2px 2px #ddd",
                        fontSize: 12,
                        fontWeight: f.on ? 700 : 400,
                        cursor: key === "qr" ? "pointer" : "grab",
                        touchAction: key === "qr" ? "auto" : "none",
                        opacity: draggingKey === key ? 0.4 : 1,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        userSelect: "none",
                        whiteSpace: "nowrap",
                        fontFamily: "inherit",
                      }}
                    >
                      {key !== "qr" && <span aria-hidden="true" style={{ fontSize: 9, opacity: 0.4 }}>⠿</span>}
                      {f.label}
                    </button>
                  );
                };

                const visibleKeys = fieldOrder.filter((key) =>
                  (key === "priceWriteIn" || inputMode === "csv" || !csvOnlyCols.includes(key)) &&
                  (key !== "price" || hasPrice)
                );

                if (layoutMode === "twoColumn") {
                  const col1Keys = visibleKeys.filter((k) => !col2Fields.has(k));
                  const col2Keys = visibleKeys.filter((k) => col2Fields.has(k));
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minHeight: 30 }}>
                        <span style={colLabelStyle}>Col 1</span>
                        {col1Keys.map(renderFieldButton)}
                      </div>
                      <div
                        data-col="2"
                        style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minHeight: 30, borderTop: "1px dashed #aaa", paddingTop: 6 }}
                        onDragOver={(e) => {
                          if (e.target !== e.currentTarget) return;
                          e.preventDefault();
                          const from = dragField.current;
                          if (!from || col2Fields.has(from)) return;
                          setCol2Fields((prev) => new Set([...prev, from]));
                        }}
                      >
                        <span style={colLabelStyle}>Col 2</span>
                        {col2Keys.map(renderFieldButton)}
                      </div>
                    </div>
                  );
                }

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {visibleKeys.map(renderFieldButton)}
                    </div>
                  </div>
                );
              })()}

              <p id="field-order-hint" style={{ fontSize: 11, color: "#777", marginTop: 6 }}>
                Drag to reorder · with a field focused, Alt+↑/↓ moves it
              </p>

              {hasPrice && fields.price?.on && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <label htmlFor="currency-prefix" style={{ fontSize: 11, color: "#777", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                    Currency prefix
                  </label>
                  <input
                    id="currency-prefix"
                    aria-label="Currency prefix"
                    type="text"
                    maxLength={8}
                    value={pricePrefix}
                    onChange={(e) => setPricePrefix?.(e.target.value)}
                    placeholder="$"
                    style={{ width: 72, padding: "2px 6px", border: "1px solid #aaa", background: "#fff", color: "#000", fontSize: 12, fontFamily: "monospace" }}
                  />
                  <span style={{ fontSize: 11, color: "#777", lineHeight: 1.4 }}>
                    Printed exactly as entered, e.g. <code style={{ fontFamily: "monospace" }}>kr </code> with a trailing space.
                  </span>
                </div>
              )}

              {fields.tracklist?.on && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <div style={{ width: 1, height: 20, background: "#aaa", flexShrink: 0 }} />
                  <button
                    type="button"
                    onClick={() => setFields((prev) => ({
                      ...prev,
                      tracklist: { ...prev.tracklist, showDuration: !prev.tracklist.showDuration },
                    }))}
                    style={{
                      padding: "4px 9px", fontSize: 11, fontWeight: 700,
                      border: `1px solid ${fields.tracklist.showDuration ? "royalblue" : "#aaa"}`,
                      background: fields.tracklist.showDuration ? "royalblue" : "#f9f9f9",
                      color: fields.tracklist.showDuration ? "#fff" : "#777",
                      boxShadow: "2px 2px #ddd",
                      cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
                    }}
                  >
                    Duration
                  </button>
                  {fetchProgress ? (
                    <>
                      <span role="status" aria-live="polite" style={{ fontSize: 11, color: fetchProgress.waiting ? "#e09000" : "#777", whiteSpace: "nowrap" }}>
                        {fetchProgress.waiting
                          ? `Rate limited — waiting ${fetchProgress.waiting}s…`
                          : `Fetching ${fetchProgress.done}/${fetchProgress.total}…${
                              tracklistEtaRemaining(fetchProgress.done, fetchProgress.total)
                                ? ` · ~${tracklistEtaRemaining(fetchProgress.done, fetchProgress.total)} min left`
                                : ""
                            }`}
                      </span>
                      <button
                        type="button"
                        onClick={() => { cancelTracklists(); setFetchProgress(null); }}
                        style={{ padding: "4px 9px", fontSize: 11, whiteSpace: "nowrap", border: "1px solid #bbb", cursor: "pointer", background: "#fff", fontFamily: "inherit", boxShadow: "2px 2px #ddd" }}
                      >
                        ✕ Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={handleFetchTracklists}
                      disabled={!hasReleaseIds || unfetchedCount === 0}
                      title={hasReleaseIds
                        ? "Discogs allows 25 requests/min unauthenticated (20 used here). Add a token on the home screen for 60/min (50 used here)."
                        : "Inventory CSV exports do not include release IDs for tracklist fetching."}
                      style={{ padding: "4px 9px", fontSize: 11, whiteSpace: "nowrap", border: "1px solid #bbb", cursor: "pointer", background: "#fff", fontFamily: "inherit", boxShadow: "2px 2px #ddd" }}
                    >
                      {!hasReleaseIds
                        ? "Tracklists unavailable (no release ID)"
                        : unfetchedCount > 0
                          ? `↓ Fetch Tracklists (${unfetchedCount}${tracklistEtaMinutes ? ` · ~${tracklistEtaMinutes} min` : ""})`
                          : "✓ All fetched"}
                    </button>
                  )}
                  {fetchError && (
                    <span role="alert" style={{ fontSize: 11, color: "#822", lineHeight: 1.4, whiteSpace: "normal" }}>
                      {fetchError}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Padding tab */}
          {controlTab === "padding" && (
            <div role="tabpanel" id="panel-padding" aria-labelledby="tab-padding" style={{ padding: "8px 20px 10px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {[["Top", "t"], ["Right", "r"], ["Bottom", "b"], ["Left", "l"]].map(([label, key]) => (
                <div key={key} className="box" style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px" }}>
                  <span style={{ fontSize: 11, color: "#777", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{label}</span>
                  <input type="range" aria-label={`${label} padding`} min="0" max="10" step="0.5" value={pad[key]}
                    onChange={(e) => setPad((prev) => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                    style={{ width: 80, accentColor: "royalblue", cursor: "pointer" }} />
                  <span style={{ fontSize: 11, fontFamily: "monospace", color: "#555", minWidth: 26, textAlign: "right" }}>{pad[key]}mm</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Page previews */}
      <div ref={sheetsAreaRef} style={{ padding: "32px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>
        {pages.map((pageReleases, pageIdx) => (
          <div key={pageIdx}>
            <div style={{ fontSize: 12, color: "#777", marginBottom: 10, textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>
              Page {pageIdx + 1} of {pages.length}
            </div>
            <div style={{
              width: template.pageW * sheetScale,
              height: template.pageH * sheetScale,
              overflow: "hidden",
              boxShadow: "2px 2px #ddd",
              contentVisibility: "auto",
              containIntrinsicSize: `${template.pageW * sheetScale}px ${template.pageH * sheetScale}px`,
            }}>
              <div style={{ transform: `scale(${sheetScale})`, transformOrigin: "top left" }}>
                <LazySheet eager={pageIdx === 0} releases={pageReleases} {...sheetProps} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
