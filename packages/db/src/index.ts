import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle } from "drizzle-orm/node-postgres";

import { relations } from "./relation.js";

export const db: NodePgDatabase<typeof relations> = drizzle(process.env.DATABASE_URL!, {
  relations,
});

export * as schema from "./schema.js";
