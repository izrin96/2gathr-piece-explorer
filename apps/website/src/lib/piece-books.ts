import { z } from "zod";

import { designFilterSchemaFields } from "./filters";
import type { Design } from "./types";

export const bookSearchSchema = z.object({ member: designFilterSchemaFields.member });
export type BookSearch = z.infer<typeof bookSearchSchema>;

// Fetched from `orpc.books.list` — the worker's sync-piece-books job caches these straight from
// the 2GATHR app API (real slot contract addresses, not a guessed design-number pattern).
export interface BookDefinition {
  id: string;
  title: string;
  totalSlots: number;
  slotContractAddresses: string[];
  hiddenContractAddress: string | null;
}

export interface BookSlot {
  design: Design;
  isCollected: boolean;
}

export interface ResolvedBook {
  definition: BookDefinition;
  slots: BookSlot[];
  hiddenSlot: BookSlot | null;
  collected: number;
  total: number;
  percent: number;
}

export function resolveAllBooks(
  definitions: BookDefinition[],
  allDesigns: Design[],
  ownedAddresses: Set<string>,
): ResolvedBook[] {
  const byAddress = new Map(allDesigns.map((d) => [d.contractAddress, d]));

  return definitions.map((definition) => {
    const slots = definition.slotContractAddresses
      .map((addr) => byAddress.get(addr))
      .filter((d): d is Design => d != null)
      .map((design) => ({ design, isCollected: ownedAddresses.has(design.contractAddress) }));

    const hiddenDesign = definition.hiddenContractAddress
      ? byAddress.get(definition.hiddenContractAddress)
      : undefined;
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

export function filterBooksByMember(
  books: ResolvedBook[],
  member: string | undefined,
): ResolvedBook[] {
  if (member == null) return books;
  return books.filter((book) => book.slots.some((s) => s.design.member === member));
}
