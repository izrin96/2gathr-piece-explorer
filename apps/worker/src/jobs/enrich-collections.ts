import { buildContractCatalog, createTopportClient, parseTopportBox } from "@repo/2gathr";
import { db } from "@repo/db";
import { indexer, indexerSchema } from "@repo/db/indexer";
import { pieceDesignMeta } from "@repo/db/schema";
import { lt } from "drizzle-orm";

import { env } from "../env.js";

// Enrich every indexer collection that has no piece_design_meta row yet from the public
// TopPort catalog. Member/hidden come from each item's `properties` array (which mirrors the
// IPFS `attributes`), so special editions whose display name isn't `MEMBER #NNN` — e.g.
// "2026 ARIN DAY", "KEKE (for KATELYN)" — still resolve their member. Contracts ABSENT from
// the catalog (pre-launch/test/unlisted deploys) are skipped — no row is written — so
// piece_design_meta stays exactly the set of app-listed designs. Skipped contracts are
// retried on the next run and auto-enrich if ever added to the catalog.
export async function enrichCollections(): Promise<{
  enriched: number;
  unlisted: number;
  alreadyEnriched: number;
}> {
  const collections = await indexer
    .select({
      contract: indexerSchema.pieceCollection.id,
      edition: indexerSchema.pieceCollection.edition,
    })
    .from(indexerSchema.pieceCollection);

  const existing = await db
    .select({ contract: pieceDesignMeta.contractAddress })
    .from(pieceDesignMeta);
  const enrichedSet = new Set(existing.map((r) => r.contract.toLowerCase()));

  const todo = collections.filter((c) => !enrichedSet.has(c.contract.toLowerCase()));
  if (todo.length === 0) {
    return { enriched: 0, unlisted: 0, alreadyEnriched: collections.length };
  }

  const client = createTopportClient(env.TOPPORT_BASE_URL);
  const catalog = await buildContractCatalog(client);

  const now = new Date().toISOString();
  let enriched = 0;
  let unlisted = 0;

  // Per-row commits: if one insert throws, a re-run resumes from the unfinished set
  // (todo = collections still lacking a row) — no duplicates, no transaction needed.
  for (const c of todo) {
    const box = catalog.get(c.contract.toLowerCase());
    if (!box) {
      // Absent from the TopPort catalog = pre-launch/test/unlisted deploy. Skip it:
      // piece_design_meta stays exactly the set of app-listed designs, so the website's
      // design list (driven off piece_design_meta) matches the 2GATHR app. It's retried
      // on the next run and auto-enriches if the contract is ever added to the catalog.
      console.warn(`[enrich] ${c.contract} not in TopPort catalog (unlisted/test) — skipping`);
      unlisted++;
      continue;
    }
    const row = topportRow(c.contract, c.edition, box, now);
    await db
      .insert(pieceDesignMeta)
      .values(row)
      .onConflictDoUpdate({ target: pieceDesignMeta.contractAddress, set: row });
    enriched++;
  }

  return { enriched, unlisted, alreadyEnriched: collections.length - todo.length };
}

function topportRow(
  contract: string,
  fallbackEdition: string,
  box: Parameters<typeof parseTopportBox>[0],
  now: string,
) {
  const d = parseTopportBox(box, fallbackEdition);
  return {
    contractAddress: contract.toLowerCase(),
    name: d.name,
    member: d.member,
    designNumber: d.designNumber,
    edition: d.edition,
    rarity: d.rarity,
    classLetter: d.classLetter,
    imageUrl: d.imageUrl || null,
    thumbnailUrl: d.thumbnailUrl,
    animationUrl: d.animationUrl,
    mediaType: d.mediaType || null,
    isHidden: d.isHidden,
    artist: d.artist,
    series: d.series,
    type: d.type,
    serial: d.serial,
    topportId: d.topportId,
    releaseDatetime: d.releaseDatetime,
    price: d.price,
    rawMetadata: box,
    fetchedAt: now,
  };
}

// Re-enrich designs whose piece_design_meta.fetchedAt is older than maxAgeMs.
export async function refreshStaleCollections(maxAgeMs: number): Promise<{ refreshed: number }> {
  const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
  const stale = await db
    .select({ contract: pieceDesignMeta.contractAddress })
    .from(pieceDesignMeta)
    .where(lt(pieceDesignMeta.fetchedAt, cutoff));
  if (stale.length === 0) return { refreshed: 0 };

  const editionByContract = new Map(
    (
      await indexer
        .select({
          contract: indexerSchema.pieceCollection.id,
          edition: indexerSchema.pieceCollection.edition,
        })
        .from(indexerSchema.pieceCollection)
    ).map((c) => [c.contract.toLowerCase(), c.edition]),
  );

  const client = createTopportClient(env.TOPPORT_BASE_URL);
  const catalog = await buildContractCatalog(client);
  const now = new Date().toISOString();
  let refreshed = 0;

  for (const s of stale) {
    const contract = s.contract.toLowerCase();
    const box = catalog.get(contract);
    if (!box) continue; // keep the existing row if the catalog can't improve it
    const row = topportRow(contract, editionByContract.get(contract) ?? "", box, now);
    await db
      .insert(pieceDesignMeta)
      .values(row)
      .onConflictDoUpdate({ target: pieceDesignMeta.contractAddress, set: row });
    refreshed++;
  }
  return { refreshed };
}
