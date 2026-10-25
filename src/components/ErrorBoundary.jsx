import { Component } from "react";
import { clearAllSettings } from "../lib/storage.js";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.handleReload = () => window.location.reload();
    this.handleReset = () => {
      clearAllSettings();
      window.location.reload();
    };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Unhandled render error:", error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div className="box" style={{ padding: 20, width: "100%", maxWidth: 560 }}>
          <h1 style={{ fontSize: 18, marginBottom: 12 }}>Something went wrong</h1>
          <pre
            style={{
              margin: 0,
              padding: 10,
              maxHeight: 240,
              overflow: "auto",
              background: "#fff",
              border: "1px solid #ddd",
              fontFamily: "monospace",
              fontSize: 12,
              lineHeight: 1.4,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {error?.message || String(error)}
          </pre>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
            <button type="button" className="btn btn-primary" onClick={this.handleReload}>
              Reload
            </button>
            <button type="button" className="btn" onClick={this.handleReset}>
              Reset saved settings
            </button>
          </div>
        </div>
      </div>
    );
  }
}
