import { enrichCollections } from "./jobs/enrich-collections.js";
import { recomputeRollups } from "./jobs/recompute-rollups.js";

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
  } else {
    console.error(`unknown job: ${job ?? "(none)"} — expected "enrich" or "rollups"`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
