import { db } from "@repo/db";
import { indexer, indexerSchema } from "@repo/db/indexer";
import { pieceDesignMeta, rollupStat } from "@repo/db/schema";
import { ZERO_ADDRESS } from "@repo/lib";
import { count, countDistinct, eq, ne } from "drizzle-orm";

import { computeClassDistribution, computeRubyBalances } from "../rollups/compute.js";

async function putRollup(scope: string, key: string, value: unknown) {
  const row = { scope, key, value, updatedAt: new Date().toISOString() };
  await db
    .insert(rollupStat)
    .values(row)
    .onConflictDoUpdate({ target: [rollupStat.scope, rollupStat.key], set: row });
}

export async function recomputeRollups(): Promise<void> {
  // ---- Ruby balances (fold every ruby_transfer in JS) ----
  const rubyRows = await indexer
    .select({
      from: indexerSchema.rubyTransfer.from,
      to: indexerSchema.rubyTransfer.to,
      value: indexerSchema.rubyTransfer.value,
    })
    .from(indexerSchema.rubyTransfer);
  const balances = computeRubyBalances(
    rubyRows.map((r) => ({ from: r.from, to: r.to, value: BigInt(r.value) })),
  );
  // Full atomic replace: delete the whole ruby_balance scope, then insert the current
  // non-zero set. This prunes addresses that divested to zero (computeRubyBalances drops
  // them), which a plain upsert would otherwise leave stale forever.
  {
    const now = new Date().toISOString();
    const rows = [...balances].map(([address, balance]) => ({
      scope: "ruby_balance",
      key: address,
      value: { balance: balance.toString() },
      updatedAt: now,
    }));
    await db.transaction(async (tx) => {
      await tx.delete(rollupStat).where(eq(rollupStat.scope, "ruby_balance"));
      if (rows.length > 0) await tx.insert(rollupStat).values(rows);
    });
  }

  // ---- Class distribution (from enriched designs) ----
  const designs = await db.select({ rarity: pieceDesignMeta.rarity }).from(pieceDesignMeta);
  await putRollup("class_distribution", "global", computeClassDistribution(designs));

  // ---- Holder counts per collection (distinct non-zero owners) ----
  const holders = await indexer
    .select({
      contract: indexerSchema.pieceToken.contractAddress,
      holders: countDistinct(indexerSchema.pieceToken.owner),
      supply: count(),
    })
    .from(indexerSchema.pieceToken)
    .where(ne(indexerSchema.pieceToken.owner, ZERO_ADDRESS))
    .groupBy(indexerSchema.pieceToken.contractAddress);
  for (const h of holders) {
    await putRollup("collection_holders", h.contract, {
      holders: Number(h.holders),
      supply: Number(h.supply),
    });
  }

  // ---- Global summary ----
  // "collections" = app-listed designs: piece_design_meta only holds cataloged designs,
  // so the headline matches the 2GATHR app (e.g. excludes the 4 unlisted test contracts),
  // not the raw on-chain piece_collection set. tokens/transfers stay raw on-chain totals.
  const [collectionsRow] = await db.select({ collections: count() }).from(pieceDesignMeta);
  const [tokensRow] = await indexer.select({ tokens: count() }).from(indexerSchema.pieceToken);
  const [transfersRow] = await indexer
    .select({ transfers: count() })
    .from(indexerSchema.pieceTransfer);
  const [rubyTransfersRow] = await indexer
    .select({ rubyTransfers: count() })
    .from(indexerSchema.rubyTransfer);
  const collections = collectionsRow?.collections ?? 0;
  const tokens = tokensRow?.tokens ?? 0;
  const transfers = transfersRow?.transfers ?? 0;
  const rubyTransfers = rubyTransfersRow?.rubyTransfers ?? 0;
  await putRollup("global_stats", "summary", {
    collections: Number(collections),
    tokens: Number(tokens),
    transfers: Number(transfers),
    rubyTransfers: Number(rubyTransfers),
    rubyHolders: balances.size,
    computedAt: new Date().toISOString(),
  });
}
