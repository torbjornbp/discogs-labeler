import LabelCell from "./LabelCell.jsx";

export default function PrintSheet({ releases, template, fields, fontScale, qrScale, fieldOrder, pad, layoutMode, tracklistMap }) {
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
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${template.cols}, ${template.labelW}px)`,
        gridTemplateRows: `repeat(${template.rows}, ${template.labelH}px)`,
        gap: 0,
      }}>
        {cells.map((r, i) =>
          r ? (
            <LabelCell
              key={i}
              release={r}
              template={template}
              fields={fields}
              fontScale={fontScale}
              qrScale={qrScale}
              fieldOrder={fieldOrder}
              pad={pad}
              layoutMode={layoutMode}
              tracklistMap={tracklistMap}
            />
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
