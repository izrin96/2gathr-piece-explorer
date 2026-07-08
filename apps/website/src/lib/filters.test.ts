import { describe, expect, it } from "vitest";

import { filterDesigns, filterOptions, pieceSearchSchema, sortDesigns } from "./filters";
import type { Design } from "./types";

function design(overrides: Partial<Design>): Design {
  return {
    contractAddress: "0x0000000000000000000000000000000000000001",
    name: "Bome #001",
    member: "Bome",
    designNumber: 1,
    pieceClass: "B",
    edition: "2025 Season 1",
    series: "AtHeart",
    type: "Image",
    totalSupply: 10,
    firstSeenBlock: 100,
    releaseDatetime: "2025-01-01T00:00:00.000Z",
    price: null,
    imageUrl: null,
    animationUrl: null,
    isHidden: false,
    ...overrides,
  };
}

const bome = design({ name: "Bome #001" });
const arin = design({
  name: "Arin #002",
  member: "Arin",
  pieceClass: "S",
  edition: "2026 Season 2",
  releaseDatetime: "2026-02-01T00:00:00.000Z",
  firstSeenBlock: 900,
});
const unenriched = design({
  name: "2025 Season 1 · AtHeart",
  member: null,
  pieceClass: null,
  releaseDatetime: null,
  firstSeenBlock: 500,
});

describe("pieceSearchSchema", () => {
  it("drops malformed enum values instead of throwing", () => {
    expect(pieceSearchSchema.parse({ class: "s", sort: "latest" })).toEqual({});
  });

  it("still round-trips valid values", () => {
    expect(pieceSearchSchema.parse({ class: "S" })).toEqual({ class: "S" });
  });
});

describe("filterDesigns", () => {
  it("returns everything when no filters set", () => {
    expect(filterDesigns([bome, arin, unenriched], {})).toHaveLength(3);
  });

  it("filters by member, class, and edition", () => {
    expect(filterDesigns([bome, arin], { member: "Arin" })).toEqual([arin]);
    expect(filterDesigns([bome, arin], { class: "S" })).toEqual([arin]);
    expect(filterDesigns([bome, arin], { edition: "2025 Season 1" })).toEqual([bome]);
  });
});

describe("sortDesigns", () => {
  it("newest first by releaseDatetime; unenriched last by firstSeenBlock desc", () => {
    const other = design({ ...unenriched, firstSeenBlock: 600 });
    const sorted = sortDesigns([unenriched, bome, other, arin], "newest");
    expect(sorted.map((d) => d.name)).toEqual([
      "Arin #002",
      "Bome #001",
      "2025 Season 1 · AtHeart",
      "2025 Season 1 · AtHeart",
    ]);
    expect(sorted[2]?.firstSeenBlock).toBe(600);
  });

  it("oldest reverses enriched order, unenriched still last", () => {
    const sorted = sortDesigns([arin, unenriched, bome], "oldest");
    expect(sorted.map((d) => d.name)).toEqual([
      "Bome #001",
      "Arin #002",
      "2025 Season 1 · AtHeart",
    ]);
  });

  it("name sorts alphabetically", () => {
    const sorted = sortDesigns([bome, arin], "name");
    expect(sorted.map((d) => d.name)).toEqual(["Arin #002", "Bome #001"]);
  });

  it("defaults to newest when sort is undefined", () => {
    const sorted = sortDesigns([bome, arin], undefined);
    expect(sorted[0]?.name).toBe("Arin #002");
  });
});

describe("filterOptions", () => {
  it("collects distinct members and editions, sorted, skipping nulls", () => {
    expect(filterOptions([bome, arin, unenriched])).toEqual({
      members: ["Arin", "Bome"],
      editions: ["2025 Season 1", "2026 Season 2"],
    });
  });
});
