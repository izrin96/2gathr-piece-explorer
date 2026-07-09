import { normalizeAddress } from "@repo/lib";

import type { Design, PieceClass } from "./types";

// Raw shapes the oRPC procedures map DB rows into before joining.
export interface CollectionRow {
  id: string;
  edition: string;
  symbol: string;
  totalSupply: number;
  firstSeenBlock: number;
}

export interface MetaRow {
  contractAddress: string;
  name: string | null;
  member: string | null;
  designNumber: number | null;
  edition: string;
  classLetter: string | null;
  series: string | null;
  type: string | null;
  releaseDatetime: string | null;
  price: number | null;
  imageUrl: string | null;
  animationUrl: string | null;
  isHidden: boolean | null;
}

const PIECE_CLASSES = new Set<string>(["S", "A", "B"]);

// The indexer DB and app DB cannot be SQL-joined — join in code by address.
// Collections with no `piece_design_meta` row are the earliest test contracts
// (never enriched by TopPort) and are excluded from the website entirely.
export function joinDesigns(collections: CollectionRow[], metas: MetaRow[]): Design[] {
  const metaByAddress = new Map(metas.map((m) => [normalizeAddress(m.contractAddress), m]));

  const designs: Design[] = [];
  for (const c of collections) {
    const address = normalizeAddress(c.id);
    const meta = metaByAddress.get(address);
    if (!meta) continue;

    const member = meta.member ? meta.member : null;
    const pieceClass =
      meta.classLetter && PIECE_CLASSES.has(meta.classLetter)
        ? (meta.classLetter as PieceClass)
        : null;

    designs.push({
      contractAddress: address,
      name: meta.name?.trim() ? meta.name : `${c.edition} · ${c.symbol}`,
      member,
      designNumber: meta.designNumber ?? null,
      pieceClass,
      edition: meta.edition ?? c.edition,
      series: meta.series ?? null,
      type: meta.type ?? null,
      totalSupply: c.totalSupply,
      firstSeenBlock: c.firstSeenBlock,
      releaseDatetime: meta.releaseDatetime ? new Date(meta.releaseDatetime).toISOString() : null,
      price: meta.price ?? null,
      imageUrl: meta.imageUrl ?? null,
      animationUrl: meta.animationUrl ?? null,
      isHidden: meta.isHidden ?? false,
    });
  }
  return designs;
}
