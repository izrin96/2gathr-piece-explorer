import { schema } from "@repo/db";
import { indexerSchema } from "@repo/db/indexer";

import type { CollectionRow, MetaRow } from "@/lib/designs";

export function toMetaRow(m: typeof schema.pieceDesignMeta.$inferSelect): MetaRow {
  return {
    contractAddress: m.contractAddress,
    member: m.member,
    designNumber: m.designNumber,
    edition: m.edition,
    classLetter: m.classLetter,
    series: m.series,
    type: m.type,
    releaseDatetime: m.releaseDatetime,
    price: m.price,
    imageUrl: m.imageUrl,
    animationUrl: m.animationUrl,
    isHidden: m.isHidden,
  };
}

export function toCollectionRow(
  c: typeof indexerSchema.pieceCollection.$inferSelect,
): CollectionRow {
  return {
    id: c.id,
    edition: c.edition,
    symbol: c.symbol,
    totalSupply: c.totalSupply,
    firstSeenBlock: c.firstSeenBlock,
  };
}
