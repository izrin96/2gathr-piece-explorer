import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle } from "drizzle-orm/node-postgres";

import { relations } from "./relation.js";

export const indexer: NodePgDatabase<typeof relations> = drizzle(
  process.env.INDEXER_DATABASE_URL!,
  { relations },
);

export * as indexerSchema from "./schema.js";
