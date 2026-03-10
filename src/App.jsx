import { useState, useEffect, useRef, useMemo } from "react";
import { TEMPLATES } from "./lib/templates.js";
import { LS } from "./lib/storage.js";
import { fetchAllReleases, formatRelease, parseDiscogsCSV, sortReleases } from "./lib/discogs.js";
import { fetchReleaseTracklist, RateLimitError, sleep } from "./lib/tracklist.js";
import HomeScreen from "./screens/HomeScreen.jsx";
import SelectScreen from "./screens/SelectScreen.jsx";
import PreviewScreen from "./screens/PreviewScreen.jsx";

export default function App() {
  const [screen, setScreen] = useState("home");
  const [username, setUsername] = useState("");
  const [releases, setReleases] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [template, setTemplate] = useState(() => {
    const savedId = LS.get("templateId", null);
    return (savedId && TEMPLATES.find((t) => t.id === savedId)) || TEMPLATES[0];
  });
  const [error, setError] = useState("");
  const [loadingMsg, setLoadingMsg] = useState("");
  const [fontScale, setFontScale] = useState(() => LS.get("fontScale", 1.0));
  const [qrScale, setQrScale] = useState(() => LS.get("qrScale", 0.65));
  const [pad, setPad] = useState(() => LS.get("pad", { t: 3.2, r: 4.5, b: 1.2, l: 4.5 }));
  const [controlTab, setControlTab] = useState("layout");
  const defaultFieldOrder = ["qr", "artist", "title", "year", "format", "catno", "label", "mediaCond", "sleeveCond", "notes", "folder", "rating", "tracklist"];
  const [fieldOrder, setFieldOrder] = useState(() => {
    const saved = LS.get("fieldOrder", null);
    if (!saved) return defaultFieldOrder;
    const newKeys = defaultFieldOrder.filter((k) => !saved.includes(k));
    return [...saved, ...newKeys];
  });
  const defaultFields = {
    qr:         { label: "QR Code",          on: true  },
    artist:     { label: "Artist",           on: true  },
    title:      { label: "Title",            on: true  },
    year:       { label: "Year",             on: false },
    format:     { label: "Format",           on: false },
    catno:      { label: "Cat No.",          on: true  },
    label:      { label: "Label",            on: false },
    mediaCond:  { label: "Media Condition",  on: false },
    sleeveCond: { label: "Sleeve Condition", on: false },
    notes:      { label: "Notes",            on: false },
    folder:     { label: "Folder",           on: false },
    rating:     { label: "Rating",           on: false },
    tracklist:  { label: "Tracklist",        on: false, showDuration: true },
  };
  const [fields, setFields] = useState(() => {
    const saved = LS.get("fields", null);
    if (!saved) return defaultFields;
    const merged = { ...defaultFields };
    for (const key of Object.keys(merged)) {
      if (saved[key]) merged[key] = { ...merged[key], ...saved[key] };
    }
    return merged;
  });
  const [layoutMode, setLayoutMode] = useState(() => LS.get("layoutMode", "single"));
  // Set of field keys assigned to the right column in twoColumn layout mode.
  // Stored as an array in localStorage (Set is not JSON-serializable).
  const [col2Fields, setCol2Fields] = useState(() => new Set(LS.get("col2Fields", ["tracklist"])));
  const [tracklistMap, setTracklistMap] = useState({});
  const cancelTracklistRef = useRef(false);
  const fetchAbortRef = useRef(null);
  const [inputMode, setInputMode] = useState("username");
  const [sortKey, setSortKey] = useState(() => LS.get("sortKey", null));
  const [sortDir, setSortDir] = useState(() => LS.get("sortDir", "asc"));

  useEffect(() => { LS.set("fields",     fields);    }, [fields]);
  useEffect(() => { LS.set("fieldOrder", fieldOrder); }, [fieldOrder]);
  useEffect(() => { LS.set("sortKey",    sortKey);   }, [sortKey]);
  useEffect(() => { LS.set("sortDir",    sortDir);   }, [sortDir]);
  useEffect(() => { LS.set("fontScale",  fontScale); }, [fontScale]);
  useEffect(() => { LS.set("qrScale",    qrScale);   }, [qrScale]);
  useEffect(() => { LS.set("pad",        pad);       }, [pad]);
  useEffect(() => { LS.set("templateId", template.id); }, [template]);
  useEffect(() => { LS.set("layoutMode", layoutMode); }, [layoutMode]);
  useEffect(() => { LS.set("col2Fields", [...col2Fields]); }, [col2Fields]);

  const sortedReleases = useMemo(() => sortReleases(releases, sortKey, sortDir), [releases, sortKey, sortDir]);
  const selectedReleases = sortedReleases.filter((r) => selected.has(r.id));

  function handleSortClick(key) {
    if (sortKey === key) {
      if (sortDir === "asc") { setSortDir("desc"); }
      else { setSortKey(null); setSortDir("asc"); }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  async function handleFetch() {
    if (!username.trim()) return;
    const abort = new AbortController();
    fetchAbortRef.current = abort;
    setError("");
    setScreen("loading");
    setLoadingMsg("Connecting to Discogs…");
    try {
      setLoadingMsg("Fetching your collection…");
      const raw = await fetchAllReleases(username.trim(), 0, ({ page, total, count, status }) => {
        setLoadingMsg(status
          ? `Page ${page}/${total ?? "?"} — ${status}`
          : `Fetching your collection… (page ${page}/${total ?? "?"}, ${count} releases)`);
      }, abort.signal);
      if (raw.length === 0) throw new Error("Collection is empty or private.");
      const formatted = raw.map(formatRelease);
      setReleases(formatted);
      setSelected(new Set());
      setScreen("select");
    } catch (e) {
      if (e.name === "AbortError") return;
      setError(e.message || "Failed to fetch collection.");
      setScreen("home");
    }
  }

  function cancelFetch() {
    fetchAbortRef.current?.abort();
    setScreen("home");
  }

  function handleCSV(file) {
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      setError("Please upload a .csv file exported from Discogs.");
      return;
    }
    setError("");
    setScreen("loading");
    setLoadingMsg("Reading CSV…");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        setLoadingMsg("Parsing collection…");
        const formatted = parseDiscogsCSV(e.target.result);
        if (formatted.length === 0) throw new Error("No records found in CSV.");
        setReleases(formatted);
        setSelected(new Set());
        setScreen("select");
      } catch (err) {
        setError(err.message || "Failed to parse CSV.");
        setScreen("home");
      }
    };
    reader.onerror = () => { setError("Failed to read file."); setScreen("home"); };
    reader.readAsText(file);
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // selectAll accepts a list so it can operate on the current filtered view
  function selectAll(list) { setSelected(new Set(list.map((r) => r.id))); }
  function clearAll() { setSelected(new Set()); }

  function handleBackFromSelect() {
    setScreen("home");
    setReleases([]);
    setSelected(new Set());
    setSortKey(null);
  }

  async function fetchTracklists(releases, onProgress) {
    cancelTracklistRef.current = false;
    const toFetch = releases.filter((r) => r.releaseId && tracklistMap[r.releaseId] === undefined);
    if (toFetch.length === 0) { onProgress(0, 0); return; }
    for (let i = 0; i < toFetch.length; i++) {
      if (cancelTracklistRef.current) break;
      let attempts = 0;
      while (attempts < 4) {
        try {
          const tracklist = await fetchReleaseTracklist(toFetch[i].releaseId);
          setTracklistMap((prev) => ({ ...prev, [toFetch[i].releaseId]: tracklist }));
          break;
        } catch (e) {
          if (e instanceof RateLimitError) {
            attempts++;
            onProgress(i, toFetch.length, e.waitSecs);
            await sleep(e.waitSecs * 1000);
          } else {
            break;
          }
        }
      }
      onProgress(i + 1, toFetch.length, null);
      if (i < toFetch.length - 1 && !cancelTracklistRef.current) await sleep(3000);
    }
  }

  function cancelTracklists() { cancelTracklistRef.current = true; }

  const labelConfig = { fields, setFields, fieldOrder, setFieldOrder, fontScale, setFontScale, qrScale, setQrScale, pad, setPad, layoutMode, setLayoutMode, col2Fields, setCol2Fields, tracklistMap, cancelTracklists };

  return (
    <div style={{ width: "100vw", minHeight: "100vh", overflowX: "hidden" }}>
      {screen === "home" && (
        <HomeScreen
          inputMode={inputMode}
          setInputMode={setInputMode}
          username={username}
          setUsername={setUsername}
          handleFetch={handleFetch}
          handleCSV={handleCSV}
          error={error}
          setError={setError}
        />
      )}

      {screen === "loading" && (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: "#fff" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #e0e0e0", borderTop: "3px solid royalblue", animation: "spin 0.8s linear infinite" }} />
          <p style={{ color: "#666666", fontSize: 14, textAlign: "center" }}>{loadingMsg}</p>
          <button className="btn" onClick={cancelFetch}>Cancel</button>
        </div>
      )}

      {screen === "select" && (
        <SelectScreen
          releases={releases}
          selected={selected}
          toggleSelect={toggleSelect}
          selectAll={selectAll}
          clearAll={clearAll}
          username={username}
          inputMode={inputMode}
          sortKey={sortKey}
          sortDir={sortDir}
          handleSortClick={handleSortClick}
          setSortKey={setSortKey}
          sortedReleases={sortedReleases}
          setScreen={(s) => s === "home" ? handleBackFromSelect() : setScreen(s)}
        />
      )}

      {screen === "preview" && (
        <PreviewScreen
          selectedReleases={selectedReleases}
          template={template}
          setTemplate={setTemplate}
          labelConfig={labelConfig}
          fetchTracklists={fetchTracklists}
          controlTab={controlTab}
          setControlTab={setControlTab}
          sortKey={sortKey}
          sortDir={sortDir}
          inputMode={inputMode}
          setScreen={setScreen}
        />
      )}
    </div>
  );
}
