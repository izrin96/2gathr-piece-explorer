import * as z from "zod";

const envSchema = z.object({
  INDEXER_RPC_ENDPOINT: z.url(),
  INDEXER_RPC_RATE_LIMIT: z.coerce.number().positive().default(5),
  INDEXER_RPC_FINALITY: z.coerce.number().positive().default(10),
  INDEXER_START_BLOCK: z.coerce.number().nonnegative().default(0),
  INDEXER_GETLOGS_RANGE: z.coerce.number().positive().default(2048),
  INDEXER_RUBY_ADDRESS: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .transform((s) => s.toLowerCase()),
  // Direct connection to the indexer Postgres (host port 5434). Never pgbouncer.
  // Consumed implicitly by @subsquid/typeorm-store + squid-typeorm-migration.
  DB_URL: z.url(),
});

export const env = envSchema.parse(process.env);
