import type { Design } from "./types";

// Verified against the 2GATHR app's `/v1/piece-book` API (live cross-check,
// 2026-07-09): every book's 9 slots are that member's designs #012-#020 in
// "2026 Season 2", plus a hidden bonus slot at #001 in "Hidden Piece". AURORA
// has neither range minted and has no book. Hardcoded rather than inferred
// generically at runtime — explicit, and won't silently misfire if a future
// book breaks the pattern (e.g. a #002 with a different range).
export interface PieceBookDefinition {
  id: string;
  title: string;
  member: string;
  edition: string;
  slotDesignNumbers: number[];
  hiddenEdition: string;
  hiddenDesignNumber: number;
}

const SLOT_DESIGN_NUMBERS = [12, 13, 14, 15, 16, 17, 18, 19, 20];

function book(member: string): PieceBookDefinition {
  return {
    id: `${member.toLowerCase()}-001`,
    title: `${member.toUpperCase()} Piece Book #001`,
    member,
    edition: "2026 Season 2",
    slotDesignNumbers: SLOT_DESIGN_NUMBERS,
    hiddenEdition: "Hidden Piece",
    hiddenDesignNumber: 1,
  };
}

export const PIECE_BOOKS: PieceBookDefinition[] = [
  book("Michi"),
  book("Arin"),
  book("Katelyn"),
  book("Bome"),
  book("Seohyeon"),
  book("Nahyun"),
];

export interface BookSlot {
  design: Design;
  isCollected: boolean;
}

export interface ResolvedBook {
  definition: PieceBookDefinition;
  slots: BookSlot[];
  hiddenSlot: BookSlot | null;
  collected: number;
  total: number;
  percent: number;
}

function designKey(member: string, edition: string, designNumber: number): string {
  return `${member}|${edition}|${designNumber}`;
}

export function resolveAllBooks(allDesigns: Design[], ownedAddresses: Set<string>): ResolvedBook[] {
  const byKey = new Map<string, Design>();
  for (const d of allDesigns) {
    if (d.member == null || d.designNumber == null) continue;
    byKey.set(designKey(d.member, d.edition, d.designNumber), d);
  }

  return PIECE_BOOKS.map((definition) => {
    const slots = definition.slotDesignNumbers
      .map((n) => byKey.get(designKey(definition.member, definition.edition, n)))
      .filter((d): d is Design => d != null)
      .map((design) => ({ design, isCollected: ownedAddresses.has(design.contractAddress) }));

    const hiddenDesign = byKey.get(
      designKey(definition.member, definition.hiddenEdition, definition.hiddenDesignNumber),
    );
    const hiddenSlot = hiddenDesign
      ? { design: hiddenDesign, isCollected: ownedAddresses.has(hiddenDesign.contractAddress) }
      : null;

    const collected = slots.filter((s) => s.isCollected).length;

    return {
      definition,
      slots,
      hiddenSlot,
      collected,
      total: slots.length,
      percent: slots.length === 0 ? 0 : Math.round((collected / slots.length) * 100),
    };
  });
}
