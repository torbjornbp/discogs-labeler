import { DISCOGS_API } from "./templates.js";
import { RateLimitError, discogsFetch } from "./discogsClient.js";

export { RateLimitError };

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

export async function fetchReleaseTracklist(releaseId, signal, onWait) {
  return discogsFetch(
    `${DISCOGS_API}/releases/${encodeURIComponent(releaseId)}`,
    {
      signal,
      onWait,
      parseResponse: async (res) => {
        // A release without a tracklist is legitimately empty; don't retry it.
        if (res.status === 404) return [];
        if (!res.ok) throw new Error(`Discogs API error: ${res.status}`);

        const data = await res.json();
        return formatTracklist(data.tracklist);
      },
    }
  );
}
