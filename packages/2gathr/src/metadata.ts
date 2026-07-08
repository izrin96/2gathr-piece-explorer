import { normalizeMember, parsePieceName } from "@repo/lib";

import { type PieceMetadata, pieceMetadataSchema } from "./types/metadata.js";

export interface ParsedPieceDesign {
  member: string | null;
  designNumber: number | null;
  rarity: number;
  imageUrl: string;
  thumbnailUrl: string | null;
  animationUrl: string | null;
  mediaType: string;
  isHidden: boolean;
}

function attr(meta: PieceMetadata, trait: string): string | undefined {
  return meta.attributes.find((a) => a.trait_type === trait)?.value;
}

export function parsePieceMetadata(json: unknown): ParsedPieceDesign {
  const meta = pieceMetadataSchema.parse(json);
  const fromName = parsePieceName(meta.name);
  const memberAttr = attr(meta, "Member");
  const hiddenAttr = attr(meta, "Hidden");
  const member = memberAttr ?? fromName.member;

  return {
    member: member ? normalizeMember(member) : null,
    designNumber: fromName.designNumber,
    rarity: meta.rarity,
    imageUrl: meta.image,
    thumbnailUrl: meta.alt_url || null,
    animationUrl: meta.animation_url || null,
    mediaType: meta.extension || "",
    isHidden: hiddenAttr === "True" || fromName.hidden,
  };
}
