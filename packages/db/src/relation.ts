import { defineRelations } from "drizzle-orm";

import * as schema from "./schema.js";

// No cross-table relations in Phase 1; expand as tables are added.
export const relations = defineRelations(schema, () => ({}));
