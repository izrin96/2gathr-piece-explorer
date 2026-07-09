import { os } from "@orpc/server";
import { db, schema } from "@repo/db";
import { normalizeAddress } from "@repo/lib";

import type { BookDefinition } from "@/lib/piece-books";

export const booksRouter = {
  // Piece Book definitions cached by the worker's sync-piece-books job (see AGENTS.md) — no
  // hardcoded slot pattern, just whatever the 2GATHR app API actually returned.
  list: os.handler(async (): Promise<BookDefinition[]> => {
    const [books, slots] = await Promise.all([
      db.select().from(schema.pieceBook),
      db.select().from(schema.pieceBookSlot),
    ]);

    const slotsByBook = new Map<string, (typeof slots)[number][]>();
    for (const s of slots) {
      const arr = slotsByBook.get(s.bookId) ?? [];
      arr.push(s);
      slotsByBook.set(s.bookId, arr);
    }

    return books.map((b) => {
      const bookSlots = slotsByBook.get(b.id) ?? [];
      const hidden = bookSlots.find((s) => s.isHiddenReward);
      return {
        id: b.id,
        title: b.title,
        totalSlots: b.totalSlots,
        slotContractAddresses: bookSlots
          .filter((s) => !s.isHiddenReward)
          .toSorted((a, c) => (a.displayOrder ?? 0) - (c.displayOrder ?? 0))
          .map((s) => normalizeAddress(s.contractAddress)),
        hiddenContractAddress: hidden ? normalizeAddress(hidden.contractAddress) : null,
      };
    });
  }),
};
