import { describe, it, expect } from "vitest";
import {
  formatDateAdded,
  formatRelease,
  parseDiscogsCSV,
  parseDiscogsDate,
  sortReleases,
} from "./discogs.js";

const HEADER =
  "Catalog#,Artist,Title,Label,Format,Released,release_id," +
  "Collection Media Condition,Collection Sleeve Condition,CollectionFolder," +
  "Date Added,Collection Notes,Rating";

const csv = (rows) => `${HEADER}\n${rows.join("\n")}\n`;

describe("parseDiscogsCSV", () => {
  it("parses quoted commas and escaped quotes", () => {
    const [row] = parseDiscogsCSV(
      csv(['CAT1,"Smith, John","A ""quoted"" title","Label, Inc.",Vinyl,1999,123,NM,VG,Jazz,2020-01-02 10:00:00,"note",5'])
    );

    expect(row).toMatchObject({
      artist: "Smith, John",
      title: 'A "quoted" title',
      label: "Label, Inc.",
      year: "1999",
      releaseId: "123",
      mediaCond: "NM",
      sleeveCond: "VG",
      folder: "Jazz",
      dateAdded: "2020-01-02 10:00:00",
      notes: "note",
      rating: 5,
    });
    expect(row.url).toBe("https://www.discogs.com/release/123");
  });

  it("keeps newlines inside quoted fields in one record", () => {
    const rows = parseDiscogsCSV(
      csv(['CAT1,Artist,Title,Label,Vinyl,1999,123,NM,VG,Jazz,2020-01-02 10:00:00,"Line one\nLine two",5'])
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].notes).toBe("Line one\nLine two");
    expect(rows[0].title).toBe("Title");
  });

  it("handles CRLF, BOM, and blank lines", () => {
    const text =
      `\uFEFF${HEADER}\r\n` +
      "CAT1,Artist,Title,Label,Vinyl,1999,123,NM,VG,Jazz,2020-01-02 10:00:00,note,5\r\n" +
      "\r\n" +
      "CAT2,Artist 2,Title 2,Label,Vinyl,2000,456,,,,,,\r\n";

    const rows = parseDiscogsCSV(text);
    expect(rows).toHaveLength(2);
    expect(rows[0].catno).toBe("CAT1");
    expect(rows[1].catno).toBe("CAT2");
    expect(rows[1].rating).toBe(0);
  });

  it("rejects empty files and non-Discogs CSV files", () => {
    expect(() => parseDiscogsCSV("")).toThrow(/empty/i);
    expect(() => parseDiscogsCSV("foo,bar\n1,2")).toThrow(/Discogs collection CSV/i);
  });

  it("parses Discogs inventory exports with listing links and prices", () => {
    const inventory =
      "listing_id,artist,title,label,catno,format,price,media_condition,sleeve_condition\n" +
      '4421366694,Pet Shop Boys,Actually,Parlophone,PCSD 104,"LP, Album",49,NEAR_MINT,NEAR_MINT';

    const [row] = parseDiscogsCSV(inventory);

    expect(row).toMatchObject({
      releaseId: "",
      listingId: "4421366694",
      artist: "Pet Shop Boys",
      title: "Actually",
      catno: "PCSD 104",
      format: "LP, Album",
      price: "49",
      mediaCond: "Near Mint (NM or M-)",
      sleeveCond: "Near Mint (NM or M-)",
    });
    expect(row.url).toBe("https://www.discogs.com/sell/item/4421366694");
  });

  it("rejects inventory rows with an empty listing_id", () => {
    const inventory = "listing_id,artist,title\n,Artist,Title";
    expect(() => parseDiscogsCSV(inventory)).toThrow(/row 2.*listing_id/i);
  });

  it("rejects rows with an empty release_id", () => {
    expect(() => parseDiscogsCSV(
      csv(["CAT1,Artist,Title,Label,Vinyl,1999,,NM,VG,Jazz,2020-01-02 10:00:00,note,5"])
    )).toThrow(/row 2.*release_id/i);
  });

  it("generates unique ids per row", () => {
    const rows = parseDiscogsCSV(
      csv([
        "CAT1,Artist,Title,Label,Vinyl,1999,123,,,,,,",
        "CAT1,Artist,Title,Label,Vinyl,1999,123,,,,,,",
      ])
    );
    expect(rows[0].id).not.toBe(rows[1].id);
  });
});

