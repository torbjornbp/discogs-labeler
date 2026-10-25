import { memo } from "react";
import { mmToPx, FONT_FAMILY, QR_BASE_PX } from "../lib/templates.js";
import { LABEL_LAYOUT } from "../lib/layout.js";
import { FIELD_STYLES, FIELD_VALUE } from "../lib/fields.js";
import { qrDataUrl } from "../lib/qr.js";

function LabelCell({ release, template, fields, fontScale, qrScale, fieldOrder, pad, layoutMode, tracklistMap, col2Fields, pricePrefix = "" }) {
  const fs = (n) => n * (fontScale || 1);
  const showQR = fieldOrder.includes("qr") && fields.qr?.on;
  const qrUrl = showQR ? qrDataUrl(release.url) : "";
  const tracklist = tracklistMap?.[release.releaseId] || [];

  const outerStyle = {
    width: template.labelW,
    height: template.labelH,
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    padding: `${mmToPx(pad.t)}px ${mmToPx(pad.r)}px ${mmToPx(pad.b)}px ${mmToPx(pad.l)}px`,
    boxSizing: "border-box",
    gap: mmToPx(LABEL_LAYOUT.qrGapMm),
    background: "#fff",
    overflow: "hidden",
    borderRight: "0.5px dashed #ccc",
    borderBottom: "0.5px dashed #ccc",
  };

  const renderField = (key) => {
    if (!fields[key]?.on) return null;
    const s = FIELD_STYLES[key] || {};

    if (key === "priceWriteIn") {
      const lineStyle = {
        display: "inline-block",
        flexShrink: 0,
        width: mmToPx(LABEL_LAYOUT.writeInLineMm),
        height: "1em",
        borderBottom: `${mmToPx(LABEL_LAYOUT.writeInBorderMm)}px solid ${s.color || "#111"}`,
      };
      return (
        <div key={key} style={{
          display: "flex",
          alignItems: "center",
          gap: mmToPx(LABEL_LAYOUT.fieldGapMm),
          fontSize: fs(s.size || 7),
          fontWeight: s.weight || 400,
          fontFamily: s.mono ? "monospace" : FONT_FAMILY,
          color: s.color || "#888",
          fontStyle: s.italic ? "italic" : "normal",
          lineHeight: 1.25,
          whiteSpace: "nowrap",
          overflow: "hidden",
          flexShrink: 0,
        }}>
          <span>Price:</span>
          <span aria-hidden="true" style={lineStyle} />
        </div>
      );
    }

    const val = key === "tracklist" ? tracklist : FIELD_VALUE(release, key, pricePrefix);
    if (!val) return null;
    if (key === "tracklist") {
      if (!val.length) return null;
      const showDur = fields.tracklist?.showDuration;
      return (
        <div key={key} style={{ overflow: "hidden", flexShrink: 0 }}>
          {val.slice(0, s.clamp || 20).map(({ pos, title, duration }, i) => (
            <div key={i} style={{ display: "flex", alignItems: "baseline", fontSize: fs(s.size), fontFamily: s.mono ? "monospace" : "inherit", letterSpacing: s.mono ? "0.02em" : "normal", color: s.color, lineHeight: 1.3 }}>
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
        {showQR && qrUrl && (
          <div style={{ flexShrink: 0 }}>
            <img src={qrUrl} alt="" style={{ width: QR_BASE_PX * (qrScale || 1), height: QR_BASE_PX * (qrScale || 1), display: "block" }} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "flex-start", gap: mmToPx(LABEL_LAYOUT.fieldGapMm), maxHeight: template.labelH - mmToPx(pad.t) - mmToPx(pad.b), overflow: "hidden" }}>
          {col1Keys.map(renderField)}
        </div>
        {hasCol2 && (
          <div style={{ flex: 1, minWidth: 0, borderLeft: `${mmToPx(LABEL_LAYOUT.twoColBorderMm)}px solid #e0e0e0`, paddingLeft: mmToPx(LABEL_LAYOUT.twoColPaddingMm), overflow: "hidden", display: "flex", flexDirection: "column", gap: mmToPx(LABEL_LAYOUT.fieldGapMm), maxHeight: template.labelH - mmToPx(pad.t) - mmToPx(pad.b) }}>
            {col2Keys.map(renderField)}
          </div>
        )}
      </div>
    );
  }

  // Standard layout
  return (
    <div style={outerStyle}>
      {showQR && qrUrl && (
        <div style={{ flexShrink: 0 }}>
          <img src={qrUrl} alt="" style={{ width: QR_BASE_PX * (qrScale || 1), height: QR_BASE_PX * (qrScale || 1), display: "block" }} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "flex-start", gap: mmToPx(LABEL_LAYOUT.fieldGapMm), maxHeight: template.labelH - mmToPx(pad.t) - mmToPx(pad.b), overflow: "hidden" }}>
        {fieldOrder.filter((k) => k !== "qr").map(renderField)}
      </div>
    </div>
  );
}

export default memo(LabelCell);
