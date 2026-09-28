/**
 * Populate the job database from every configured source.
 *
 * Usage: npm run sync
 * Reads MONGODB_URI from .env.local.
 */
import mongoose from "mongoose";
import { syncJobs } from "../src/lib/sync";

async function main() {
  console.log("Syncing jobs from all sources…\n");

  const result = await syncJobs();

  console.log("By source:");
  for (const entry of result.bySource) {
    const status = entry.error ? `FAILED — ${entry.error}` : `kept ${entry.kept}/${entry.fetched}`;
    console.log(`  ${entry.source.padEnd(16)} ${status}`);
  }

  console.log("\nSummary:");
  console.log(`  fetched            ${result.fetched}`);
  console.log(`  skipped (non-APAC) ${result.skippedNonApac}`);
  console.log(`  skipped (non-remote) ${result.skippedNotRemote}`);
  console.log(`  duplicates         ${result.duplicates}`);
  console.log(`  stored (upsert)    ${result.upserted}`);
  console.log(`  removed (gone)     ${result.stale}`);
  console.log(`  pruned (safety)    ${result.pruned}`);
  console.log(`  kept this run      ${result.kept}`);
  console.log(`  duration           ${(result.durationMs / 1000).toFixed(1)}s`);
}

main()
  .catch((error) => {
    console.error("Sync failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
