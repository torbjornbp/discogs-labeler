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
  const { fields, setFields, fieldOrder, setFieldOrder, fontScale, setFontScale, qrScale, setQrScale, pad, setPad, layoutMode, setLayoutMode, tracklistMap } = labelConfig;
  const [fetchProgress, setFetchProgress] = useState(null);
  const [draggingKey, setDraggingKey] = useState(null);
  const dragField = useRef(null);
  const dragOverField = useRef(null);
  const touchDrag = useRef(null); // { key, startX, startY, moved, lastOver }

  const reorderFields = (from, to) => setFieldOrder((prev) => {
    const next = [...prev];
    const fi = next.indexOf(from);
    const ti = next.indexOf(to);
    if (fi === -1 || ti === -1 || fi === ti) return prev;
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

  const handlePrint = () => openPrintWindow({ selectedReleases, template, fields, fieldOrder, pad, fontScale, qrScale, layoutMode, tracklistMap });

  const sheetProps = { template, fields, fontScale, qrScale, fieldOrder, pad, layoutMode, tracklistMap };

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
    <div style={{ minHeight: "100vh", background: "#f5f5f5" }}>
      {/* Sticky header */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "#ffffffee", backdropFilter: "blur(12px)", borderBottom: "1px solid #e0e0e0" }}>
        <div style={{ padding: "12px 20px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button
            onClick={() => setScreen("select")}
            style={{ padding: "7px 12px", background: "transparent", border: "1px solid #e0e0e0", borderRadius: 7, color: "#555", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}
          >
            ← Back
          </button>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>Label Preview</span>
          <span style={{ fontSize: 13, color: "#999" }}>{selectedReleases.length} labels · {sheetsNeeded} sheet{sheetsNeeded !== 1 ? "s" : ""}</span>
          {sortKey && (
            <span style={{ fontSize: 12, color: "#888", padding: "4px 8px", background: "#f5f5f5", border: "1px solid #e8e8e8", borderRadius: 6 }}>
              Sorted by <strong style={{ color: "#555" }}>{COLUMNS.find((c) => c.key === sortKey)?.label}</strong> {sortDir === "asc" ? "↑" : "↓"}
            </span>
          )}
          <div style={{ marginLeft: "auto" }} />
          <button
            onClick={handlePrint}
            style={{ padding: "8px 20px", background: "#1a6ef5", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="3" y="6" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M5 6V3h6v3" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M5 10h6M5 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Print Sheets
          </button>
        </div>

        {/* Tab strip */}
        <div style={{ borderTop: "1px solid #f0f0f0" }}>
          <div style={{ display: "flex", padding: "0 20px", borderBottom: "1px solid #f0f0f0", gap: 0 }}>
            {[["layout", "Layout"], ["fields", "Fields"], ["padding", "Padding"]].map(([id, label]) => (
              <div key={id} onClick={() => setControlTab(id)} style={{
                padding: "9px 16px",
                fontSize: 12,
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
                <select
                  value={template.id}
                  onChange={(e) => setTemplate(TEMPLATES.find((t) => t.id === e.target.value))}
                  style={{ border: "none", background: "transparent", fontSize: 12, color: "#111", fontFamily: "inherit", cursor: "pointer", outline: "none" }}
                >
                  {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.description}</option>)}
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

              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#f5f5f5", border: "1px solid #e0e0e0", borderRadius: 7, padding: "5px 10px" }}>
                <span style={{ fontSize: 11, color: "#999", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Label layout</span>
                <select
                  value={layoutMode}
                  onChange={(e) => setLayoutMode(e.target.value)}
                  style={{ border: "none", background: "transparent", fontSize: 12, color: "#111", fontFamily: "inherit", cursor: "pointer", outline: "none" }}
                >
                  <option value="single">Standard</option>
                  <option value="twoColumn">Split (tracklist)</option>
                </select>
              </div>
            </div>
          )}

          {/* Fields tab */}
          {controlTab === "fields" && (
            <div style={{ padding: "8px 20px 10px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {fieldOrder
                .filter((key) => inputMode === "csv" || !csvOnlyCols.includes(key))
                .map((key) => {
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
                        reorderFields(from, to);
                      }}
                      onTouchEnd={() => { touchDrag.current = null; setDraggingKey(null); }}
                      onClick={() => setFields((prev) => ({ ...prev, [key]: { ...prev[key], on: !prev[key].on } }))}
                      style={{
                        padding: "4px 9px",
                        borderRadius: 6,
                        border: `1px solid ${f.on ? "#1a6ef5" : "#e0e0e0"}`,
                        background: f.on ? "#eff6ff" : "#fafafa",
                        color: f.on ? "#1a6ef5" : "#aaa",
                        fontSize: 12,
                        fontWeight: f.on ? 600 : 400,
                        cursor: key === "qr" ? "pointer" : "grab",
                        touchAction: key === "qr" ? "auto" : "none",
                        opacity: draggingKey === key ? 0.4 : 1,
                        transition: "opacity 0.1s",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        userSelect: "none",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {key !== "qr" && <span style={{ fontSize: 9, opacity: 0.35 }}>⠿</span>}
                      {f.label}
                    </button>
                  );
                })}

              {fields.tracklist?.on && (
                <>
                  <div style={{ width: 1, height: 20, background: "#e0e0e0", alignSelf: "center", flexShrink: 0 }} />
                  {fetchProgress ? (
                    <span style={{ fontSize: 11, color: fetchProgress.waiting ? "#e09000" : "#888", whiteSpace: "nowrap" }}>
                      {fetchProgress.waiting
                        ? `Rate limited — waiting ${fetchProgress.waiting}s…`
                        : `Fetching ${fetchProgress.done}/${fetchProgress.total}…`}
                    </span>
                  ) : (
                    <button
                      onClick={handleFetchTracklists}
                      disabled={unfetchedCount === 0}
                      style={{ padding: "4px 9px", borderRadius: 6, border: "1px solid #e0e0e0", background: unfetchedCount > 0 ? "#fff" : "#f5f5f5", color: unfetchedCount > 0 ? "#555" : "#bbb", fontSize: 11, fontWeight: 500, cursor: unfetchedCount > 0 ? "pointer" : "default", whiteSpace: "nowrap" }}
                    >
                      {unfetchedCount > 0 ? `↓ Fetch Tracklists (${unfetchedCount})` : "✓ All fetched"}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Padding tab */}
          {controlTab === "padding" && (
            <div style={{ padding: "8px 20px 10px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {[["Top", "t"], ["Right", "r"], ["Bottom", "b"], ["Left", "l"]].map(([label, key]) => (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 5, background: "#f5f5f5", border: "1px solid #e0e0e0", borderRadius: 7, padding: "5px 10px" }}>
                  <span style={{ fontSize: 11, color: "#999", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{label}</span>
                  <input type="range" min="0" max="10" step="0.5" value={pad[key]}
                    onChange={(e) => setPad((prev) => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                    style={{ width: 80, accentColor: "#1a6ef5", cursor: "pointer" }} />
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
            <div style={{ fontSize: 12, color: "#999999", marginBottom: 10, textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>
              Sheet {sheetIdx + 1} of {sheetsNeeded}
            </div>
            <div style={{ width: template.pageW * sheetScale, height: template.pageH * sheetScale, overflow: "hidden", boxShadow: "0 8px 40px #00000022", borderRadius: 4 }}>
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
