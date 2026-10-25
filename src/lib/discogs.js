import { DISCOGS_API } from "./templates.js";
import { abortError, isAbortError, sleep } from "./async.js";
import { RateLimitError, discogsFetch, getDiscogsStatus } from "./discogsClient.js";

const MAX_PAGE_RETRIES = 3;

async function fetchPage(username, folder, page, externalSignal, onWait) {
  const url =
    `${DISCOGS_API}/users/${encodeURIComponent(username)}` +
    `/collection/folders/${encodeURIComponent(folder)}/releases?per_page=100&page=${page}`;

  return discogsFetch(url, {
    signal: externalSignal,
    onWait,
    parseResponse: async (res) => {
      if (res.status === 404) return { notFound: true };
      if (res.status === 401 || res.status === 403) {
        return { forbidden: true, status: res.status };
      }
      if (!res.ok) throw new Error(`Discogs API error: ${res.status}`);

      return { data: await res.json() };
    },
  });
}

export async function fetchAllReleases(username, folder = 0, onProgress, signal) {
  let page = 1;
  let totalPages = null;
  let allReleases = [];

  while (true) {
    if (signal?.aborted) throw abortError();

    let attempt = 0;
    let rateLimitRetries = 0;
    let result;

    const onWait = (ms, reason) => {
      if (reason !== "rate-limit") return;
      onProgress?.({
        page,
        total: totalPages,
        count: allReleases.length,
        status: `Rate limited — waiting ${Math.ceil(ms / 1000)}s…`,
      });
    };

    while (true) {
      try {
        result = await fetchPage(username, folder, page, signal, onWait);
      } catch (err) {
        if (isAbortError(err)) throw err;

        if (err instanceof RateLimitError) {
          rateLimitRetries++;
          if (rateLimitRetries > 1) {
            const tokenHint = getDiscogsStatus().authenticated
              ? ""
              : ", or add a Discogs token on the home screen (60 requests/min)";
            throw new Error(
              `Discogs is rate-limiting this connection. Wait a minute and try again, use a CSV export${tokenHint}.`
            );
          }
          // discogsFetch has already paused the queue; retrying will wait for
          // that pause and report a live countdown through onWait.
          continue;
        }

        // Offline/network errors are not worth retrying aggressively.
        if (err.retryable === false) throw err;

        attempt++;
        if (attempt >= MAX_PAGE_RETRIES) {
          throw new Error(
            `Failed to load page ${page} — ${err.message || "Discogs appears to be unavailable."} Try again later.`
          );
        }
        onProgress?.({ page, total: totalPages, count: allReleases.length, status: "Retrying…" });
        await sleep(5000, signal);
        continue;
      }

      if (result.notFound) {
        throw new Error(`User "${username}" not found on Discogs.`);
      }
      if (result.forbidden) {
        if (result.status === 401 && getDiscogsStatus().authenticated) {
          throw new Error(
            "Discogs rejected your token. Check that your Discogs token is correct and try again."
          );
        }
        throw new Error(
          "This collection is private or unavailable. Export it as a CSV from Discogs and upload that instead."
        );
      }
      break;
    }

    const { data } = result;
    allReleases = allReleases.concat(data.releases || []);
    totalPages = data.pagination?.pages ?? 1;

    onProgress?.({ page, total: totalPages, count: allReleases.length });
    if (page >= totalPages) break;
    page++;
    // Request pacing (including the rate-limit window) lives in discogsClient.
  }

  return allReleases;
}

export function formatRelease(r) {
  const info = r.basic_information || r;
  return {
    id: r.instance_id ?? r.id ?? info.id,
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
    rating: Number(r.rating) || 0,
  };
}

// Full CSV state machine. Parsing the whole text (instead of line-by-line)
// keeps newlines inside quoted notes from turning one record into two.
export function parseCsvRows(text) {
  const rows = [];
  const source = String(text ?? "").replace(/^\uFEFF/, "");
  let row = [];
  let cur = "";
  let inQuote = false;

  const endRow = () => {
    row.push(cur);
    cur = "";
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (inQuote) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuote = true;
    } else if (ch === ",") {
      row.push(cur);
      cur = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && source[i + 1] === "\n") i++;
      endRow();
    } else {
      cur += ch;
    }
  }

  if (cur !== "" || row.length > 0) endRow();
  return rows;
}

const INVENTORY_CONDITIONS = {
  MINT: "Mint (M)",
  NEAR_MINT: "Near Mint (NM or M-)",
  VERY_GOOD_PLUS: "Very Good Plus (VG+)",
  VERY_GOOD: "Very Good (VG)",
  GOOD_PLUS: "Good Plus (G+)",
  GOOD: "Good (G)",
  FAIR: "Fair (F)",
  POOR: "Poor (P)",
  NO_COVER: "No Cover",
  GENERIC: "Generic",
};

