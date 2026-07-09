import {
  createIandClient,
  FetchError,
  getPieceBookDetail,
  type IandPieceBook,
  listPieceBooks,
} from "@repo/2gathr";
import { db } from "@repo/db";
import { appCredential, pieceBook, pieceBookSlot, pieceDesignMeta } from "@repo/db/schema";
import { eq } from "drizzle-orm";

import { env } from "../env.js";
import { findNewBooks, resolveHiddenContract } from "../piece-books/diff.js";

// Never calls /v2/auth/refresh itself — trusts refresh-iand-credential.ts to keep
// app_credential.accessToken fresh. A 401 here means that job is broken or hasn't run yet.
//
// "Known" isn't a hardcoded id list — it's "already has a piece_book row". A new book gets
// fetched and cached automatically; nothing to update in code when 2gathr ships one.
export async function syncPieceBooks(): Promise<{ checked: number; newlyCached: string[] }> {
  const [credRow] = await db
    .select({ accessToken: appCredential.accessToken })
    .from(appCredential)
    .where(eq(appCredential.service, "2gathr"));

  if (!credRow) {
    console.warn("[sync-piece-books] no credential seeded — run seed-credential.ts");
    return { checked: 0, newlyCached: [] };
  }

  const client = createIandClient(env.IAND_BASE_URL);
  let liveBooks: IandPieceBook[];
  try {
    liveBooks = await listPieceBooks(client, credRow.accessToken);
  } catch (err) {
    if (err instanceof FetchError && err.response?.status === 401) {
      console.warn(
        "[sync-piece-books] accessToken rejected — check refresh-iand-credential job health",
      );
      return { checked: 0, newlyCached: [] };
    }
    throw err;
  }

  const cachedRows = await db.select({ id: pieceBook.id }).from(pieceBook);
  const cachedIds = new Set(cachedRows.map((r) => r.id));

  const hiddenRows = await db
    .select({ bookId: pieceBookSlot.bookId })
    .from(pieceBookSlot)
    .where(eq(pieceBookSlot.isHiddenReward, true));
  const idsWithHiddenSlot = new Set(hiddenRows.map((r) => r.bookId));

  const newBooks = findNewBooks(liveBooks, [...cachedIds]);
  // Cached but its hidden slot never resolved (topport catalog hadn't caught up) — retry.
  const staleBooks = liveBooks.filter((b) => cachedIds.has(b.id) && !idsWithHiddenSlot.has(b.id));
  const toFetch = [...newBooks, ...staleBooks];

  if (toFetch.length === 0) {
    return { checked: liveBooks.length, newlyCached: [] };
  }

  const designs = await db
    .select({
      topportId: pieceDesignMeta.topportId,
      contractAddress: pieceDesignMeta.contractAddress,
    })
    .from(pieceDesignMeta);

  const newlyCached: string[] = [];
  for (const b of toFetch) {
    const detail = await getPieceBookDetail(client, credRow.accessToken, b.id);
    const now = new Date().toISOString();

    const bookRow = {
      id: detail.id,
      title: detail.title,
      rewardType: detail.rewardType ?? null,
      totalSlots: detail.totalSlots,
      startAt: detail.startAt ?? null,
      updatedAt: now,
    };
    await db.insert(pieceBook).values(bookRow).onConflictDoUpdate({
      target: pieceBook.id,
      set: bookRow,
    });

    for (const s of detail.slots) {
      const slotRow = {
        id: s.slotId,
        bookId: detail.id,
        contractAddress: s.contractAddress.toLowerCase(),
        displayOrder: s.displayOrder,
        isHiddenReward: false,
      };
      await db
        .insert(pieceBookSlot)
        .values(slotRow)
        .onConflictDoUpdate({ target: pieceBookSlot.id, set: slotRow });
    }

    const hidden = detail.hiddenPieceSlots[0];
    if (hidden) {
      const contractAddress = resolveHiddenContract(hidden.collectionId, designs);
      if (contractAddress) {
        const hiddenRow = {
          id: hidden.rewardSlotId,
          bookId: detail.id,
          contractAddress: contractAddress.toLowerCase(),
          displayOrder: null,
          isHiddenReward: true,
        };
        await db
          .insert(pieceBookSlot)
          .values(hiddenRow)
          .onConflictDoUpdate({ target: pieceBookSlot.id, set: hiddenRow });
      } else {
        console.warn(
          `[sync-piece-books] ${detail.title}: hidden slot collectionId=${hidden.collectionId} not in piece_design_meta yet — retrying next run`,
        );
      }
    }

    newlyCached.push(detail.title);
  }

  return { checked: liveBooks.length, newlyCached };
}
