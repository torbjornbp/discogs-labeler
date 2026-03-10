import { QR_API, MM, FONT_FAMILY } from "../lib/templates.js";
import { FIELD_STYLES, FIELD_VALUE } from "../lib/fields.js";

export default function LabelCell({ release, template, fields, fontScale, qrScale, fieldOrder, pad, layoutMode, tracklistMap, col2Fields }) {
  const fs = (n) => n * (fontScale || 1);
  const qrUrl = QR_API(release.url);
  const showQR = fields.qr.on && fieldOrder.includes("qr");
  const tracklist = tracklistMap?.[release.releaseId] || [];

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
    if (key === "tracklist") {
      if (!val.length) return null;
      const showDur = fields.tracklist?.showDuration;
      return (
        <div key={key} style={{ overflow: "hidden", flexShrink: 0 }}>
          {val.map(({ pos, title, duration }, i) => (
            <div key={i} style={{ display: "flex", alignItems: "baseline", fontSize: fs(s.size), fontFamily: s.mono ? "monospace" : "inherit", color: s.color, lineHeight: 1.3 }}>
              <div style={{ flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                {pos}{pos ? " " : ""}{title}
              </div>
              {showDur && duration && (
                <div style={{ flexShrink: 0, paddingLeft: 3, opacity: 0.7 }}>
                  ({duration})
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }
    return (
      <div key={key} style={{
        fontSize: fs(s.size || 7),
        fontWeight: s.weight || 400,
        fontFamily: s.mono ? "monospace" : FONT_FAMILY,
        color: s.color || "#888",
        fontStyle: s.italic ? "italic" : "normal",
        lineHeight: 1.25,
        overflow: "hidden",
        display: "-webkit-box",
        WebkitLineClamp: s.clamp || 1,
        WebkitBoxOrient: "vertical",
        letterSpacing: s.mono ? "0.02em" : "normal",
        flexShrink: 0,
      }}>
        {key === "notes" && <span style={{ fontWeight: 700, fontStyle: "normal" }}>Notes: </span>}
        {val}
      </div>
    );
  };

  if (layoutMode === "twoColumn") {
    const col2 = col2Fields ? [...col2Fields] : ["tracklist"];
    const col1Keys = fieldOrder.filter((k) => k !== "qr" && !col2.includes(k));
    const col2Keys = fieldOrder.filter((k) => col2.includes(k));
    const hasCol2 = col2Keys.some((k) => fields[k]?.on);
    return (
      <div style={outerStyle}>
        {showQR && (
          <div style={{ flexShrink: 0 }}>
            <img src={qrUrl} alt="QR" style={{ width: 76 * (qrScale || 1), height: 76 * (qrScale || 1), display: "block" }} crossOrigin="anonymous" />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "flex-start", gap: 2, maxHeight: template.labelH - pad.t * MM - pad.b * MM, overflow: "hidden" }}>
          {col1Keys.map(renderField)}
        </div>
        {hasCol2 && (
          <div style={{ flex: 1, minWidth: 0, borderLeft: "0.5px solid #e0e0e0", paddingLeft: 5, overflow: "hidden", display: "flex", flexDirection: "column", gap: 2, maxHeight: template.labelH - pad.t * MM - pad.b * MM }}>
            {col2Keys.map(renderField)}
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
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "flex-start", gap: 2, maxHeight: template.labelH - pad.t * MM - pad.b * MM, overflow: "hidden" }}>
        {fieldOrder.filter((k) => k !== "qr").map(renderField)}
      </div>
    </div>
  );
}
