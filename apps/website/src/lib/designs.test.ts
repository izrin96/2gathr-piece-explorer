import { describe, expect, it } from "vitest";

import { formatDesignName, joinDesigns } from "./designs";

const collection = {
  id: "0xAbCd000000000000000000000000000000000001",
  edition: "2025 Season 1",
  symbol: "AtHeart",
  totalSupply: 100,
  firstSeenBlock: 500,
};

const meta = {
  contractAddress: "0xabcd000000000000000000000000000000000001",
  member: "Bome",
  designNumber: 5,
  edition: "2025 Season 1",
  classLetter: "S",
  series: "AtHeart",
  type: "Image",
  releaseDatetime: "2025-03-14T00:00:00.000Z",
  price: 20,
  imageUrl: "https://cdn.example/bome5.png",
  animationUrl: null,
  isHidden: false,
};

describe("formatDesignName", () => {
  it("pads the design number to three digits", () => {
    expect(formatDesignName("Bome", 5)).toBe("Bome #005");
    expect(formatDesignName("Seohyeon", 123)).toBe("Seohyeon #123");
  });
});

describe("joinDesigns", () => {
  it("joins collection and meta by normalized address", () => {
    const [d] = joinDesigns([collection], [meta]);
    expect(d).toMatchObject({
      contractAddress: "0xabcd000000000000000000000000000000000001",
      name: "Bome #005",
      member: "Bome",
      pieceClass: "S",
      edition: "2025 Season 1",
      totalSupply: 100,
      imageUrl: "https://cdn.example/bome5.png",
    });
  });

  it("excludes collections without meta (test contracts)", () => {
    expect(joinDesigns([collection], [])).toEqual([]);
  });

  it("treats empty-string member as null (falls back to plain name)", () => {
    const [d] = joinDesigns([collection], [{ ...meta, member: "" }]);
    expect(d?.member).toBeNull();
    expect(d?.name).toBe("2025 Season 1 · AtHeart");
  });

  it("ignores unknown class letters", () => {
    const [d] = joinDesigns([collection], [{ ...meta, classLetter: "X" }]);
    expect(d?.pieceClass).toBeNull();
  });

  it("normalizes Postgres timestamptz text to a true ISO string", () => {
    const [d] = joinDesigns([collection], [{ ...meta, releaseDatetime: "2025-12-24 15:00:00+00" }]);
    expect(d?.releaseDatetime).toBe("2025-12-24T15:00:00.000Z");
  });
});
