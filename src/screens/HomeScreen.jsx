import { useState, useRef } from "react";

export default function HomeScreen({ inputMode, setInputMode, username, setUsername, handleFetch, handleCSV, error, setError }) {
  const [csvDrag, setCsvDrag] = useState(false);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);

  return (
    <div style={{ minHeight: "100vh", width: "100vw", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, background: "#f5f5f5", boxSizing: "border-box" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32, width: "100%", maxWidth: 440, margin: "0 auto" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#1a6ef5", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 3px #fff, 0 0 0 5px #1a6ef544" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f5f5f5" }} />
            </div>
            <span style={{ fontSize: 28, fontWeight: 700, color: "#111111", letterSpacing: "-0.02em" }}>
              Discogs<span style={{ color: "#1a6ef5" }}> Label Printer</span>
            </span>
          </div>
          <p style={{ fontSize: 14, color: "#666666", lineHeight: 1.5, maxWidth: 320, textAlign: "center" }}>
            Generate printable QR label sheets from your Discogs collection
          </p>
        </div>

        <div style={{ background: "#ffffff", border: "1px solid #e0e0e0", borderRadius: 16, padding: 28, width: "100%", display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", background: "#f5f5f5", borderRadius: 10, padding: 3, gap: 3 }}>
            {[["username", "Discogs Username"], ["csv", "CSV Upload"]].map(([mode, label]) => (
              <button key={mode} onClick={() => { setInputMode(mode); setError(""); }}
                style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "none", background: inputMode === mode ? "#ffffff" : "transparent", color: inputMode === mode ? "#111" : "#999", fontWeight: inputMode === mode ? 600 : 400, fontSize: 13, cursor: "pointer", boxShadow: inputMode === mode ? "0 1px 3px #0000001a" : "none", transition: "all 0.15s" }}
              >{label}</button>
            ))}
          </div>

          {inputMode === "username" && (
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#666666", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Discogs Username</label>
              <input
                ref={inputRef}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleFetch()}
                placeholder="e.g. vinylhunter99"
                autoComplete="off"
                style={{ width: "100%", padding: "12px 16px", background: "#f5f5f5", border: "1px solid #e0e0e0", borderRadius: 10, color: "#111111", fontSize: 15, outline: "none", transition: "border-color 0.2s" }}
                onFocus={(e) => (e.target.style.borderColor = "#1a6ef5")}
                onBlur={(e) => (e.target.style.borderColor = "#e0e0e0")}
              />
            </div>
          )}

          {inputMode === "csv" && (
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#666666", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Discogs Collection Export (.csv)</label>
              <input ref={fileInputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => handleCSV(e.target.files[0])} />
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setCsvDrag(true); }}
                onDragLeave={() => setCsvDrag(false)}
                onDrop={(e) => { e.preventDefault(); setCsvDrag(false); handleCSV(e.dataTransfer.files[0]); }}
                style={{ border: `2px dashed ${csvDrag ? "#1a6ef5" : "#d0d0d0"}`, borderRadius: 10, padding: "28px 20px", textAlign: "center", cursor: "pointer", background: csvDrag ? "#eff6ff" : "#fafafa", transition: "all 0.15s" }}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#333", marginBottom: 4 }}>Drop your CSV here or click to browse</div>
                <div style={{ fontSize: 12, color: "#999" }}>Export from Discogs → My Collection → Export</div>
              </div>
            </div>
          )}

          {error && (
            <div style={{ padding: "10px 14px", background: "#fff0f0", border: "1px solid #ffaaaa", borderRadius: 8, color: "#cc2222", fontSize: 13 }}>{error}</div>
          )}

          {inputMode === "username" && (
            <button
              onClick={handleFetch}
              disabled={!username.trim()}
              style={{ padding: "14px 24px", background: username.trim() ? "#1a6ef5" : "#e0e0e0", color: username.trim() ? "#ffffff" : "#999999", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: username.trim() ? "pointer" : "not-allowed", transition: "all 0.2s", letterSpacing: "-0.01em" }}
            >
              Fetch Collection →
            </button>
          )}
        </div>

        <p style={{ fontSize: 12, color: "#bbbbbb", textAlign: "center" }}>
          {inputMode === "username" ? "Only public Discogs collections are supported" : "Export via Discogs → My Collection → Export Collection"}
        </p>
      </div>
    </div>
  );
}
