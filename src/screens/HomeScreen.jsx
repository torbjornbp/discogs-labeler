import { useState, useRef } from "react";

export default function HomeScreen({ inputMode, setInputMode, username, setUsername, token, setToken, handleFetch, handleCSV, error, setError }) {
  const [csvDrag, setCsvDrag] = useState(false);
  const fileInputRef = useRef(null);
  const dragDepthRef = useRef(0);

  return (
    <div style={{ minHeight: "100dvh", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, background: "#fff", boxSizing: "border-box" }}>
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
              <button key={mode} type="button" aria-pressed={inputMode === mode} onClick={() => { setInputMode(mode); setError(""); }}
                style={{ flex: 1, padding: "8px 12px", border: "1px solid #aaa", boxShadow: "2px 2px #ddd", background: inputMode === mode ? "royalblue" : "#f9f9f9", color: inputMode === mode ? "#fff" : "#555", fontWeight: inputMode === mode ? 700 : 400, fontSize: 13, cursor: "pointer" }}
              >{label}</button>
            ))}
          </div>

          {inputMode === "username" && (
            <div>
              <label htmlFor="discogs-username" style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#777", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Discogs Username</label>
              <p style={{ fontSize: 12, color: "#777", marginBottom: 10, lineHeight: 1.5 }}>For large collections, CSV Upload is faster and more reliable.</p>
              <input
                id="discogs-username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleFetch()}
                placeholder="e.g. jameslastlover"
                autoComplete="off"
                style={{ width: "100%", padding: "10px 12px", background: "#fff", border: "1px solid #aaa", color: "#000", fontSize: 14 }}
                onFocus={(e) => (e.target.style.borderColor = "royalblue")}
                onBlur={(e) => (e.target.style.borderColor = "#aaa")}
              />
              <details style={{ marginTop: 12 }}>
                <summary style={{ fontSize: 12, color: "#555", cursor: "pointer" }}>
                  Use a Discogs token (optional · 60 requests/min)
                </summary>
                <input
                  id="discogs-token"
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Discogs personal access token"
                  aria-label="Discogs personal access token"
                  autoComplete="off"
                  spellCheck={false}
                  style={{ width: "100%", padding: "8px 10px", marginTop: 8, background: "#fff", border: "1px solid #aaa", color: "#000", fontSize: 13, fontFamily: "monospace" }}
                  onFocus={(e) => (e.target.style.borderColor = "royalblue")}
                  onBlur={(e) => (e.target.style.borderColor = "#aaa")}
                />
                <p style={{ fontSize: 11, color: "#777", marginTop: 6, lineHeight: 1.45 }}>
                  Create a token at{" "}
                  <a href="https://www.discogs.com/settings/developers" target="_blank" rel="noreferrer" style={{ color: "royalblue" }}>
                    discogs.com/settings/developers
                  </a>
                  . Stored only in this tab and sent only to api.discogs.com. It is sent as a query
                  parameter to avoid a per-request CORS preflight (so it appears in the browser's
                  network panel). Without a token Discogs allows 25 requests/min (this app uses 20);
                  with one, 60 (this app uses 50).
                </p>
              </details>
            </div>
          )}

          {inputMode === "csv" && (
            <div>
              <label htmlFor="csv-upload" style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#777", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Discogs Collection or Inventory Export (.csv)</label>
              <input
                id="csv-upload"
                ref={fileInputRef}
                type="file"
                accept=".csv"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files[0];
                  e.target.value = "";
                  handleCSV(file);
                }}
              />
              <div
                role="button"
                tabIndex={0}
                aria-label="Upload a Discogs CSV export"
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInputRef.current?.click()}
                onDragEnter={() => { dragDepthRef.current += 1; setCsvDrag(true); }}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={() => {
                  dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
                  if (dragDepthRef.current === 0) setCsvDrag(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  dragDepthRef.current = 0;
                  setCsvDrag(false);
                  handleCSV(e.dataTransfer.files[0]);
                }}
                style={{ border: `2px dashed ${csvDrag ? "royalblue" : "#aaa"}`, padding: "28px 20px", textAlign: "center", cursor: "pointer", background: csvDrag ? "#f0f0ff" : "#fafafa" }}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#333", marginBottom: 4 }}>Drop your CSV here or click to browse</div>
                <div style={{ fontSize: 12, color: "#777" }}>Export a collection or inventory CSV from Discogs</div>
              </div>
            </div>
          )}

          {error && (
            <div role="alert" style={{ padding: "10px 14px", background: "#fff8f8", border: "1px solid #f88", color: "#822", fontSize: 13 }}>{error}</div>
          )}

          {inputMode === "username" && (
            <button
              type="button"
              className={username.trim() ? "btn-primary" : "btn"}
              onClick={handleFetch}
              disabled={!username.trim()}
              style={{ padding: "12px 24px", fontSize: 15 }}
            >
              Fetch Collection →
            </button>
          )}
        </div>

        <p style={{ fontSize: 12, color: "#777", textAlign: "center" }}>
          {inputMode === "username" ? "Only public Discogs collections are supported" : "Supports Discogs collection and inventory CSV exports"}
        </p>
        <a href="https://torbjorn.no" style={{ fontSize: 12, color: "#777" }}>← torbjorn.no</a>
      </div>
    </div>
  );
}
