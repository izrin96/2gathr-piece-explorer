import { describe, expect, it } from "vitest";

import { findNewBooks, resolveHiddenContract } from "./diff.js";

describe("findNewBooks", () => {
  it("returns nothing when live matches known exactly", () => {
    const live = [
      { id: "a", title: "MICHI Piece Book #001" },
      { id: "b", title: "ARIN Piece Book #001" },
    ];
    expect(findNewBooks(live, ["a", "b"])).toEqual([]);
  });

  it("returns the entries whose id isn't in the known set", () => {
    const live = [
      { id: "a", title: "MICHI Piece Book #001" },
      { id: "z", title: "AURORA Piece Book #001" },
    ];
    expect(findNewBooks(live, ["a"])).toEqual([{ id: "z", title: "AURORA Piece Book #001" }]);
  });

  it("treats an empty known list as everything new, without crashing", () => {
    const live = [{ id: "a", title: "MICHI Piece Book #001" }];
    expect(findNewBooks(live, [])).toEqual(live);
  });

  it("doesn't dedupe or drop live duplicates", () => {
    const live = [
      { id: "z", title: "AURORA Piece Book #001" },
      { id: "z", title: "AURORA Piece Book #001" },
    ];
    expect(findNewBooks(live, [])).toHaveLength(2);
  });
});

describe("resolveHiddenContract", () => {
  const designs = [
    { topportId: 250, contractAddress: "0xarin" },
    { topportId: 254, contractAddress: "0xnahyun" },
    { topportId: null, contractAddress: "0xuncataloged" },
  ];

  it("resolves a matching topportId to its contract address", () => {
    expect(resolveHiddenContract("254", designs)).toBe("0xnahyun");
  });

  it("returns null when no design has that topportId yet", () => {
    expect(resolveHiddenContract("999", designs)).toBeNull();
  });

  it("returns null for a non-numeric collectionId instead of throwing", () => {
    expect(resolveHiddenContract("not-a-number", designs)).toBeNull();
  });
});
