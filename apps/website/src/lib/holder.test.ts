import { ZERO_ADDRESS } from "@repo/lib";
import { describe, expect, it } from "vitest";

import {
  filterActivity,
  filterActivityByDesign,
  groupOwnedTokens,
  mergeActivity,
  type PieceTransferRow,
  type RubyTransferRow,
} from "./holder";
import type { Design } from "./types";

const ADDRESS = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const CONTRACT = "0xcccccccccccccccccccccccccccccccccccccccc";

function design(overrides: Partial<Design> = {}): Design {
  return {
    contractAddress: CONTRACT,
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
    price: 20,
    imageUrl: null,
    animationUrl: null,
    isHidden: false,
    ...overrides,
  };
}

function pieceTx(overrides: Partial<PieceTransferRow> = {}): PieceTransferRow {
  return {
    id: "p1",
    from: ZERO_ADDRESS,
    to: ADDRESS,
    tokenId: "1",
    collectionId: CONTRACT,
    timestamp: new Date("2025-06-01T00:00:00.000Z"),
    blockNumber: 100,
    logIndex: 1,
    hash: "0xhash1",
    ...overrides,
  };
}

function rubyTx(overrides: Partial<RubyTransferRow> = {}): RubyTransferRow {
  return {
    id: "r1",
    from: ADDRESS,
    to: "0x1111111111111111111111111111111111111111",
    value: "20000000000000000000",
    timestamp: new Date("2025-06-01T00:00:00.000Z"),
    blockNumber: 100,
    logIndex: 0,
    hash: "0xhash1",
    ...overrides,
  };
}

describe("groupOwnedTokens", () => {
  it("groups tokens by design and sorts by name", () => {
    const designByAddress = new Map([[CONTRACT, design()]]);
    const result = groupOwnedTokens(
      [
        { collectionId: CONTRACT, serial: "5" },
        { collectionId: CONTRACT, serial: "2" },
      ],
      designByAddress,
    );

    expect(result).toEqual([{ design: design(), count: 2, serials: [2, 5] }]);
  });

  it("skips tokens whose collection has no design (meta-less/excluded)", () => {
    const result = groupOwnedTokens([{ collectionId: CONTRACT, serial: "1" }], new Map());
    expect(result).toEqual([]);
  });
});

describe("mergeActivity", () => {
  it("folds a same-hash Ruby cost into the Piece row and drops the standalone Ruby row", () => {
    const designByAddress = new Map([[CONTRACT, design()]]);
    const items = mergeActivity(ADDRESS, [pieceTx()], [rubyTx()], designByAddress);

    expect(items).toEqual([
      expect.objectContaining({
        kind: "piece",
        direction: "in",
        counterparty: null, // minted (from = zero address)
        priceWei: "20000000000000000000",
      }),
    ]);
  });

  it("drops a mint's Ruby cost too when its collection has no design meta", () => {
    // Regression: previously the Piece leg was correctly dropped for a
    // meta-less collection, but the paired Ruby leg leaked through as a
    // dangling standalone "Sent RUBY" row because pairing/consumption ran
    // after the meta-less `continue`.
    const items = mergeActivity(ADDRESS, [pieceTx()], [rubyTx()], new Map());
    expect(items).toEqual([]);
  });

  it("leaves an unrelated Ruby transfer (different hash) standalone", () => {
    const designByAddress = new Map([[CONTRACT, design()]]);
    const items = mergeActivity(
      ADDRESS,
      [pieceTx()],
      [rubyTx({ id: "r2", hash: "0xunrelated" })],
      designByAddress,
    );

    expect(items).toEqual([
      expect.objectContaining({ kind: "piece", priceWei: null }),
      expect.objectContaining({ kind: "ruby", direction: "out" }),
    ]);
  });

  it("sorts newest first by timestamp, then block/logIndex as tiebreaks", () => {
    const designByAddress = new Map([[CONTRACT, design()]]);
    const older = pieceTx({
      id: "p-older",
      timestamp: new Date("2025-01-01T00:00:00.000Z"),
      blockNumber: 10,
    });
    const newer = pieceTx({
      id: "p-newer",
      timestamp: new Date("2025-06-01T00:00:00.000Z"),
      blockNumber: 200,
    });

    const items = mergeActivity(ADDRESS, [older, newer], [], designByAddress);
    expect(items.map((i) => i.id)).toEqual(["piece:p-newer", "piece:p-older"]);
  });

  it("treats a self-transfer as 'in' and a burn (to=zero) as counterparty null", () => {
    const designByAddress = new Map([[CONTRACT, design()]]);
    const selfTransfer = pieceTx({ id: "p-self", from: ADDRESS, to: ADDRESS });
    const burn = pieceTx({ id: "p-burn", from: ADDRESS, to: ZERO_ADDRESS });

    const items = mergeActivity(ADDRESS, [selfTransfer, burn], [], designByAddress);
    expect(items).toEqual([
      // self-transfer: counterparty is the address itself, not nulled (only
      // the zero address is treated as "no counterparty")
      expect.objectContaining({ id: "piece:p-self", direction: "in", counterparty: ADDRESS }),
      expect.objectContaining({ id: "piece:p-burn", direction: "out", counterparty: null }),
    ]);
  });

  it("sets a real counterparty for a plain (non-mint/burn) transfer", () => {
    const designByAddress = new Map([[CONTRACT, design()]]);
    const items = mergeActivity(
      ADDRESS,
      [pieceTx({ from: OTHER, to: ADDRESS })],
      [],
      designByAddress,
    );
    expect(items).toEqual([expect.objectContaining({ direction: "in", counterparty: OTHER })]);
  });
});

describe("filterActivity", () => {
  const designByAddress = new Map([[CONTRACT, design()]]);
  const items = mergeActivity(
    ADDRESS,
    [pieceTx()],
    [rubyTx({ id: "r2", hash: "0xunrelated" })],
    designByAddress,
  );

  it("passes everything through when no type filter is set", () => {
    expect(filterActivity(items, undefined)).toHaveLength(2);
  });

  it("filters down to a single kind", () => {
    expect(filterActivity(items, "ruby")).toEqual([expect.objectContaining({ kind: "ruby" })]);
    expect(filterActivity(items, "piece")).toEqual([expect.objectContaining({ kind: "piece" })]);
  });
});

describe("filterActivityByDesign", () => {
  const designByAddress = new Map([[CONTRACT, design()]]);
  const items = mergeActivity(
    ADDRESS,
    [pieceTx()],
    [rubyTx({ id: "r2", hash: "0xunrelated" })],
    designByAddress,
  );

  it("passes everything through when no design filter is set", () => {
    expect(filterActivityByDesign(items, designByAddress, {})).toHaveLength(2);
  });

  it("excludes Ruby items once any design filter is set (they never match)", () => {
    const result = filterActivityByDesign(items, designByAddress, { member: "Bome" });
    expect(result).toEqual([expect.objectContaining({ kind: "piece" })]);
  });

  it("matches a Piece item by member/class/edition", () => {
    expect(filterActivityByDesign(items, designByAddress, { member: "Bome" })).toHaveLength(1);
    expect(filterActivityByDesign(items, designByAddress, { class: "B" })).toHaveLength(1);
    expect(
      filterActivityByDesign(items, designByAddress, { edition: "2025 Season 1" }),
    ).toHaveLength(1);
  });

  it("excludes a Piece item that doesn't match", () => {
    expect(filterActivityByDesign(items, designByAddress, { member: "Arin" })).toEqual([]);
    expect(filterActivityByDesign(items, designByAddress, { class: "S" })).toEqual([]);
  });
});