const formatInventoryCondition = (value) =>
  INVENTORY_CONDITIONS[value.toUpperCase()] || value.replace(/_/g, " ");

export function parseDiscogsCSV(text) {
  const rows = parseCsvRows(text);
  if (rows.length < 2) throw new Error("CSV appears to be empty.");

  const header = rows[0].map((h) => h.trim());
  const idx = (name) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const idxAny = (...names) => {
    for (const name of names) {
      const index = idx(name);
      if (index !== -1) return index;
    }
    return -1;
  };

  const iCatno      = idxAny("Catalog#", "catno");
  const iArtist     = idx("Artist");
  const iTitle      = idx("Title");
  const iLabel      = idx("Label");
  const iFormat     = idx("Format");
  const iYear       = idx("Released");
  const iId         = idx("release_id");
  const iListingId  = idx("listing_id");
  const iMediaCond  = idxAny("Collection Media Condition", "media_condition");
  const iSleeveCond = idxAny("Collection Sleeve Condition", "sleeve_condition");
  const iFolder     = idx("CollectionFolder");
  const iDateAdded  = idx("Date Added");
  const iNotes      = idx("Collection Notes");
  const iRating     = idx("Rating");
  const iPrice      = idx("price");

  if (iArtist === -1 || iTitle === -1) {
    throw new Error(
      "This doesn't look like a Discogs collection CSV (missing Artist or Title columns)."
    );
  }
  const inventory = iId === -1 && iListingId !== -1;
  if (iId === -1 && !inventory) {
    throw new Error(
      "This doesn't look like a supported Discogs CSV (missing release_id or listing_id column)."
    );
  }

  return rows.slice(1).map((cols, rowIdx) => {
    const get = (i) => (i >= 0 && i < cols.length ? cols[i].trim() : "");
    const releaseId = inventory ? "" : get(iId);
    const listingId = inventory ? get(iListingId) : "";
    const recordId = inventory ? listingId : releaseId;
    if (!recordId) {
      const key = inventory ? "listing_id" : "release_id";
      throw new Error(`CSV row ${rowIdx + 2} is missing a ${key}.`);
    }
    const url = inventory
      ? `https://www.discogs.com/sell/item/${encodeURIComponent(listingId)}`
      : `https://www.discogs.com/release/${encodeURIComponent(releaseId)}`;

    return {
      id: `csv-${rowIdx}-${recordId}`,
      releaseId,
      listingId,
      title:      get(iTitle)      || "Unknown Title",
      artist:     get(iArtist)     || "Unknown Artist",
      year:       get(iYear)       || "",
      label:      get(iLabel)      || "",
      catno:      get(iCatno)      || "",
      format:     get(iFormat)     || "",
      thumb:      "",
      url,
      mediaCond:  inventory ? formatInventoryCondition(get(iMediaCond)) : get(iMediaCond) || "",
      sleeveCond: inventory ? formatInventoryCondition(get(iSleeveCond)) : get(iSleeveCond) || "",
      folder:     get(iFolder)     || "",
      dateAdded:  get(iDateAdded)  || "",
      notes:      get(iNotes)      || "",
      rating:     parseInt(get(iRating), 10) || 0,
      price:      get(iPrice)      || "",
    };
  });
}

// Discogs CSV uses "YYYY-MM-DD HH:mm:ss" (UTC); the API uses ISO with a zone.
// Date.parse on the CSV form is not portable, so normalize it explicitly.
export function parseDiscogsDate(value) {
  if (!value) return 0;
  const raw = String(value).trim();
  if (!raw) return 0;
  const iso = raw.includes("T") ? raw : raw.replace(" ", "T");
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso);
  const time = Date.parse(hasZone ? iso : `${iso}Z`);
  return Number.isNaN(time) ? 0 : time;
}

export function formatDateAdded(value) {
  const time = parseDiscogsDate(value);
  return time ? new Date(time).toLocaleDateString() : "—";
}

export function sortReleases(list, sortKey, sortDir) {
  if (!sortKey) return list;

  return [...list].sort((a, b) => {
    let av = (a[sortKey] ?? "").toString();
    let bv = (b[sortKey] ?? "").toString();

    if (sortKey === "year" || sortKey === "rating") {
      const an = parseInt(av, 10) || 0;
      const bn = parseInt(bv, 10) || 0;
      return sortDir === "asc" ? an - bn : bn - an;
    }

    if (sortKey === "price") {
      const an = parseFloat(av) || 0;
      const bn = parseFloat(bv) || 0;
      return sortDir === "asc" ? an - bn : bn - an;
    }

    if (sortKey === "dateAdded") {
      const at = parseDiscogsDate(av);
      const bt = parseDiscogsDate(bv);
      return sortDir === "asc" ? at - bt : bt - at;
    }

    av = av.toLowerCase();
    bv = bv.toLowerCase();
    return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
  });
}
