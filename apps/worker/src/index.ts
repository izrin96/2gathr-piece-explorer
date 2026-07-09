import { Cron } from "croner";

import { enrichCollections, refreshStaleCollections } from "./jobs/enrich-collections.js";
import { recomputeRollups } from "./jobs/recompute-rollups.js";
import { refreshIandCredential } from "./jobs/refresh-iand-credential.js";
import { syncPieceBooks } from "./jobs/sync-piece-books.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const crons: Cron[] = [];

async function safe(name: string, fn: () => Promise<unknown>) {
  try {
    const result = await fn();
    console.log(`[${name}] ok`, result ?? "");
  } catch (err) {
    console.error(`[${name}] failed:`, err);
  }
}

// startup pass
await safe("enrich", enrichCollections);
await safe("rollups", recomputeRollups);
await safe("refresh-iand", refreshIandCredential);
await safe("sync-piece-books", syncPieceBooks);

// pick up newly auto-registered collections every 5 minutes
crons.push(new Cron("*/5 * * * *", () => safe("enrich", enrichCollections)));
// recompute rollups every 10 minutes
crons.push(new Cron("*/10 * * * *", () => safe("rollups", recomputeRollups)));
// re-enrich designs older than a day, hourly (picks up updated catalog data)
crons.push(new Cron("0 * * * *", () => safe("refresh", () => refreshStaleCollections(ONE_DAY_MS))));
// keep the 2GATHR app session alive — hourly, huge margin under the 6-day refresh-token TTL
crons.push(new Cron("0 * * * *", () => safe("refresh-iand", refreshIandCredential)));
// fetch + cache any new Piece Book — daily, content changes rarely and it's someone else's API
crons.push(new Cron("0 6 * * *", () => safe("sync-piece-books", syncPieceBooks)));

console.log(`[worker] started with ${crons.length} scheduled jobs`);

function shutdown(signal: string) {
  console.log(`[worker] ${signal} received, stopping ${crons.length} jobs`);
  for (const cron of crons) cron.stop();
  process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
