import * as z from "zod";

const envSchema = z.object({
  DATABASE_URL: z.url(),
  INDEXER_DATABASE_URL: z.url(),
  TOPPORT_BASE_URL: z.url().default("https://api.topport.io"),
});

export const env = envSchema.parse(process.env);
