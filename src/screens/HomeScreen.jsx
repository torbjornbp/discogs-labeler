import { useState, useRef } from "react";

export default function HomeScreen({ inputMode, setInputMode, username, setUsername, handleFetch, handleCSV, error, setError }) {
  const [csvDrag, setCsvDrag] = useState(false);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);

  return (
    <div style={{ minHeight: "100vh", width: "100vw", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, background: "#fff", boxSizing: "border-box" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32, width: "100%", maxWidth: 440, margin: "0 auto" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: "#000", letterSpacing: "-0.02em" }}>
              Torbjørn's <span style={{ color: "royalblue" }}>Discogs Labeler</span>
            </span>
          </div>
          <p style={{ fontSize: 14, color: "#666", lineHeight: 1.5, maxWidth: 320, textAlign: "center", margin: "0 auto" }}>
            Generate printable QR label sheets from your Discogs collection
          </p>
        </div>

        <div className="box" style={{ padding: 28, width: "100%", display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", gap: 3 }}>
            {[["username", "Discogs Username"], ["csv", "CSV Upload"]].map(([mode, label]) => (
              <button key={mode} onClick={() => { setInputMode(mode); setError(""); }}
                style={{ flex: 1, padding: "8px 12px", border: "1px solid #aaa", boxShadow: "2px 2px #ddd", background: inputMode === mode ? "royalblue" : "#f9f9f9", color: inputMode === mode ? "#fff" : "#555", fontWeight: inputMode === mode ? 700 : 400, fontSize: 13, cursor: "pointer" }}
              >{label}</button>
            ))}
          </div>

          {inputMode === "username" && (
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#777", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Discogs Username</label>
              <input
                ref={inputRef}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleFetch()}
                placeholder="e.g. jameslastlover"
                autoComplete="off"
                style={{ width: "100%", padding: "10px 12px", background: "#fff", border: "1px solid #aaa", color: "#000", fontSize: 14, outline: "none" }}
                onFocus={(e) => (e.target.style.borderColor = "royalblue")}
                onBlur={(e) => (e.target.style.borderColor = "#aaa")}
              />
            </div>
          )}

          {inputMode === "csv" && (
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#777", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Discogs Collection Export (.csv)</label>
              <input ref={fileInputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => handleCSV(e.target.files[0])} />
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setCsvDrag(true); }}
                onDragLeave={() => setCsvDrag(false)}
                onDrop={(e) => { e.preventDefault(); setCsvDrag(false); handleCSV(e.dataTransfer.files[0]); }}
                style={{ border: `2px dashed ${csvDrag ? "royalblue" : "#aaa"}`, padding: "28px 20px", textAlign: "center", cursor: "pointer", background: csvDrag ? "#f0f0ff" : "#fafafa" }}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#333", marginBottom: 4 }}>Drop your CSV here or click to browse</div>
                <div style={{ fontSize: 12, color: "#777" }}>Export from Discogs → My Collection → Export</div>
              </div>
            </div>
          )}

          {error && (
            <div style={{ padding: "10px 14px", background: "#fff8f8", border: "1px solid #f88", color: "#822", fontSize: 13 }}>{error}</div>
          )}

          {inputMode === "username" && (
            <button
              className={username.trim() ? "btn-primary" : "btn"}
              onClick={handleFetch}
              disabled={!username.trim()}
              style={{ padding: "12px 24px", fontSize: 15 }}
            >
              Fetch Collection →
            </button>
          )}
        </div>

        <p style={{ fontSize: 12, color: "#aaa", textAlign: "center" }}>
          {inputMode === "username" ? "Only public Discogs collections are supported" : "Export via Discogs → My Collection → Export Collection"}
        </p>
      </div>
    </div>
  );
}
