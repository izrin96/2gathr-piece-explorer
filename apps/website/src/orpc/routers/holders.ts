import { os } from "@orpc/server";
import { db, schema } from "@repo/db";
import { indexer, indexerSchema } from "@repo/db/indexer";
import { isAddress, normalizeAddress, ZERO_ADDRESS } from "@repo/lib";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";

import { joinDesigns } from "@/lib/designs";
import { designFilterSchemaFields } from "@/lib/filters";
import {
  filterActivity,
  filterActivityByDesign,
  groupOwnedTokens,
  mergeActivity,
} from "@/lib/holder";
import type { HolderActivityPage, HolderSummary } from "@/lib/types";

import { toCollectionRow, toMetaRow } from "./shared";

const addressInput = z.object({
  address: z.string().refine(isAddress, "not an address").transform(normalizeAddress),
});

const activityInput = addressInput.extend({
  type: z.enum(["piece", "ruby"]).optional(),
  page: z.number().int().min(1).optional(),
  member: designFilterSchemaFields.member,
  class: designFilterSchemaFields.class,
  edition: designFilterSchemaFields.edition,
});

const ACTIVITY_PAGE_SIZE = 25;

// rollup_stat.value is untyped jsonb; the worker always writes { balance: "<wei>" }
// for scope="ruby_balance" (apps/worker/src/jobs/recompute-rollups.ts).
interface RubyBalanceValue {
  balance: string;
}

export const holdersRouter = {
  // One procedure so the header + Pieces tab render in a single suspense pass.
  summary: os.input(addressInput).handler(async ({ input }): Promise<HolderSummary | null> => {
    // The zero address "owns" every burned token — not a real holder page.
    if (input.address === ZERO_ADDRESS) return null;

    const [ownedTokens, rubyRows] = await Promise.all([
      indexer
        .select({
          collectionId: indexerSchema.pieceToken.collectionId,
          serial: indexerSchema.pieceToken.serial,
        })
        .from(indexerSchema.pieceToken)
        .where(eq(indexerSchema.pieceToken.owner, input.address)),
      db
        .select({ value: schema.rollupStat.value })
        .from(schema.rollupStat)
        .where(
          and(
            eq(schema.rollupStat.scope, "ruby_balance"),
            eq(schema.rollupStat.key, input.address),
          ),
        ),
    ]);

    const contractAddresses = [
      ...new Set(ownedTokens.map((t) => t.collectionId).filter((id): id is string => id != null)),
    ];

    // Drizzle's inArray([]) is invalid SQL — skip the queries when there's nothing to join.
    const [collections, metas] =
      contractAddresses.length === 0
        ? [[], []]
        : await Promise.all([
            indexer
              .select()
              .from(indexerSchema.pieceCollection)
              .where(inArray(indexerSchema.pieceCollection.id, contractAddresses)),
            db
              .select()
              .from(schema.pieceDesignMeta)
              .where(inArray(schema.pieceDesignMeta.contractAddress, contractAddresses)),
          ]);

    const designByAddress = new Map(
      joinDesigns(collections.map(toCollectionRow), metas.map(toMetaRow)).map((d) => [
        d.contractAddress,
        d,
      ]),
    );

    const ownedDesigns = groupOwnedTokens(ownedTokens, designByAddress);
    const rubyBalanceWei = (rubyRows[0]?.value as RubyBalanceValue | undefined)?.balance ?? "0";

    return {
      address: input.address,
      rubyBalanceWei,
      totalOwned: ownedDesigns.reduce((sum, d) => sum + d.count, 0),
      ownedDesigns,
    };
  }),

  // Full history for one address is small (largest seen so far: ~120 rows
  // total) — fetch it all and page/filter in memory, same "fetch broad, slice
  // in code" approach used for the pieces list.
  activity: os.input(activityInput).handler(async ({ input }): Promise<HolderActivityPage> => {
    const empty = {
      items: [],
      page: 1,
      pageSize: ACTIVITY_PAGE_SIZE,
      totalCount: 0,
      totalPages: 0,
    };
    if (input.address === ZERO_ADDRESS) return empty;

    const [pieceTx, rubyTx] = await Promise.all([
      indexer
        .select()
        .from(indexerSchema.pieceTransfer)
        .where(
          or(
            eq(indexerSchema.pieceTransfer.from, input.address),
            eq(indexerSchema.pieceTransfer.to, input.address),
          ),
        )
        .orderBy(
          desc(indexerSchema.pieceTransfer.timestamp),
          desc(indexerSchema.pieceTransfer.blockNumber),
          desc(indexerSchema.pieceTransfer.logIndex),
        ),
      indexer
        .select()
        .from(indexerSchema.rubyTransfer)
        .where(
          or(
            eq(indexerSchema.rubyTransfer.from, input.address),
            eq(indexerSchema.rubyTransfer.to, input.address),
          ),
        )
        .orderBy(
          desc(indexerSchema.rubyTransfer.timestamp),
          desc(indexerSchema.rubyTransfer.blockNumber),
          desc(indexerSchema.rubyTransfer.logIndex),
        ),
    ]);

    const contractAddresses = [
      ...new Set(pieceTx.map((t) => t.collectionId).filter((id): id is string => id != null)),
    ];

    // Drizzle's inArray([]) is invalid SQL — skip the queries when there's nothing to join.
    const [collections, metas] =
      contractAddresses.length === 0
        ? [[], []]
        : await Promise.all([
            indexer
              .select()
              .from(indexerSchema.pieceCollection)
              .where(inArray(indexerSchema.pieceCollection.id, contractAddresses)),
            db
              .select()
              .from(schema.pieceDesignMeta)
              .where(inArray(schema.pieceDesignMeta.contractAddress, contractAddresses)),
          ]);

    const designByAddress = new Map(
      joinDesigns(collections.map(toCollectionRow), metas.map(toMetaRow)).map((d) => [
        d.contractAddress,
        d,
      ]),
    );

    const filtered = filterActivityByDesign(
      filterActivity(
        mergeActivity(input.address, pieceTx, rubyTx, designByAddress, input.type !== "ruby"),
        input.type,
      ),
      designByAddress,
      { member: input.member, class: input.class, edition: input.edition },
    );

    const page = input.page ?? 1;
    const totalCount = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / ACTIVITY_PAGE_SIZE));
    const items = filtered.slice((page - 1) * ACTIVITY_PAGE_SIZE, page * ACTIVITY_PAGE_SIZE);

    return { items, page, pageSize: ACTIVITY_PAGE_SIZE, totalCount, totalPages };
  }),
};