describe("formatRelease", () => {
  it("normalizes a collection item", () => {
    const release = formatRelease({
      instance_id: 99,
      id: 42,
      rating: 4,
      date_added: "2020-01-02T10:00:00-08:00",
      basic_information: {
        id: 123,
        title: "Album",
        year: 1999,
        artists: [{ name: "Artist (2)" }, { name: "Other" }],
        labels: [{ name: "Label", catno: "CAT 1" }],
        formats: [{ name: "Vinyl", descriptions: ["LP", "Album"] }],
        thumb: "https://example.com/thumb.jpg",
      },
    });

    expect(release).toMatchObject({
      id: 99,
      releaseId: 123,
      artist: "Artist, Other",
      catno: "CAT 1",
      format: "Vinyl, LP, Album",
      rating: 4,
      url: "https://www.discogs.com/release/123",
    });
  });

  it("fills sensible fallbacks", () => {
    const release = formatRelease({ id: 7, basic_information: { id: 7 } });
    expect(release.artist).toBe("Unknown Artist");
    expect(release.title).toBe("Unknown Title");
    expect(release.rating).toBe(0);
  });
});

describe("parseDiscogsDate / formatDateAdded", () => {
  it("parses the Discogs CSV date format as UTC", () => {
    expect(parseDiscogsDate("2020-01-02 10:00:00")).toBe(
      Date.parse("2020-01-02T10:00:00Z")
    );
  });

  it("parses ISO dates that already have a zone", () => {
    expect(parseDiscogsDate("2020-01-02T10:00:00-08:00")).toBe(
      Date.parse("2020-01-02T10:00:00-08:00")
    );
  });

  it("returns 0 / em dash for invalid values", () => {
    expect(parseDiscogsDate("")).toBe(0);
    expect(parseDiscogsDate("not a date")).toBe(0);
    expect(formatDateAdded("not a date")).toBe("—");
  });
});

describe("sortReleases", () => {
  const list = [
    { id: 1, artist: "Beta", year: "2000", rating: 1, dateAdded: "2020-01-02 10:00:00" },
    { id: 2, artist: "alpha", year: "1999", rating: 5, dateAdded: "2021-01-02 10:00:00" },
    { id: 3, artist: "Gamma", year: "", rating: 3, dateAdded: "" },
  ];

  it("returns the original array when there is no sort key", () => {
    expect(sortReleases(list, null, "asc")).toBe(list);
  });

  it("sorts years numerically", () => {
    expect(sortReleases(list, "year", "asc").map((r) => r.id)).toEqual([3, 2, 1]);
    expect(sortReleases(list, "year", "desc").map((r) => r.id)).toEqual([1, 2, 3]);
  });

  it("sorts ratings numerically", () => {
    expect(sortReleases(list, "rating", "desc").map((r) => r.id)).toEqual([2, 3, 1]);
  });

  it("sorts prices numerically without losing decimals", () => {
    const priced = [
      { id: 1, price: "9.5" },
      { id: 2, price: "10" },
      { id: 3, price: "2.25" },
    ];
    expect(sortReleases(priced, "price", "asc").map((r) => r.id)).toEqual([3, 1, 2]);
    expect(sortReleases(priced, "price", "desc").map((r) => r.id)).toEqual([2, 1, 3]);
  });

  it("sorts dateAdded chronologically even with the CSV date format", () => {
    expect(sortReleases(list, "dateAdded", "asc").map((r) => r.id)).toEqual([3, 1, 2]);
  });

  it("sorts strings case-insensitively", () => {
    expect(sortReleases(list, "artist", "asc").map((r) => r.id)).toEqual([2, 1, 3]);
  });
});
