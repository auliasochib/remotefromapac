import type { MetadataRoute } from "next";
import { connectDB, isDbConfigured } from "@/lib/db";
import { JobModel } from "@/models/job";

const BASE = "https://remotefromapac.vercel.app";

export const dynamic = "force-dynamic";

/**
 * Static pages plus every job detail page, so listings are crawlable for
 * Google Jobs and general search.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];

  if (!isDbConfigured()) return staticRoutes;

  try {
    await connectDB();
    const jobs = await JobModel.find({})
      .sort({ publishedAt: -1 })
      .limit(5000)
      .select("id publishedAt -_id")
      .lean<{ id: string; publishedAt?: Date }[]>();

    return [
      ...staticRoutes,
      ...jobs.map((job) => ({
        url: `${BASE}/jobs/${encodeURIComponent(job.id)}`,
        lastModified: job.publishedAt ?? undefined,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ];
  } catch (error) {
    console.warn("Sitemap: database unavailable:", error);
    return staticRoutes;
  }
}
