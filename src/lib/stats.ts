import { connectDB, isDbConfigured } from "./db";
import { JobModel } from "@/models/job";

export interface JobStats {
  total: number;
  apacLocated: number;
  worldwide: number;
  companies: number;
  sources: { source: string; count: number }[];
  categories: { category: string; count: number }[];
  /** Most recent ingest time — powers the "Updated Xh ago" freshness pill. */
  lastSyncedAt: string | null;
  /** False when the database is unavailable and numbers are unavailable. */
  available: boolean;
}

const EMPTY_STATS: JobStats = {
  total: 0,
  apacLocated: 0,
  worldwide: 0,
  companies: 0,
  sources: [],
  categories: [],
  lastSyncedAt: null,
  available: false,
};

/** Aggregate counts used by the board header and the filter sidebar. */
export async function getJobStats(): Promise<JobStats> {
  if (!isDbConfigured()) return EMPTY_STATS;

  try {
    await connectDB();

    const [total, byApac, sources, categories, companies, lastSync] =
      await Promise.all([
        JobModel.estimatedDocumentCount(),
        JobModel.aggregate<{ _id: string; n: number }>([
          { $group: { _id: "$apac", n: { $sum: 1 } } },
        ]),
        JobModel.aggregate<{ _id: string; n: number }>([
          { $group: { _id: "$source", n: { $sum: 1 } } },
          { $sort: { n: -1 } },
        ]),
        JobModel.aggregate<{ _id: string; n: number }>([
          { $group: { _id: "$category", n: { $sum: 1 } } },
          { $sort: { n: -1 } },
        ]),
        JobModel.distinct("company"),
        JobModel.findOne().sort({ syncedAt: -1 }).select("syncedAt -_id").lean<{
          syncedAt?: Date;
        } | null>(),
      ]);

    const apacCount = (kind: string) =>
      byApac.find((entry) => entry._id === kind)?.n ?? 0;

    return {
      total,
      apacLocated: apacCount("apac"),
      worldwide: apacCount("worldwide"),
      companies: companies.length,
      sources: sources.map((entry) => ({
        source: entry._id,
        count: entry.n,
      })),
      categories: categories
        .filter((entry) => Boolean(entry._id))
        .map((entry) => ({ category: entry._id, count: entry.n })),
      lastSyncedAt: lastSync?.syncedAt
        ? new Date(lastSync.syncedAt).toISOString()
        : null,
      available: total > 0,
    };
  } catch (error) {
    console.warn("Job stats unavailable:", error);
    return EMPTY_STATS;
  }
}
