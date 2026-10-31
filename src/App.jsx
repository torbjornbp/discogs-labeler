import { useState, useEffect, useRef, useMemo } from "react";
import { TEMPLATES } from "./lib/templates.js";
import { LS, SS } from "./lib/storage.js";
import { fetchAllReleases, formatRelease, parseDiscogsCSV, sortReleases } from "./lib/discogs.js";
import { fetchReleaseTracklist, RateLimitError } from "./lib/tracklist.js";
import { isAbortError } from "./lib/async.js";
import { configureDiscogs, getDiscogsIntervalMs } from "./lib/discogsClient.js";
import { COLUMNS } from "./lib/fields.js";
import {
  createDefaultProfile,
  normalizeProfile,
  serializeProfiles,
} from "./lib/profiles.js";
import HomeScreen from "./screens/HomeScreen.jsx";
import SelectScreen from "./screens/SelectScreen.jsx";
import PreviewScreen from "./screens/PreviewScreen.jsx";

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const normalizeSortKey = (value) =>
  COLUMNS.some((column) => column.key === value) ? value : null;

const normalizePricePrefix = (value) =>
  String(value ?? "")
    .replace(/[\r\n]/g, "")
    .slice(0, 8);

// Load per-template profiles. Prefer the new map; fall back to the individual
// settings keys written by older versions, migrating them to the Avery
// profile so an existing layout survives the upgrade.
function loadProfiles() {
  const saved = LS.get("profiles", null);
  if (isRecord(saved)) {
    const profiles = {};
    for (const item of TEMPLATES) {
      if (saved[item.id] !== undefined) {
        profiles[item.id] = normalizeProfile(saved[item.id], item);
      }
    }
    if (Object.keys(profiles).length > 0) return profiles;
  }

  const legacyTemplate =
    TEMPLATES.find((item) => item.id === "avery-3448") || TEMPLATES[0];
  const legacy = {
    fields: LS.get("fields", null),
    fieldOrder: LS.get("fieldOrder", null),
    fontScale: LS.get("fontScale", null),
    qrScale: LS.get("qrScale", null),
    pad: LS.get("pad", null),
    layoutMode: LS.get("layoutMode", null),
    col2Fields: LS.get("col2Fields", null),
  };
  return {
    [legacyTemplate.id]: normalizeProfile(legacy, legacyTemplate),
  };
}

const tracklistErrorMessage = (err) => {
  const detail = String(err?.message || "Discogs returned an unexpected response")
    .trim()
    .replace(/[.!?]+$/, "");
  return `Could not fetch tracklists: ${detail}. Check your connection, then try Fetch Tracklists again.`;
};

