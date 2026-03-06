import { DISCOGS_API } from "./templates.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchAllReleases(username, folder = 0) {
  let page = 1;
  let allReleases = [];
  while (true) {
    const res = await fetch(
      `${DISCOGS_API}/users/${username}/collection/folders/${folder}/releases?per_page=100&page=${page}`,
      { headers: { "User-Agent": "DiscogsLabelPrinter/1.0" } }
    );
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") || "1", 10);
      await sleep(Math.max(retryAfter, 1) * 1000);
      continue;
    }
    if (!res.ok) throw new Error(`Discogs error: ${res.status}`);
    const data = await res.json();
    allReleases = allReleases.concat(data.releases || []);
    if (page >= (data.pagination?.pages || 1)) break;
    page++;
    await sleep(300);
  }
  return allReleases;
}

export function formatRelease(r) {
  const info = r.basic_information || r;
  return {
    id: r.instance_id || r.id || info.id,
    releaseId: info.id,
    title: info.title || "Unknown Title",
    artist: (info.artists || []).map((a) => a.name.replace(/\s*\(\d+\)$/, "")).join(", ") || "Unknown Artist",
    year: info.year || "",
    label: (info.labels || [])[0]?.name || "",
    catno: (info.labels || [])[0]?.catno || "",
    format: [
      (info.formats || [])[0]?.name,
      ...((info.formats || [])[0]?.descriptions || []),
    ].filter(Boolean).join(", ") || "",
    thumb: info.thumb || "",
    url: `https://www.discogs.com/release/${info.id}`,
    dateAdded: r.date_added || "",
    rating: r.rating || 0,
  };
}

export function parseDiscogsCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error("CSV appears to be empty.");

  const header = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const idx = (name) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());

  const iCatno      = idx("Catalog#");
  const iArtist     = idx("Artist");
  const iTitle      = idx("Title");
  const iLabel      = idx("Label");
  const iFormat     = idx("Format");
  const iYear       = idx("Released");
  const iId         = idx("release_id");
  const iMediaCond  = idx("Collection Media Condition");
  const iSleeveCond = idx("Collection Sleeve Condition");
  const iFolder     = idx("CollectionFolder");
  const iDateAdded  = idx("Date Added");
  const iNotes      = idx("Collection Notes");
  const iRating     = idx("Rating");

  function parseRow(line) {
    const fields = [];
    let cur = "", inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuote = !inQuote; }
      } else if (ch === "," && !inQuote) { fields.push(cur); cur = ""; }
      else { cur += ch; }
    }
    fields.push(cur);
    return fields;
  }

  return lines.slice(1).filter((l) => l.trim()).map((line, rowIdx) => {
    const cols = parseRow(line);
    const get = (i) => (i >= 0 && i < cols.length ? cols[i].trim().replace(/^"|"$/g, "") : "");
    const releaseId = get(iId);
    return {
      id: `csv-${rowIdx}-${releaseId}`,
      releaseId,
      title:      get(iTitle)      || "Unknown Title",
      artist:     get(iArtist)     || "Unknown Artist",
      year:       get(iYear)       || "",
      label:      get(iLabel)      || "",
      catno:      get(iCatno)      || "",
      format:     get(iFormat)     || "",
      thumb:      "",
      url: releaseId ? `https://www.discogs.com/release/${releaseId}` : "https://www.discogs.com",
      mediaCond:  get(iMediaCond)  || "",
      sleeveCond: get(iSleeveCond) || "",
      folder:     get(iFolder)     || "",
      dateAdded:  get(iDateAdded)  || "",
      notes:      get(iNotes)      || "",
      rating:     parseInt(get(iRating)) || 0,
    };
  });
}

export function sortReleases(list, sortKey, sortDir) {
  if (!sortKey) return list;
  return [...list].sort((a, b) => {
    let av = (a[sortKey] ?? "").toString().toLowerCase();
    let bv = (b[sortKey] ?? "").toString().toLowerCase();
    if (sortKey === "year" || sortKey === "rating") {
      av = parseInt(av) || 0;
      bv = parseInt(bv) || 0;
      return sortDir === "asc" ? av - bv : bv - av;
    }
    if (sortKey === "dateAdded") {
      av = av ? new Date(av).getTime() : 0;
      bv = bv ? new Date(bv).getTime() : 0;
      return sortDir === "asc" ? av - bv : bv - av;
    }
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });
}
