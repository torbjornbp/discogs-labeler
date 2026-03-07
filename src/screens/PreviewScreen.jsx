import { useRef, useState, useEffect } from "react";
import PrintSheet from "../components/PrintSheet.jsx";
import { TEMPLATES } from "../lib/templates.js";
import { COLUMNS, csvOnlyCols } from "../lib/fields.js";
import { openPrintWindow } from "../lib/print.js";

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
  const { fields, setFields, fieldOrder, setFieldOrder, fontScale, setFontScale, qrScale, setQrScale, pad, setPad, layoutMode, setLayoutMode, col2Fields, setCol2Fields, tracklistMap } = labelConfig;
  const [fetchProgress, setFetchProgress] = useState(null);
  const [draggingKey, setDraggingKey] = useState(null);
  const dragField = useRef(null);
  const dragOverField = useRef(null);
  const touchDrag = useRef(null); // { key, startX, startY, moved, lastOver }

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
  const sheetsNeeded = Math.ceil(selectedReleases.length / (template.cols * template.rows));

  useEffect(() => {
    const el = sheetsAreaRef.current;
    if (!el) return;
    const update = () => {
      const available = el.clientWidth - 48;
      setSheetScale(Math.min(0.72, available / template.pageW));
    };
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, [template.pageW]);

  const getSheetReleases = (sheetIdx) => {
    const size = template.cols * template.rows;
    return selectedReleases.slice(sheetIdx * size, (sheetIdx + 1) * size);
  };

  const handlePrint = () => openPrintWindow({ selectedReleases, template, fields, fieldOrder, pad, fontScale, qrScale, layoutMode, tracklistMap, col2Fields });

  const sheetProps = { template, fields, fontScale, qrScale, fieldOrder, pad, layoutMode, tracklistMap, col2Fields };

  const unfetchedCount = selectedReleases.filter((r) => r.releaseId && tracklistMap[r.releaseId] === undefined).length;

  const handleFetchTracklists = () => {
    if (fetchProgress) return;
    setFetchProgress({ done: 0, total: unfetchedCount, waiting: null });
    fetchTracklists(selectedReleases, (done, total, waitSecs) => {
      if (total === 0 || done >= total) setFetchProgress(null);
      else setFetchProgress({ done, total, waiting: waitSecs });
    });
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f9f9f9" }}>
      {/* Sticky header */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "#fff", borderBottom: "1px solid #aaa" }}>
        <div style={{ padding: "10px 20px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" onClick={() => setScreen("select")}>← Back</button>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#000" }}>Label Preview</span>
          <span style={{ fontSize: 13, color: "#777" }}>{selectedReleases.length} labels · {sheetsNeeded} sheet{sheetsNeeded !== 1 ? "s" : ""}</span>
          {sortKey && (
            <span className="box" style={{ fontSize: 12, color: "#555", padding: "4px 8px" }}>
              Sorted by <strong style={{ color: "#000" }}>{COLUMNS.find((c) => c.key === sortKey)?.label}</strong> {sortDir === "asc" ? "↑" : "↓"}
            </span>
          )}
          <div style={{ marginLeft: "auto" }} />
          <button className="btn-primary" onClick={handlePrint} style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 18px", whiteSpace: "nowrap" }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="3" y="6" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M5 6V3h6v3" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M5 10h6M5 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Print Sheets
          </button>
        </div>

        {/* Tab strip */}
        <div style={{ borderTop: "1px solid #aaa" }}>
          <div style={{ display: "flex", padding: "0 20px", borderBottom: "1px solid #aaa", gap: 0 }}>
            {[["layout", "Layout"], ["fields", "Fields"], ["padding", "Padding"]].map(([id, label]) => (
              <div key={id} onClick={() => setControlTab(id)} style={{
                padding: "9px 16px",
                fontSize: 12,
                fontWeight: controlTab === id ? 700 : 400,
                color: controlTab === id ? "royalblue" : "#777",
                cursor: "pointer",
                borderBottom: `2px solid ${controlTab === id ? "royalblue" : "transparent"}`,
                marginBottom: "-1px",
                userSelect: "none",
              }}>{label}</div>
            ))}
          </div>

          {/* Layout tab */}
          {controlTab === "layout" && (
            <div style={{ padding: "8px 20px 10px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div className="box" style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px" }}>
                <span style={{ fontSize: 11, color: "#777", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Template</span>
                <select
                  value={template.id}
                  onChange={(e) => setTemplate(TEMPLATES.find((t) => t.id === e.target.value))}
                  style={{ border: "none", background: "transparent", fontSize: 12, color: "#000", fontFamily: "inherit", cursor: "pointer", outline: "none" }}
                >
                  {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.description}</option>)}
                </select>
              </div>

              <div className="box" style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px" }}>
                <span style={{ fontSize: 11, color: "#777", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Font size</span>
                <input type="range" min="60" max="200" step="5" value={Math.round(fontScale * 100)}
                  onChange={(e) => setFontScale(parseInt(e.target.value) / 100)}
                  style={{ width: 80, accentColor: "royalblue", cursor: "pointer" }} />
                <span style={{ fontSize: 11, fontFamily: "monospace", color: "#555", minWidth: 28, textAlign: "right" }}>{Math.round(fontScale * 100)}%</span>
              </div>

              {fields.qr.on && (
                <div className="box" style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px" }}>
                  <span style={{ fontSize: 11, color: "#777", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap" }}>QR size</span>
                  <input type="range" min="50" max="150" step="5" value={Math.round(qrScale * 100)}
                    onChange={(e) => setQrScale(parseInt(e.target.value) / 100)}
                    style={{ width: 80, accentColor: "royalblue", cursor: "pointer" }} />
                  <span style={{ fontSize: 11, fontFamily: "monospace", color: "#555", minWidth: 28, textAlign: "right" }}>{Math.round(qrScale * 100)}%</span>
                </div>
              )}

              <div className="box" style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px" }}>
                <span style={{ fontSize: 11, color: "#777", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Label layout</span>
                <select
                  value={layoutMode}
                  onChange={(e) => setLayoutMode(e.target.value)}
                  style={{ border: "none", background: "transparent", fontSize: 12, color: "#000", fontFamily: "inherit", cursor: "pointer", outline: "none" }}
                >
                  <option value="single">Standard</option>
                  <option value="twoColumn">Two Column</option>
                </select>
              </div>
            </div>
          )}

          {/* Fields tab */}
          {controlTab === "fields" && (
            <div style={{ padding: "8px 20px 10px" }}>
              {(() => {
                const colLabelStyle = { fontSize: 10, color: "#777", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap", flexShrink: 0 };

                const renderFieldButton = (key) => {
                  const f = fields[key];
                  return (
                    <button
                      key={key}
                      data-field-key={key}
                      draggable={key !== "qr"}
                      onDragStart={() => { if (key !== "qr") { dragField.current = key; setDraggingKey(key); } }}
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
                        const el = document.elementFromPoint(clientX, clientY);
                        const to = el?.closest("[data-field-key]")?.dataset?.fieldKey;
                        const from = touchDrag.current.key;
                        if (!to || to === from || to === touchDrag.current.lastOver) return;
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
                      onClick={() => setFields((prev) => ({ ...prev, [key]: { ...prev[key], on: !prev[key].on } }))}
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
                      {key !== "qr" && <span style={{ fontSize: 9, opacity: 0.4 }}>⠿</span>}
                      {f.label}
                    </button>
                  );
                };

                const visibleKeys = fieldOrder.filter((key) => inputMode === "csv" || !csvOnlyCols.includes(key));

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
                    <span style={{ fontSize: 11, color: "#aaa" }}>Drag to reorder</span>
                  </div>
                );
              })()}

              {fields.tracklist?.on && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <div style={{ width: 1, height: 20, background: "#aaa", flexShrink: 0 }} />
                  <button
                    onClick={() => setFields((prev) => ({
                      ...prev,
                      tracklist: { ...prev.tracklist, showDuration: !prev.tracklist.showDuration },
                    }))}
                    style={{
                      padding: "4px 9px", fontSize: 11, fontWeight: 500,
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
                    <span style={{ fontSize: 11, color: fetchProgress.waiting ? "#e09000" : "#777", whiteSpace: "nowrap" }}>
                      {fetchProgress.waiting
                        ? `Rate limited — waiting ${fetchProgress.waiting}s…`
                        : `Fetching ${fetchProgress.done}/${fetchProgress.total}…`}
                    </span>
                  ) : (
                    <button
                      className="btn"
                      onClick={handleFetchTracklists}
                      disabled={unfetchedCount === 0}
                      style={{ padding: "4px 9px", fontSize: 11, whiteSpace: "nowrap" }}
                    >
                      {unfetchedCount > 0 ? `↓ Fetch Tracklists (${unfetchedCount})` : "✓ All fetched"}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Padding tab */}
          {controlTab === "padding" && (
            <div style={{ padding: "8px 20px 10px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {[["Top", "t"], ["Right", "r"], ["Bottom", "b"], ["Left", "l"]].map(([label, key]) => (
                <div key={key} className="box" style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px" }}>
                  <span style={{ fontSize: 11, color: "#777", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{label}</span>
                  <input type="range" min="0" max="10" step="0.5" value={pad[key]}
                    onChange={(e) => setPad((prev) => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                    style={{ width: 80, accentColor: "royalblue", cursor: "pointer" }} />
                  <span style={{ fontSize: 11, fontFamily: "monospace", color: "#555", minWidth: 26, textAlign: "right" }}>{pad[key]}mm</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sheet previews */}
      <div ref={sheetsAreaRef} style={{ padding: "32px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>
        {Array.from({ length: sheetsNeeded }).map((_, sheetIdx) => (
          <div key={sheetIdx}>
            <div style={{ fontSize: 12, color: "#777", marginBottom: 10, textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>
              Sheet {sheetIdx + 1} of {sheetsNeeded}
            </div>
            <div style={{ width: template.pageW * sheetScale, height: template.pageH * sheetScale, overflow: "hidden", boxShadow: "2px 2px #ddd" }}>
              <div style={{ transform: `scale(${sheetScale})`, transformOrigin: "top left" }}>
                <PrintSheet releases={getSheetReleases(sheetIdx)} {...sheetProps} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
