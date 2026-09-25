import { connectDB } from "./db";
import { JobModel } from "@/models/job";
import {
  fetchArbeitnow,
  fetchJobicy,
  fetchRemotive,
} from "./providers";
import {
  fetchCompanyBoards,
  fetchRemoteOk,
  fetchWeWorkRemotely,
} from "./sources";
import type { Job, JobSource } from "./types";

/** Safety net: drop anything not seen for this long, whatever its source. */
const PRUNE_AFTER_DAYS = 14;

/**
 * Each loader owns a set of `source` values. After a loader succeeds, any of
 * its jobs that the run did not re-confirm are removed — so the database
 * mirrors what the source currently offers, and postings that stop being
 * APAC-relevant disappear instead of lingering. A loader that fails leaves its
 * jobs untouched.
 */
const SOURCE_LOADERS: {
  name: string;
  owns: JobSource[];
  load: () => Promise<Job[]>;
}[] = [
  { name: "remotive", owns: ["remotive"], load: () => fetchRemotive() },
  { name: "arbeitnow", owns: ["arbeitnow"], load: () => fetchArbeitnow() },
  { name: "jobicy", owns: ["jobicy"], load: () => fetchJobicy() },
  {
    name: "weworkremotely",
    owns: ["weworkremotely"],
    load: () => fetchWeWorkRemotely(),
  },
  { name: "remoteok", owns: ["remoteok"], load: () => fetchRemoteOk() },
  {
    name: "company-boards",
    owns: ["greenhouse", "lever", "ashby"],
    load: () => fetchCompanyBoards(),
  },
];

export interface SyncResult {
  fetched: number;
  kept: number;
  skippedNonApac: number;
  duplicates: number;
  upserted: number;
  pruned: number;
  stale: number;
  bySource: { source: string; fetched: number; kept: number; error?: string }[];
  durationMs: number;
}

/** Same posting often appears on several boards — prefer the first source seen. */
function dedupeKey(job: Job): string {
  return `${job.company.trim().toLowerCase()}|${job.title.trim().toLowerCase()}`;
}

export async function syncJobs(): Promise<SyncResult> {
  const startedAt = Date.now();
  /** Marks everything this run confirms — anything older is no longer offered. */
  const syncStart = new Date();

  const results = await Promise.allSettled(
    SOURCE_LOADERS.map(async (source) => ({
      name: source.name,
      jobs: await source.load(),
    }))
  );

  const bySource: SyncResult["bySource"] = [];
  const all: Job[] = [];
  const succeededSources: JobSource[] = [];

  results.forEach((result, index) => {
    const loader = SOURCE_LOADERS[index];
    if (result.status === "fulfilled") {
      bySource.push({
        source: loader.name,
        fetched: result.value.jobs.length,
        kept: 0,
      });
      all.push(...result.value.jobs);
      succeededSources.push(...loader.owns);
    } else {
      bySource.push({
        source: loader.name,
        fetched: 0,
        kept: 0,
        error: String(result.reason),
      });
      console.warn(`Sync: source "${loader.name}" failed —`, result.reason);
    }
  });

  const fetched = all.length;
  let skippedNonApac = 0;
  let duplicates = 0;
  const seen = new Set<string>();
  const keep: Job[] = [];

  for (const job of all) {
    // Only APAC-reachable roles belong in this database.
    if (job.apac === "restricted") {
      skippedNonApac++;
      continue;
    }
    const key = dedupeKey(job);
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    keep.push(job);
  }

  const keptBySource = new Map<string, number>();
  for (const job of keep) {
    keptBySource.set(job.source, (keptBySource.get(job.source) ?? 0) + 1);
  }
  for (const entry of bySource) {
    const loader = SOURCE_LOADERS.find((l) => l.name === entry.source);
    entry.kept = (loader?.owns ?? []).reduce(
      (sum, source) => sum + (keptBySource.get(source) ?? 0),
      0
    );
  }

  await connectDB();
  // Make sure indexes exist (including the text index) before bulk writes.
  await JobModel.init();
  const now = new Date();

  const operations = keep.map((job) => ({
    updateOne: {
      filter: { id: job.id },
      update: {
        $set: {
          id: job.id,
          source: job.source,
          title: job.title,
          company: job.company,
          companyLogo: job.companyLogo,
          url: job.url,
          location: job.location,
          region: job.region,
          apac: job.apac,
          jobType: job.jobType,
          category: job.category,
          level: job.level,
          salary: job.salary,
          descriptionHtml: job.descriptionHtml,
          publishedAt: new Date(job.publishedAt),
          syncedAt: now,
        },
      },
      upsert: true,
    },
  }));

  let upserted = 0;
  const BATCH_SIZE = 200;
  for (let i = 0; i < operations.length; i += BATCH_SIZE) {
    const batch = operations.slice(i, i + BATCH_SIZE);
    const result = await JobModel.bulkWrite(batch, { ordered: false });
    upserted += (result.upsertedCount ?? 0) + (result.modifiedCount ?? 0);
  }

  // Remove anything from the sources that succeeded but was not re-confirmed:
  // the posting closed, or it stopped being APAC-relevant.
  let stale = 0;
  if (succeededSources.length > 0) {
    const staleResult = await JobModel.deleteMany({
      source: { $in: succeededSources },
      syncedAt: { $lt: syncStart },
    });
    stale = staleResult.deletedCount ?? 0;
  }

  // Safety net for sources that have been failing for a long time.
  const cutoff = new Date(now.getTime() - PRUNE_AFTER_DAYS * 24 * 60 * 60 * 1000);
  const prunedResult = await JobModel.deleteMany({
    syncedAt: { $lt: cutoff },
  });

  return {
    fetched,
    kept: keep.length,
    skippedNonApac,
    duplicates,
    upserted,
    pruned: prunedResult.deletedCount ?? 0,
    stale,
    bySource,
    durationMs: Date.now() - startedAt,
  };
}

/** Total jobs currently stored. */
export async function countStoredJobs(): Promise<number> {
  await connectDB();
  return JobModel.estimatedDocumentCount();
}
