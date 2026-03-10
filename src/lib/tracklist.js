import { DISCOGS_API } from "./templates.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class RateLimitError extends Error {
  constructor(waitSecs) {
    super("Rate limited");
    this.waitSecs = waitSecs;
  }
}

// Converts the raw Discogs API tracklist array to an array of {pos, title, duration} objects.
// Headings (e.g. "Side A") are stripped — only playable tracks are included.
export function formatTracklist(tracks) {
  return (tracks || [])
    .filter((t) => t.type_ !== "heading" && t.title)
    .map((t) => ({
      pos:      t.position || "",
      title:    t.title,
      duration: t.duration || "",
    }));
}

// Throws RateLimitError on 429 or network-level block
export async function fetchReleaseTracklist(releaseId) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  let res;
  try {
    res = await fetch(`${DISCOGS_API}/releases/${releaseId}`, {
      headers: { "User-Agent": "DiscogsLabelPrinter/1.0" },
      signal: controller.signal,
    });
  } catch {
    // TCP-level block from Discogs hard rate-limit — wait for full window reset
    throw new RateLimitError(60);
  } finally {
    clearTimeout(timeout);
  }
  if (res.status === 429) {
    const wait = parseInt(res.headers.get("Retry-After") || "60", 10);
    throw new RateLimitError(Math.max(wait, 60));
  }
  if (!res.ok) return "";
  const data = await res.json();
  return formatTracklist(data.tracklist);
}

export { sleep };
