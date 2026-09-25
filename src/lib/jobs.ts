import type { Job, JobListResponse, JobQuery } from "./types";
import { fetchArbeitnow, fetchJobicy, fetchRemotive } from "./providers";

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

  // Same posting often appears on several boards — keep the first occurrence.
  const seen = new Set<string>();
  return jobs.filter((job) => {
    const key = `${job.company.trim().toLowerCase()}|${job.title.trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function getJobs(query: JobQuery): Promise<JobListResponse> {
  let jobs = await fetchAllSources(query.search?.trim() || undefined);

  if (query.search?.trim()) {
    const q = query.search.trim().toLowerCase();
    jobs = jobs.filter((job) => {
      const haystack = `${job.title} ${job.company} ${job.category} ${job.descriptionHtml}`
        .replace(/<[^>]*>/g, " ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }
  if (query.jobType && query.jobType !== "all") {
    jobs = jobs.filter((job) => job.jobType === query.jobType);
  }
  if (query.level && query.level !== "all") {
    jobs = jobs.filter((job) => job.level === query.level);
  }
  if (query.category && query.category !== "all") {
    jobs = jobs.filter((job) => job.category === query.category);
  }
  if (query.region && query.region !== "all") {
    jobs = jobs.filter((job) => job.region === query.region);
  }

  jobs.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));

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

export async function getJobById(
  id: string,
  search?: string
): Promise<Job | null> {
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
