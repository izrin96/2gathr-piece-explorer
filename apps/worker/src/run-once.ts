import { enrichCollections } from "./jobs/enrich-collections.js";
import { recomputeRollups } from "./jobs/recompute-rollups.js";
import { refreshIandCredential } from "./jobs/refresh-iand-credential.js";
import { syncPieceBooks } from "./jobs/sync-piece-books.js";

const job = process.argv[2];

async function main() {
  if (job === "enrich") {
    const result = await enrichCollections();
    console.log(
      `[enrich] done: enriched=${result.enriched} unlisted=${result.unlisted} alreadyEnriched=${result.alreadyEnriched}`,
    );
  } else if (job === "rollups") {
    await recomputeRollups();
    console.log("[rollups] done");
  } else if (job === "refresh-iand-credential") {
    const result = await refreshIandCredential();
    console.log(`[refresh-iand-credential] done: refreshed=${result.refreshed}`);
  } else if (job === "sync-piece-books") {
    const result = await syncPieceBooks();
    console.log(
      `[sync-piece-books] done: checked=${result.checked} newlyCached=${JSON.stringify(result.newlyCached)}`,
    );
  } else {
    console.error(
      `unknown job: ${job ?? "(none)"} — expected "enrich", "rollups", "refresh-iand-credential", or "sync-piece-books"`,
    );
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
