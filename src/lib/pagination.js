// Shared pagination helpers for preview sheets and print pages.

export const MAX_COPIES_PER_RECORD = 100;

const toInteger = (value, fallback) => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function expandCopies(releases, copiesPerRecord = 1) {
  if (!Array.isArray(releases) || releases.length === 0) return [];

  const copies = clamp(
    toInteger(copiesPerRecord, 1),
    1,
    MAX_COPIES_PER_RECORD
  );
  const expanded = [];
  for (const release of releases) {
    for (let copy = 0; copy < copies; copy++) {
      expanded.push(release);
    }
  }
  return expanded;
}

export function paginateReleases(releases, perPage, startCell = 0) {
  if (!Array.isArray(releases) || releases.length === 0) return [];

  const pageSize = Math.max(1, toInteger(perPage, 1));
  // startCell is a zero-based offset that only applies to the first page.
  const firstOffset = clamp(toInteger(startCell, 0), 0, pageSize - 1);
  const pages = [];
  let index = 0;

  do {
    const page = new Array(pageSize).fill(null);
    const start = pages.length === 0 ? firstOffset : 0;
    for (let cell = start; cell < pageSize && index < releases.length; cell++) {
      page[cell] = releases[index];
      index++;
    }
    pages.push(page);
  } while (index < releases.length);

  return pages;
}
