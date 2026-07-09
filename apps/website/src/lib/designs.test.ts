import { describe, expect, it } from "vitest";

import { joinDesigns } from "./designs";

const collection = {
  id: "0xAbCd000000000000000000000000000000000001",
  edition: "2025 Season 1",
  symbol: "AtHeart",
  totalSupply: 100,
  firstSeenBlock: 500,
};

const meta = {
  contractAddress: "0xabcd000000000000000000000000000000000001",
  name: "2026 ARIN DAY",
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

describe("joinDesigns", () => {
  it("joins collection and meta by normalized address", () => {
    const [d] = joinDesigns([collection], [meta]);
    expect(d).toMatchObject({
      contractAddress: "0xabcd000000000000000000000000000000000001",
      name: "2026 ARIN DAY",
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

  it("falls back to edition · symbol when the TopPort name is missing", () => {
    const [d] = joinDesigns([collection], [{ ...meta, name: null }]);
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