export default function App() {
  const [screen, setScreen] = useState("home");
  const [username, setUsername] = useState("");
  const [releases, setReleases] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [template, setTemplate] = useState(() => {
    const savedId = LS.get("templateId", null);
    return TEMPLATES.find((item) => item.id === savedId) || TEMPLATES[0];
  });
  const [error, setError] = useState("");
  const [loadingMsg, setLoadingMsg] = useState("");
  const [profiles, setProfiles] = useState(loadProfiles);
  const [pricePrefix, setPricePrefixState] = useState(() =>
    normalizePricePrefix(LS.get("pricePrefix", ""))
  );
  const [controlTab, setControlTab] = useState("layout");
  const [tracklistMap, setTracklistMap] = useState({});
  const [inputMode, setInputMode] = useState(() =>
    LS.get("inputMode", "username") === "csv" ? "csv" : "username"
  );
  // The Discogs token is a credential. Keep it in sessionStorage only.
  const [token, setToken] = useState(() => SS.get("token", ""));
  const [sortKey, setSortKey] = useState(() =>
    normalizeSortKey(LS.get("sortKey", null))
  );
  const [sortDir, setSortDir] = useState(() =>
    LS.get("sortDir", "asc") === "desc" ? "desc" : "asc"
  );

  const fetchAbortRef = useRef(null);
  const readerRef = useRef(null);
  const loadRunRef = useRef(0);
  const tracklistRunRef = useRef(0);
  const tracklistAbortRef = useRef(null);

  const currentProfile = useMemo(
    () => profiles[template.id] || createDefaultProfile(template),
    [profiles, template]
  );

  // Merge an update into the current template's profile only, preserving every
  // other template's settings. Functional updaters receive the current value;
  // the normalised fallback means they never see an undefined profile.
  function updateCurrentProfile(key, update) {
    setProfiles((prev) => {
      const base = normalizeProfile(prev[template.id], template);
      const value = typeof update === "function" ? update(base[key]) : update;
      return {
        ...prev,
        [template.id]: normalizeProfile({ ...base, [key]: value }, template),
      };
    });
  }

  const setFields = (value) => updateCurrentProfile("fields", value);
  const setFieldOrder = (value) => updateCurrentProfile("fieldOrder", value);
  const setFontScale = (value) => updateCurrentProfile("fontScale", value);
  const setPriceScale = (value) => updateCurrentProfile("priceScale", value);
  const setQrScale = (value) => updateCurrentProfile("qrScale", value);
  const setPad = (value) => updateCurrentProfile("pad", value);
  const setLayoutMode = (value) => updateCurrentProfile("layoutMode", value);
  const setCol2Fields = (value) => updateCurrentProfile("col2Fields", value);
  const setPricePrefix = (value) =>
    setPricePrefixState((prev) =>
      normalizePricePrefix(typeof value === "function" ? value(prev) : value)
    );

  useEffect(() => { LS.set("profiles", serializeProfiles(profiles)); }, [profiles]);
  useEffect(() => { LS.set("pricePrefix", pricePrefix); }, [pricePrefix]);
  useEffect(() => { LS.set("sortKey", sortKey); }, [sortKey]);
  useEffect(() => { LS.set("sortDir", sortDir); }, [sortDir]);
  useEffect(() => { LS.set("templateId", template.id); }, [template]);
  useEffect(() => { LS.set("inputMode", inputMode); }, [inputMode]);

  useEffect(() => {
    configureDiscogs({ token });
    if (token) SS.set("token", token);
    else SS.remove("token");
  }, [token]);

  useEffect(() => () => {
    loadRunRef.current++;
    tracklistRunRef.current++;
    fetchAbortRef.current?.abort();
    readerRef.current?.abort();
    tracklistAbortRef.current?.abort();
  }, []);

  const sortedReleases = useMemo(
    () => sortReleases(releases, sortKey, sortDir),
    [releases, sortKey, sortDir]
  );
  const selectedReleases = useMemo(
    () => sortedReleases.filter((release) => selected.has(release.id)),
    [sortedReleases, selected]
  );

  function handleSortClick(key) {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else {
        setSortKey(null);
        setSortDir("asc");
      }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  async function handleFetch() {
    const name = username.trim();
    if (!name) return;

    configureDiscogs({ token });
    const run = ++loadRunRef.current;
    const abort = new AbortController();
    fetchAbortRef.current = abort;
    setError("");
    setScreen("loading");
    setLoadingMsg("Fetching your collection…");

    try {
      const raw = await fetchAllReleases(name, 0, (progress) => {
        if (loadRunRef.current !== run) return;
        if (progress.status) {
          setLoadingMsg(`Page ${progress.page}/${progress.total ?? "?"} — ${progress.status}`);
          return;
        }
        const remaining = progress.total
          ? Math.max(0, progress.total - progress.page)
          : 0;
        const etaMin = remaining
          ? Math.max(1, Math.ceil((remaining * getDiscogsIntervalMs()) / 60000))
          : 0;
        setLoadingMsg(
          `Fetching your collection… (page ${progress.page}/${progress.total ?? "?"}, ${progress.count} releases)` +
            (etaMin ? ` · ~${etaMin} min left` : "")
        );
      }, abort.signal);

      if (loadRunRef.current !== run || abort.signal.aborted) return;
      if (raw.length === 0) throw new Error("Collection is empty or private.");

      setReleases(raw.map(formatRelease));
      setSelected(new Set());
      setScreen("select");
    } catch (err) {
      if (isAbortError(err) || loadRunRef.current !== run) return;
      setError(err.message || "Failed to fetch collection.");
      setScreen("home");
    } finally {
      if (fetchAbortRef.current === abort) fetchAbortRef.current = null;
    }
  }

  function handleCSV(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a .csv file exported from Discogs.");
      return;
    }

    const run = ++loadRunRef.current;
    setError("");
    setScreen("loading");
    setLoadingMsg("Reading CSV…");

    const reader = new FileReader();
    readerRef.current = reader;

    reader.onload = (event) => {
      if (readerRef.current !== reader || loadRunRef.current !== run) return;
      readerRef.current = null;
      const text = event.target.result;

      // Let the loading screen paint before the (synchronous) parse so a large
      // export doesn't just freeze on "Reading CSV…".
      setTimeout(() => {
        if (loadRunRef.current !== run) return;
        try {
          setLoadingMsg("Parsing collection…");
          const formatted = parseDiscogsCSV(text);
          if (formatted.length === 0) throw new Error("No records found in CSV.");
          setReleases(formatted);
          setSelected(new Set());
          setScreen("select");
        } catch (err) {
          if (loadRunRef.current !== run) return;
          setError(err.message || "Failed to parse CSV.");
          setScreen("home");
        }
      }, 0);
    };

    reader.onerror = () => {
      if (readerRef.current !== reader || loadRunRef.current !== run) return;
      readerRef.current = null;
      setError("Failed to read file.");
      setScreen("home");
    };

    reader.readAsText(file);
  }

  function cancelLoad() {
    loadRunRef.current++;
    fetchAbortRef.current?.abort();
    fetchAbortRef.current = null;

    const reader = readerRef.current;
    readerRef.current = null;
    if (reader) {
      try {
        reader.abort();
      } catch {
        // Reader already finished.
      }
    }

    setScreen("home");
    setLoadingMsg("");
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // selectAll accepts a list so it can operate on the current filtered view
  function selectAll(list) { setSelected(new Set(list.map((release) => release.id))); }
  function clearAll() { setSelected(new Set()); }

  function handleBackFromSelect() {
    cancelTracklists();
    setScreen("home");
    setReleases([]);
    setSelected(new Set());
    setSortKey(null);
  }

  function cancelTracklists() {
    // Invalidate the run before aborting so a canceled loop can never publish
    // progress or results, even if it wakes up later.
    tracklistRunRef.current++;
    tracklistAbortRef.current?.abort();
    tracklistAbortRef.current = null;
  }

  async function fetchTracklists(releaseList, onProgress) {
    configureDiscogs({ token });
    const run = ++tracklistRunRef.current;
    tracklistAbortRef.current?.abort();
    const controller = new AbortController();
    tracklistAbortRef.current = controller;
    const isCurrent = () => run === tracklistRunRef.current && !controller.signal.aborted;

    const toFetch = [];
    let completed = 0;

    try {
      const seen = new Set();
      for (const release of releaseList) {
        if (!release.releaseId || tracklistMap[release.releaseId] !== undefined) continue;
        if (seen.has(release.releaseId)) continue;
        seen.add(release.releaseId);
        toFetch.push(release);
      }

      if (toFetch.length === 0) {
        if (isCurrent()) onProgress?.(0, 0, null);
        return;
      }

      let consecutiveRateLimits = 0;
      for (let i = 0; i < toFetch.length; i++) {
        if (!isCurrent()) return;

        let attempts = 0;
        while (attempts < 2) {
          if (!isCurrent()) return;
          try {
            const tracklist = await fetchReleaseTracklist(
              toFetch[i].releaseId,
              controller.signal,
              (ms, reason) => {
                if (reason === "rate-limit" && isCurrent()) {
                  onProgress?.(i, toFetch.length, Math.ceil(ms / 1000));
                }
              }
            );
            if (!isCurrent()) return;
            setTracklistMap((prev) => ({ ...prev, [toFetch[i].releaseId]: tracklist }));
            consecutiveRateLimits = 0;
            break;
          } catch (err) {
            if (!isCurrent() || isAbortError(err)) return;
            if (err instanceof RateLimitError) {
              attempts++;
              consecutiveRateLimits++;
              if (attempts >= 2 || consecutiveRateLimits >= 2) {
                onProgress?.(
                  i,
                  toFetch.length,
                  null,
                  "Discogs is rate-limiting tracklist requests. Wait a few minutes and try again, add a token, or select fewer records."
                );
                return;
              }
              // discogsFetch has already paused the queue; the next call waits
              // for that pause and reports the countdown through onWait.
              onProgress?.(i, toFetch.length, err.waitSecs);
              continue;
            }
            // Leave failed requests uncached so the user can retry them. Stop
            // immediately so a later progress update cannot hide the error.
            console.warn(`Tracklist fetch failed for ${toFetch[i].releaseId}:`, err.message);
            onProgress?.(i, toFetch.length, null, tracklistErrorMessage(err));
            return;
          }
        }

        if (!isCurrent()) return;
        completed = i + 1;
        onProgress?.(completed, toFetch.length, null);
      }
    } catch (err) {
      if (!isCurrent() || isAbortError(err)) return;
      console.warn("Tracklist fetch stopped:", err);
      onProgress?.(completed, toFetch.length, null, tracklistErrorMessage(err));
    } finally {
      if (tracklistAbortRef.current === controller) tracklistAbortRef.current = null;
    }
  }

  const labelConfig = {
    fields: currentProfile.fields,
    setFields,
    fieldOrder: currentProfile.fieldOrder,
    setFieldOrder,
    fontScale: currentProfile.fontScale,
    setFontScale,
    priceScale: currentProfile.priceScale,
    setPriceScale,
    qrScale: currentProfile.qrScale,
    setQrScale,
    pad: currentProfile.pad,
    setPad,
    layoutMode: currentProfile.layoutMode,
    setLayoutMode,
    col2Fields: currentProfile.col2Fields,
    setCol2Fields,
    pricePrefix,
    setPricePrefix,
    tracklistMap,
    cancelTracklists,
  };

  return (
    <div style={{ width: "100%", minHeight: "100dvh", overflowX: "hidden" }}>
      {screen === "home" && (
        <HomeScreen
          inputMode={inputMode}
          setInputMode={setInputMode}
          username={username}
          setUsername={setUsername}
          token={token}
          setToken={setToken}
          handleFetch={handleFetch}
          handleCSV={handleCSV}
          error={error}
          setError={setError}
        />
      )}

      {screen === "loading" && (
        <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: "#fff" }}>
          <div
            aria-hidden="true"
            style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #e0e0e0", borderTop: "3px solid royalblue", animation: "spin 0.8s linear infinite" }}
          />
          <p role="status" aria-live="polite" style={{ color: "#666666", fontSize: 14, textAlign: "center" }}>
            {loadingMsg}
          </p>
          <button type="button" className="btn" onClick={cancelLoad}>Cancel</button>
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
          pricePrefix={pricePrefix}
          sortKey={sortKey}
          sortDir={sortDir}
          handleSortClick={handleSortClick}
          setSortKey={setSortKey}
          sortedReleases={sortedReleases}
          setScreen={(next) => next === "home" ? handleBackFromSelect() : setScreen(next)}
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
