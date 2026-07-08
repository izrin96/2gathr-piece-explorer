import { z } from "zod";

// Localized title can be an object {en, ko} (list/detail) or occasionally a bare string.
const localizedTitleSchema = z.union([
  z.string(),
  z.object({ en: z.string().optional(), ko: z.string().optional() }).partial(),
]);

export function titleText(title: z.infer<typeof localizedTitleSchema> | undefined): string {
  if (!title) return "";
  if (typeof title === "string") return title;
  return title.en || title.ko || "";
}

// Each item carries a `properties` array that mirrors the IPFS `attributes`
// ({type,name} vs {trait_type,value}) — the authoritative source for Member, Hidden, Type, etc.
export const topportPropertySchema = z.object({ type: z.string(), name: z.string() }).passthrough();

export const topportBoxItemSchema = z
  .object({
    no: z.number().optional(),
    name: z.string().optional().default(""),
    originalImage: z.string().optional().default(""),
    itemImage: z.string().optional().default(""),
    imageLink: z.string().optional().default(""),
    metaLink: z.string().optional().default(""),
    // per-design class integer (1/2/3). box-level `rarityLevel` is a uniform value and is NOT
    // the class — the item's `rarity` is. Left undefined when absent so callers can fall back.
    rarity: z.number().optional(),
    properties: z.array(topportPropertySchema).optional().default([]),
  })
  .passthrough();

// Detail response (GET /api/service/mysterybox/{id}). Lenient: TopPort may add/rename
// fields; unknowns pass through and are preserved in raw metadata by callers.
export const topportBoxSchema = z
  .object({
    id: z.number(),
    title: localizedTitleSchema.optional(),
    rarityLevel: z.number().optional().default(0),
    boxContractAddress: z.string().nullish(),
    chainId: z.number().optional(),
    totalAmount: z.number().optional(),
    usedAmount: z.number().optional(),
    symbol: z.string().optional(),
    price: z.number().optional(),
    releaseDatetime: z.string().optional(),
    mysteryboxItems: z.array(topportBoxItemSchema).optional().default([]),
  })
  .passthrough();

export type TopportBox = z.infer<typeof topportBoxSchema>;
