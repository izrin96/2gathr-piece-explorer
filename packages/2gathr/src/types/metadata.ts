import { z } from "zod";

export const pieceAttributeSchema = z.object({
  trait_type: z.string(),
  value: z.string(),
});

export const pieceMetadataSchema = z.object({
  name: z.string(),
  description: z.string().optional().default(""),
  image: z.string().default(""),
  extension: z.string().optional().default(""),
  alt_url: z.string().optional().default(""),
  animation_url: z.string().optional().default(""),
  external_url: z.string().optional().default(""),
  rarity: z.number().default(0),
  attributes: z.array(pieceAttributeSchema).default([]),
});

export type PieceMetadata = z.infer<typeof pieceMetadataSchema>;
