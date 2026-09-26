import { connectDB, isDbConfigured } from "./db";
import { JobModel } from "@/models/job";
import { fetchArbeitnow, fetchJobicy, fetchRemotive } from "./providers";
import { isApacReachable } from "./apac";
import {
  CAREERS_SOURCE,
  COMPANY_BOARD_SOURCES,
  type Job,
  type JobListResponse,
  type JobQuery,
  type JobSort,
} from "./types";

/* -------------------------------------------------------------------------- */
/* Live aggregation (fallback when the database is empty or unavailable)       */
/* -------------------------------------------------------------------------- */

async function fetchAllSources(search?: string): Promise<Job[]> {
  const [remotive, arbeitnow, jobicy] = await Promise.allSettled([
    fetchRemotive(search),
    fetchArbeitnow(),
    fetchJobicy(),
  ]);

  const jobs: Job[] = [];
  if (remotive.status === "fulfilled") jobs.push(...remotive.value);
  if (arbeitnow.status === "fulfilled") jobs.push(...arbeitnow.value);
  if (jobicy.status === "fulfilled") jobs.push(...jobicy.value);

  if (jobs.length === 0) {
    const reasons = [remotive, arbeitnow, jobicy]
      .filter((r) => r.status === "rejected")
      .map((r) => String(r.reason))
      .join("; ");
    throw new Error(`All job providers failed. Errors: ${reasons}`);
  }

  const seen = new Set<string>();
  return jobs.filter((job) => {
    const key = `${job.company.trim().toLowerCase()}|${job.title.trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function filterInMemory(jobs: Job[], query: JobQuery): Job[] {
  let result = jobs;

  const search = query.search?.trim().toLowerCase();
  if (search) {
    result = result.filter((job) => {
      const haystack = `${job.title} ${job.company} ${job.category} ${job.tags.join(" ")} ${job.descriptionHtml}`
        .replace(/<[^>]*>/g, " ")
        .toLowerCase();
      return haystack.includes(search);
    });
  }
  if (query.jobType && query.jobType !== "all") {
    result = result.filter((job) => job.jobType === query.jobType);
  }
  if (query.level && query.level !== "all") {
    result = result.filter((job) => job.level === query.level);
  }
  if (query.category && query.category !== "all") {
    result = result.filter((job) => job.category === query.category);
  }
  if (query.region && query.region !== "all") {
    result = result.filter((job) => job.region === query.region);
  }
  if (query.apacReachable) {
    result = result.filter((job) => isApacReachable(job.location));
  }
  if (query.apacLocated) {
    result = result.filter((job) => job.apac === "apac");
  }
  if (query.source && query.source !== "all") {
    result =
      query.source === CAREERS_SOURCE
        ? result.filter((job) => COMPANY_BOARD_SOURCES.includes(job.source))
        : result.filter((job) => job.source === query.source);
  }

  return sortJobs(result, query.sort);
}

function sortJobs(jobs: Job[], sort: JobSort = "newest"): Job[] {
  const sorted = [...jobs];
  switch (sort) {
    case "oldest":
      return sorted.sort(
        (a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt)
      );
    case "company":
      return sorted.sort((a, b) => a.company.localeCompare(b.company));
    default:
      return sorted.sort(
        (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
      );
  }
}

function dbSort(sort: JobSort = "newest"): Record<string, 1 | -1> {
  switch (sort) {
    case "oldest":
      return { publishedAt: 1 };
    case "company":
      return { company: 1, publishedAt: -1 };
    default:
      return { publishedAt: -1 };
  }
}

function paginate(jobs: Job[], query: JobQuery): JobListResponse {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, query.pageSize ?? 20));
  const start = (page - 1) * pageSize;

  return {
    jobs: jobs.slice(start, start + pageSize),
    total: jobs.length,
    page,
    pageSize,
    hasMore: start + pageSize < jobs.length,
  };
}

async function getJobsLive(query: JobQuery): Promise<JobListResponse> {
  const jobs = await fetchAllSources(query.search?.trim() || undefined);
  return { ...paginate(filterInMemory(jobs, query), query), origin: "live" };
}

/* -------------------------------------------------------------------------- */
/* Database-backed reads                                                       */
/* -------------------------------------------------------------------------- */

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildDbFilter(query: JobQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  const search = query.search?.trim();
  if (search) {
    // Regex keeps the partial-word matching users expect, and the collection is
    // small enough for this to stay fast.
    const rx = new RegExp(escapeRegex(search), "i");
    filter.$or = [
      { title: rx },
      { company: rx },
      { category: rx },
      { tags: rx },
      { descriptionHtml: rx },
    ];
  }
  if (query.jobType && query.jobType !== "all") filter.jobType = query.jobType;
  if (query.level && query.level !== "all") filter.level = query.level;
  if (query.category && query.category !== "all") filter.category = query.category;
  if (query.region && query.region !== "all") filter.region = query.region;
  if (query.source && query.source !== "all") {
    filter.source =
      query.source === CAREERS_SOURCE
        ? { $in: COMPANY_BOARD_SOURCES }
        : query.source;
  }
  if (query.apacReachable) filter.apac = { $in: ["apac", "worldwide"] };
  if (query.apacLocated) filter.apac = "apac";

  return filter;
}

interface JobRecord {
  id: string;
  source: Job["source"];
  title: string;
  company: string;
  companyLogo?: string | null;
  applyUrl: string;
  location?: string;
  region?: Job["region"];
  apac?: Job["apac"];
  jobType?: Job["jobType"];
  category?: string;
  tags?: string[];
  level?: Job["level"];
  salary?: string | null;
  descriptionHtml?: string;
  publishedAt?: Date;
}

function toJob(record: JobRecord): Job {
  return {
    id: record.id,
    source: record.source,
    title: record.title,
    company: record.company,
    companyLogo: record.companyLogo ?? null,
    applyUrl: record.applyUrl,
    location: record.location ?? "Remote",
    region: record.region ?? "Other",
    apac: record.apac ?? "worldwide",
    jobType: record.jobType ?? "other",
    category: record.category ?? "Other",
    tags: Array.isArray(record.tags) ? record.tags : [],
    level: record.level ?? "mid",
    salary: record.salary ?? null,
    descriptionHtml: record.descriptionHtml ?? "",
    publishedAt: (record.publishedAt ?? new Date()).toISOString(),
  };
}

async function getJobsFromDb(query: JobQuery): Promise<JobListResponse | null> {
  if (!isDbConfigured()) return null;

  await connectDB();
  const total = await JobModel.estimatedDocumentCount();
  if (total === 0) return null;

  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, query.pageSize ?? 20));
  const filter = buildDbFilter(query);

  const [records, matched] = await Promise.all([
    JobModel.find(filter)
      .sort(dbSort(query.sort))
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<JobRecord[]>(),
    JobModel.countDocuments(filter),
  ]);

  return {
    jobs: records.map(toJob),
    total: matched,
    page,
    pageSize,
    hasMore: page * pageSize < matched,
    origin: "database",
  };
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Jobs for the board. Reads the synced database first and transparently falls
 * back to fetching the providers directly when the database is empty or down.
 */
export async function getJobs(query: JobQuery): Promise<JobListResponse> {
  try {
    const fromDb = await getJobsFromDb(query);
    if (fromDb) return fromDb;
  } catch (error) {
    console.warn("Job read from database failed, using live sources:", error);
  }
  return getJobsLive(query);
}

export async function getJobById(
  id: string,
  search?: string
): Promise<Job | null> {
  try {
    if (isDbConfigured()) {
      await connectDB();
      const record = await JobModel.findOne({ id }).lean<JobRecord | null>();
      if (record) return toJob(record);
    }
  } catch (error) {
    console.warn("Job lookup from database failed, using live sources:", error);
  }

  const attempts = await Promise.allSettled([
    fetchRemotive(search?.trim() || undefined),
    fetchArbeitnow(),
    fetchJobicy(),
  ]);

  for (const result of attempts) {
    if (result.status === "fulfilled") {
      const job = result.value.find((job) => job.id === id);
      if (job) return job;
    }
  }
  return null;
}
