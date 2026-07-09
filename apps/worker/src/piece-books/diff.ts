import type { IandPieceBook } from "@repo/2gathr";

export function findNewBooks(
  liveBooks: IandPieceBook[],
  knownIds: readonly string[],
): IandPieceBook[] {
  const known = new Set(knownIds);
  return liveBooks.filter((b) => !known.has(b.id));
}

// A hidden reward slot's `collectionId` is a TopPort numeric id, not a contract address —
// resolve it against our own already-ingested piece_design_meta.topport_id (populated by the
// no-auth enrich-collections job) before caching. Returns null if the catalog hasn't caught up
// yet or collectionId isn't a valid number; sync-piece-books retries on the next run.
export function resolveHiddenContract(
  collectionId: string,
  designs: { topportId: number | null; contractAddress: string }[],
): string | null {
  const id = Number.parseInt(collectionId, 10);
  if (Number.isNaN(id)) return null;
  return designs.find((d) => d.topportId === id)?.contractAddress ?? null;
}
