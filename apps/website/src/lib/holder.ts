import { normalizeAddress, ZERO_ADDRESS } from "@repo/lib";
import { z } from "zod";

import { designFilterSchemaFields, designMatches, type DesignFilterSearch } from "./filters";
import type { Design, HolderActivityItem, OwnedDesign } from "./types";

// `.catch(undefined)` degrades a hand-edited/malformed `?type=` to "no filter"
// instead of erroring the whole page (mirrors pieceSearchSchema in filters.ts).
export const activitySearchSchema = z.object({
  type: z.enum(["piece", "ruby"]).optional().catch(undefined),
  ...designFilterSchemaFields,
});

export type ActivitySearch = z.infer<typeof activitySearchSchema>;

export function filterActivity(
  items: HolderActivityItem[],
  type: ActivitySearch["type"],
): HolderActivityItem[] {
  return type ? items.filter((item) => item.kind === type) : items;
}

// Member/class/edition describe a Piece's design — a Ruby transfer never
// matches once any of these is set. Must run before pagination (server-side),
// same reason `filterActivity` does.
export function filterActivityByDesign(
  items: HolderActivityItem[],
  designByAddress: Map<string, Design>,
  filters: DesignFilterSearch,
): HolderActivityItem[] {
  if (filters.member == null && filters.class == null && filters.edition == null) return items;

  return items.filter((item) => {
    if (item.kind !== "piece") return false;
    const design = designByAddress.get(item.contractAddress);
    return design != null && designMatches(design, filters);
  });
}

// Raw shapes the holders.summary oRPC procedure maps DB rows into before
// grouping/merging (mirrors the CollectionRow/MetaRow split in designs.ts).
export interface OwnedTokenRow {
  collectionId: string | null;
  serial: string; // numeric column, raw string
}

export interface PieceTransferRow {
  id: string;
  from: string;
  to: string;
  tokenId: string;
  collectionId: string | null;
  timestamp: Date;
  blockNumber: number;
  logIndex: number;
  hash: string;
}

export interface RubyTransferRow {
  id: string;
  from: string;
  to: string;
  value: string;
  timestamp: Date;
  blockNumber: number;
  logIndex: number;
  hash: string;
}

// Group an address's currently-owned tokens by design, skipping collections
// with no piece_design_meta row (site policy — see designs.ts). Serials
// ascending; designs sorted by name so the grid order is stable.
export function groupOwnedTokens(
  tokens: OwnedTokenRow[],
  designByAddress: Map<string, Design>,
): OwnedDesign[] {
  const byAddress = new Map<string, { design: Design; serials: number[] }>();

  for (const t of tokens) {
    if (!t.collectionId) continue;
    const address = normalizeAddress(t.collectionId);
    const design = designByAddress.get(address);
    if (!design) continue;

    let entry = byAddress.get(address);
    if (!entry) {
      entry = { design, serials: [] };
      byAddress.set(address, entry);
    }
    entry.serials.push(Number(t.serial));
  }

  return [...byAddress.values()]
    .map(({ design, serials }) => ({
      design,
      count: serials.length,
      serials: serials.toSorted((a, b) => a - b),
    }))
    .toSorted((a, b) => a.design.name.localeCompare(b.design.name));
}

// counterparty from `address`'s POV; mint (from=zero) / burn (to=zero) -> null.
function counterpartyOf(address: string, from: string, to: string): string | null {
  const other = to === address ? from : to;
  return other === ZERO_ADDRESS ? null : other;
}

// A Ruby transfer paired to a same-hash Piece transfer is the gacha cost, not
// an independent transfer (it always moves to/from a contract address, which
// otherwise shows up as a confusing standalone "Sent RUBY to 0x…" row) — fold
// it into the piece row as a price instead of listing it separately.
function findPairedRubyIndex(
  address: string,
  piece: PieceTransferRow,
  pieceDirection: "in" | "out",
  rubyTx: RubyTransferRow[],
  usedRubyIds: Set<string>,
): number {
  return rubyTx.findIndex((r) => {
    if (usedRubyIds.has(r.id) || r.hash !== piece.hash) return false;
    const rubyDirection = r.to === address ? "in" : "out";
    return rubyDirection !== pieceDirection;
  });
}

// Merge piece + ruby transfers into one recency-sorted feed, applying the same
// meta-less-collection exclusion as the grid. Direction is relative to
// `address`; a self-transfer (from === to === address) counts as "in".
// Returns the complete sorted list — pagination happens in the oRPC procedure.
// `pairRuby=false` (the explicit `?type=ruby` view) skips the fold below so a
// gacha-cost Ruby transfer shows as its own row instead of disappearing into
// the piece's `priceWei`.
export function mergeActivity(
  address: string,
  pieceTx: PieceTransferRow[],
  rubyTx: RubyTransferRow[],
  designByAddress: Map<string, Design>,
  pairRuby = true,
): HolderActivityItem[] {
  // blockNumber/logIndex break timestamp ties but aren't part of the public
  // item shape, so they're carried alongside the item only until the sort.
  const sortable: { item: HolderActivityItem; blockNumber: number; logIndex: number }[] = [];
  const usedRubyIds = new Set<string>();

  for (const t of pieceTx) {
    // Pair (and consume) a same-hash Ruby cost before the meta-less-collection
    // check below can `continue` — otherwise an excluded mint's payment is
    // left behind to render as a dangling standalone "Sent RUBY" row.
    const direction = t.to === address ? "in" : "out";
    const pairedRubyIndex = pairRuby
      ? findPairedRubyIndex(address, t, direction, rubyTx, usedRubyIds)
      : -1;
    const pairedRuby = pairedRubyIndex === -1 ? null : rubyTx[pairedRubyIndex];
    if (pairedRuby) usedRubyIds.add(pairedRuby.id);

    if (!t.collectionId) continue;
    const contractAddress = normalizeAddress(t.collectionId);
    const design = designByAddress.get(contractAddress);
    if (!design) continue;

    sortable.push({
      item: {
        id: `piece:${t.id}`,
        kind: "piece",
        direction,
        counterparty: counterpartyOf(address, t.from, t.to),
        timestamp: t.timestamp.toISOString(),
        hash: t.hash,
        contractAddress,
        designName: design.name,
        serial: Number(t.tokenId),
        priceWei: pairedRuby?.value ?? null,
      },
      blockNumber: t.blockNumber,
      logIndex: t.logIndex,
    });
  }

  for (const t of rubyTx) {
    if (usedRubyIds.has(t.id)) continue;

    sortable.push({
      item: {
        id: `ruby:${t.id}`,
        kind: "ruby",
        direction: t.to === address ? "in" : "out",
        counterparty: counterpartyOf(address, t.from, t.to),
        timestamp: t.timestamp.toISOString(),
        hash: t.hash,
        amountWei: t.value,
      },
      blockNumber: t.blockNumber,
      logIndex: t.logIndex,
    });
  }

  return sortable
    .toSorted((a, b) => {
      const byTimestamp = b.item.timestamp.localeCompare(a.item.timestamp);
      if (byTimestamp !== 0) return byTimestamp;
      const byBlock = b.blockNumber - a.blockNumber;
      if (byBlock !== 0) return byBlock;
      return b.logIndex - a.logIndex;
    })
    .map((s) => s.item);
}
