import { os } from "@orpc/server";
import { db, schema } from "@repo/db";
import { indexer, indexerSchema } from "@repo/db/indexer";
import { isAddress, normalizeAddress } from "@repo/lib";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { joinDesigns } from "@/lib/designs";
import type { SerialRow } from "@/lib/types";

import { toCollectionRow, toMetaRow } from "./shared";

const contractInput = z.object({
  contract: z.string().refine(isAddress, "not an address").transform(normalizeAddress),
});

export const piecesRouter = {
  // All ~154 designs in one payload; filtering/sorting is client-side (spec §3).
  list: os.handler(async () => {
    const [collections, metas] = await Promise.all([
      indexer.select().from(indexerSchema.pieceCollection),
      db.select().from(schema.pieceDesignMeta),
    ]);
    return joinDesigns(collections.map(toCollectionRow), metas.map(toMetaRow));
  }),

  detail: os.input(contractInput).handler(async ({ input }) => {
    const [collections, metas] = await Promise.all([
      indexer
        .select()
        .from(indexerSchema.pieceCollection)
        .where(eq(indexerSchema.pieceCollection.id, input.contract)),
      db
        .select()
        .from(schema.pieceDesignMeta)
        .where(eq(schema.pieceDesignMeta.contractAddress, input.contract)),
    ]);
    const designs = joinDesigns(collections.map(toCollectionRow), metas.map(toMetaRow));
    return designs[0] ?? null;
  }),

  serials: os.input(contractInput).handler(async ({ input }): Promise<SerialRow[]> => {
    const tokens = await indexer
      .select({
        serial: indexerSchema.pieceToken.serial,
        owner: indexerSchema.pieceToken.owner,
        mintedAt: indexerSchema.pieceToken.mintedAt,
      })
      .from(indexerSchema.pieceToken)
      .where(eq(indexerSchema.pieceToken.collectionId, input.contract))
      .orderBy(asc(indexerSchema.pieceToken.serial));

    return tokens.map((t) => ({
      serial: Number(t.serial),
      owner: normalizeAddress(t.owner),
      mintedAt: t.mintedAt.toISOString(),
    }));
  }),
};
