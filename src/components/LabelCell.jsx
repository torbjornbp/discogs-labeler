import { QR_API } from "../lib/templates.js";
import { FIELD_STYLES, FIELD_VALUE } from "../lib/fields.js";

const MM = 3.7795;

export default function LabelCell({ release, template, fields, fontScale, qrScale, fieldOrder, pad, layoutMode, tracklistMap }) {
  const fs = (n) => n * (fontScale || 1);
  const qrUrl = QR_API(release.url);
  const showQR = fields.qr.on && fieldOrder.includes("qr");
  const tracklist = tracklistMap?.[release.releaseId] || "";
  const showTracklist = fields.tracklist?.on;

  const outerStyle = {
    width: template.labelW,
    height: template.labelH,
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    padding: `${pad.t * MM}px ${pad.r * MM}px ${pad.b * MM}px ${pad.l * MM}px`,
    boxSizing: "border-box",
    gap: 6,
    background: "#fff",
    overflow: "hidden",
    borderRight: "0.5px dashed #ccc",
    borderBottom: "0.5px dashed #ccc",
  };

  const renderField = (key) => {
    if (!fields[key]?.on) return null;
    const val = key === "tracklist" ? tracklist : FIELD_VALUE(release, key);
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
  };

  if (layoutMode === "twoColumn") {
    const mainFields = fieldOrder.filter((k) => k !== "qr" && k !== "tracklist");
    return (
      <div style={outerStyle}>
        {showQR && (
          <div style={{ flexShrink: 0 }}>
            <img src={qrUrl} alt="QR" style={{ width: 76 * (qrScale || 1), height: 76 * (qrScale || 1), display: "block" }} crossOrigin="anonymous" />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "flex-start", gap: 2 }}>
          {mainFields.map(renderField)}
        </div>
        {showTracklist && (
          <div style={{ flex: 1, minWidth: 0, borderLeft: "0.5px solid #e0e0e0", paddingLeft: 5, overflow: "hidden" }}>
            {tracklist
              ? tracklist.split("\n").map((line, i) => (
                  <div key={i} style={{ fontSize: fs(FIELD_STYLES.tracklist.size), fontFamily: "monospace", color: FIELD_STYLES.tracklist.color, lineHeight: 1.3, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                    {line}
                  </div>
                ))
              : <div style={{ fontSize: fs(5), color: "#ccc", fontStyle: "italic" }}>—</div>
            }
          </div>
        )}
      </div>
    );
  }

  // Standard layout
  return (
    <div style={outerStyle}>
      {showQR && (
        <div style={{ flexShrink: 0 }}>
          <img src={qrUrl} alt="QR" style={{ width: 76 * (qrScale || 1), height: 76 * (qrScale || 1), display: "block" }} crossOrigin="anonymous" />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "flex-start", gap: 2 }}>
        {fieldOrder.filter((k) => k !== "qr").map(renderField)}
      </div>
    </div>
  );
}
