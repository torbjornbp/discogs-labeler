import { DISCOGS_API } from "./templates.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class RateLimitError extends Error {
  constructor(waitSecs) {
    super("Rate limited");
    this.waitSecs = waitSecs;
  }
}

export function formatTracklist(tracks) {
  return (tracks || [])
    .filter((t) => t.type_ !== "heading" && t.title)
    .map((t) => (t.position ? `${t.position} ${t.title}` : t.title))
    .join("\n");
}

// Throws RateLimitError on 429 or network-level block
export async function fetchReleaseTracklist(releaseId) {
  let res;
  try {
    res = await fetch(`${DISCOGS_API}/releases/${releaseId}`, {
      headers: { "User-Agent": "DiscogsLabelPrinter/1.0" },
    });
  } catch {
    // TCP-level block from Discogs hard rate-limit
    throw new RateLimitError(60);
  }
  if (res.status === 429) {
    const wait = parseInt(res.headers.get("Retry-After") || "5", 10);
    throw new RateLimitError(wait);
  }
  if (!res.ok) return "";
  const data = await res.json();
  return formatTracklist(data.tracklist);
}

export { sleep };
