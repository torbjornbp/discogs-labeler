import { describe, expect, it } from "vitest";
import {
  MAX_COPIES_PER_RECORD,
  expandCopies,
  paginateReleases,
} from "./pagination.js";

const record = (id) => ({ id, title: `Title ${id}` });

describe("expandCopies", () => {
  it("groups copies per record", () => {
    const releases = [record("A"), record("B")];
    expect(expandCopies(releases, 2).map((r) => r.id)).toEqual([
      "A",
      "A",
      "B",
      "B",
    ]);
  });

  it("defaults to one copy and clamps invalid counts to 1..100", () => {
    const releases = [record("A")];

    expect(expandCopies(releases)).toHaveLength(1);
    expect(expandCopies(releases, 0)).toHaveLength(1);
    expect(expandCopies(releases, -5)).toHaveLength(1);
    expect(expandCopies(releases, "not-a-number")).toHaveLength(1);
    expect(expandCopies(releases, 2.9)).toHaveLength(2);
    expect(expandCopies(releases, 250)).toHaveLength(MAX_COPIES_PER_RECORD);
    expect(MAX_COPIES_PER_RECORD).toBe(100);
  });

  it("returns an empty array for empty or invalid input without mutating", () => {
    const releases = [record("A"), record("B")];
    expect(expandCopies([], 3)).toEqual([]);
    expect(expandCopies(null, 3)).toEqual([]);

    const expanded = expandCopies(releases, 2);
    expect(releases.map((r) => r.id)).toEqual(["A", "B"]);
    expect(expanded).not.toBe(releases);
    expect(expanded[0]).toBe(releases[0]);
  });
});

describe("paginateReleases", () => {
  it("pads every page with null", () => {
    const pages = paginateReleases([1, 2, 3], 2, 0);
    expect(pages).toEqual([[1, 2], [3, null]]);
  });

  it("applies the start offset only to the first page", () => {
    const pages = paginateReleases([1, 2, 3, 4], 3, 1);
    expect(pages).toEqual([
      [null, 1, 2],
      [3, 4, null],
    ]);
  });

  it("spills past the last cell onto a new page", () => {
    const pages = paginateReleases([1, 2], 3, 2);
    expect(pages).toEqual([
      [null, null, 1],
      [2, null, null],
    ]);
  });

  it("returns no pages for an empty selection", () => {
    expect(paginateReleases([], 24, 0)).toEqual([]);
    expect(paginateReleases(null, 24, 0)).toEqual([]);
  });

  it("clamps invalid page sizes and start cells", () => {
    expect(paginateReleases([1, 2], 0, 0)).toEqual([[1], [2]]);
    expect(paginateReleases([1, 2], -4, 0)).toEqual([[1], [2]]);
    expect(paginateReleases([1, 2], 2.9, 9)).toEqual([[null, 1], [2, null]]);
    expect(paginateReleases([1, 2], 3, -1)).toEqual([[1, 2, null]]);
    expect(paginateReleases([1, 2], 3, "bad")).toEqual([[1, 2, null]]);
  });

  it("does not mutate the input release or pages", () => {
    const releases = [1, 2, 3];
    const pages = paginateReleases(releases, 2, 0);
    pages[0][0] = 99;
    pages[1].push(100);

    expect(releases).toEqual([1, 2, 3]);
  });
});
