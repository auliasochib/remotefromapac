import { apacEligibility } from "./apac";
import type { Job, JobLevel, JobRegion, JobType } from "./types";

const REQUEST_HEADERS = {
  "User-Agent": "RemoteFromAPAC/1.0 (remote job aggregator)",
  Accept: "application/json",
};

// Provider responses are large and slow to fetch; the APIs only update a few
// times a day, so a short process-level cache keeps requests fast and polite.
const CACHE_TTL_MS = 15 * 60 * 1000;
const memoryCache = new Map<string, { data: Job[]; at: number }>();

async function cached(key: string, load: () => Promise<Job[]>): Promise<Job[]> {
  const hit = memoryCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;
  const data = await load();
  memoryCache.set(key, { data, at: Date.now() });
  return data;
}

const REGIONS: Record<Exclude<JobRegion, "Worldwide" | "Other">, string[]> = {
  Europe: [
    "germany", "netherlands", "poland", "spain", "france", "united kingdom",
    "uk", "england", "scotland", "ireland", "portugal", "italy", "greece",
    "ukraine", "romania", "sweden", "norway", "finland", "denmark",
    "switzerland", "austria", "belgium", "czech", "estonia", "latvia",
    "lithuania", "serbia", "croatia", "bulgaria", "hungary", "slovakia",
    "slovenia", "bosnia", "moldova", "belarus", "iceland", "luxembourg",
    "malta", "cyprus", "georgia", "armenia",
  ],
  Asia: [
    "india", "indonesia", "philippines", "vietnam", "thailand", "singapore",
    "malaysia", "japan", "china", "south korea", "korea", "bangladesh",
    "pakistan", "sri lanka", "nepal", "taiwan", "hong kong", "u ae",
    "uae", "dubai", "saudi", "israel", "qatar", "kuwait", "jordan",
    "kazakhstan", "uzbekistan", "turkey", "türkiye",
  ],
  Americas: [
    "united states", "usa", "u.s.", "canada", "mexico", "brazil",
    "argentina", "colombia", "chile", "peru", "uruguay", "ecuador",
    "bolivia", "venezuela", "panama", "costa rica", "guatemala",
    "dominican", "honduras", "paraguay",
  ],
  Africa: [
    "nigeria", "kenya", "egypt", "south africa", "ghana", "morocco",
    "ethiopia", "uganda", "tanzania", "rwanda", "senegal", "zimbabwe",
    "algeria", "tunisia", "cameroon", "zambia", "botswana", "namibia",
  ],
  Oceania: ["australia", "new zealand", "fiji", "papua new guinea"],
};

export function regionForLocation(raw: string): JobRegion {
  const loc = raw.toLowerCase();
  if (!loc || /worldwide|anywhere|global|remote|earth/.test(loc)) {
    return "Worldwide";
  }
  for (const [region, countries] of Object.entries(REGIONS)) {
    if (countries.some((country) => loc.includes(country))) {
      return region as JobRegion;
    }
  }
  return "Other";
}

const JUNIOR_RE = /\b(junior|jr\.?|entry[- ]level|intern|internship|trainee|graduate)\b/i;
const LEAD_RE = /\b(lead|head|director|vp\b|vice president|chief|manager)\b/i;
const SENIOR_RE = /\b(senior|sr\.?|staff|principal|expert)\b/i;

export function levelForTitle(title: string): JobLevel {
  if (JUNIOR_RE.test(title)) return "junior";
  if (LEAD_RE.test(title)) return "lead";
  if (SENIOR_RE.test(title)) return "senior";
  return "mid";
}

const CATEGORY_RULES: [RegExp, string][] = [
  [/data|machine learning|\bml\b|\bai\b|analytics|scientist|deep learning/i, "Data & AI"],
  [/softwar|develop|engineer|program|full[- ]?stack|front[- ]?end|back[- ]?end|devops|\bsre\b|\bqa\b|test|mobile|\bios\b|android|architect|security|cloud|sysadmin/i, "Engineering"],
  [/design|\bux\b|\bui\b|graphic|illustrat|brand/i, "Design"],
  [/marketing|\bseo\b|growth|content|copywrit|social media|email/i, "Marketing"],
  [/product manager|product owner|product design|\bproduct\b/i, "Product"],
  [/sales|account executive|business development|partnership|go[- ]to[- ]market|\bbd\b|\bsdr\b|\bgtm\b/i, "Sales"],
  [/support|customer|success|community|helpdesk/i, "Customer Support"],
  [/\bhr\b|recruit|talent|people ops|payroll/i, "Human Resources"],
  [/financ|account|bookkeep|audit|controllership|treasur/i, "Finance"],
  [/writ|edit|journalis|translat/i, "Writing"],
];

/**
 * Map a raw category/department label onto one of the canonical categories.
 *
 * The job title is included because ATS department names are inconsistent
 * ("Scaling", "SA - APJ - Japan"), while titles carry dependable signal.
 * Anything unrecognised collapses into "Other" rather than leaking dozens of
 * one-off department names into the filter.
 */
export function normalizeCategory(
  raw?: string,
  tags: string[] = [],
  title = ""
): string {
  const text = [title, raw ?? "", ...tags].join(" ");
  for (const [re, category] of CATEGORY_RULES) {
    if (re.test(text)) return category;
  }
  return "Other";
}

/**
 * Work out the employment type. Sources that publish an explicit value use it;
 * for the rest we look for the wording in the title and tags, since a bare
 * "full-time" default would make the type filter meaningless.
 */
export function normalizeJobType(
  raw?: string | string[],
  extraText = ""
): JobType {
  const text = (Array.isArray(raw) ? raw.join(" ") : (raw ?? "")).toLowerCase();
  const haystack = `${text} ${extraText}`.toLowerCase();

  if (/intern/.test(haystack)) return "internship";
  if (/part[-_ ]?time/.test(haystack)) return "part-time";
  if (/freelance/.test(haystack)) return "freelance";
  if (/contract|contractor|fixed[-_ ]?term|b2b/.test(haystack)) return "contract";
  if (/full[-_ ]?time/.test(haystack)) return "full-time";

  return text.trim() ? "other" : "full-time";
}

/** Cap on stored tags per job, to keep documents and the UI tidy. */
const MAX_TAGS = 12;

/**
 * Clean up raw tag lists from the various sources: drop blanks and
 * duplicates (case-insensitively), keep the original casing for display, and
 * cap the count.
 */
export function normalizeTags(
  ...candidates: (
    | string
    | null
    | undefined
    | readonly (string | null | undefined)[]
  )[]
): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const candidate of candidates) {
    const values = Array.isArray(candidate) ? candidate : [candidate];
    for (const value of values) {
      if (typeof value !== "string") continue;
      const tag = value.replace(/\s+/g, " ").trim();
      if (!tag || tag.length > 40) continue;
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      tags.push(tag);
      if (tags.length >= MAX_TAGS) return tags;
    }
  }
  return tags;
}
interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  company_logo: string | null;
  category: string | null;
  tags: string[] | null;
  job_type: string | null;
  candidate_required_location: string | null;
  salary: string | null;
  description: string;
  publication_date: string | null;
}

export async function fetchRemotive(search?: string): Promise<Job[]> {
  return cached(`remotive:${search ?? ""}`, async () => {
    const params = new URLSearchParams({ limit: "100" });
    if (search) params.set("search", search);

    const res = await fetch(`https://remotive.com/api/remote-jobs?${params}`, {
      headers: REQUEST_HEADERS,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Remotive API error: ${res.status}`);

    const data = (await res.json()) as { jobs: RemotiveJob[] };
    return (data.jobs ?? []).map((job): Job => ({
      id: `remotive-${job.id}`,
      source: "remotive",
      title: job.title,
      company: job.company_name ?? "Unknown company",
      companyLogo: job.company_logo || null,
      applyUrl: job.url,
      location: job.candidate_required_location || "Remote",
      region: regionForLocation(job.candidate_required_location ?? ""),
      apac: apacEligibility(job.candidate_required_location ?? ""),
      jobType: normalizeJobType(job.job_type ?? "", job.title),
      category: normalizeCategory(job.category ?? undefined, [], job.title),
      tags: normalizeTags(job.tags, job.category),
      level: levelForTitle(job.title),
      salary: job.salary?.trim() || null,
      descriptionHtml: job.description ?? "",
      publishedAt: job.publication_date ?? new Date().toISOString(),
    }));
  });
}

interface JobicyJob {
  id: number;
  url: string;
  jobSlug: string;
  jobTitle: string;
  companyName: string;
  companyLogo: string | null;
  jobIndustry: string[] | string | null;
  jobType: string[] | string | null;
  jobGeo: string[] | string | null;
  jobLevel: string | null;
  jobExcerpt: string | null;
  jobDescription: string;
  pubDate: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
}

export async function fetchJobicy(): Promise<Job[]> {
  return cached("jobicy", async () => {
    const res = await fetch("https://jobicy.com/api/v2/remote-jobs?count=50", {
      headers: REQUEST_HEADERS,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Jobicy API error: ${res.status}`);

    const data = (await res.json()) as { jobs: JobicyJob[] };
    return (data.jobs ?? []).map((job): Job => {
    const location = Array.isArray(job.jobGeo)
      ? job.jobGeo.join(", ")
      : (job.jobGeo ?? "");

    let salary: string | null = null;
    if (job.salaryMin || job.salaryMax) {
      const currency = job.salaryCurrency ?? "";
      const period = job.salaryPeriod ? ` / ${job.salaryPeriod}` : "";
      if (job.salaryMin && job.salaryMax) {
        salary = `${currency}${job.salaryMin} - ${currency}${job.salaryMax}${period}`;
      } else {
        salary = `${currency}${job.salaryMax ?? job.salaryMin}${period}`;
      }
    }

    return {
      id: `jobicy-${job.id}`,
      source: "jobicy",
      title: job.jobTitle,
      company: job.companyName ?? "Unknown company",
      companyLogo: job.companyLogo || null,
      applyUrl: job.url,
      location: location || "Remote",
      region: regionForLocation(location),
      apac: apacEligibility(location),
      jobType: normalizeJobType(
        Array.isArray(job.jobType) ? job.jobType.join(" ") : (job.jobType ?? ""),
        job.jobTitle
      ),
      category: normalizeCategory(
        Array.isArray(job.jobIndustry)
          ? job.jobIndustry[0]
          : (job.jobIndustry ?? undefined),
        Array.isArray(job.jobGeo) ? job.jobGeo : [],
        job.jobTitle
      ),
      tags: normalizeTags(job.jobIndustry, job.jobLevel),
      level: levelForTitle(job.jobTitle),
      salary,
      descriptionHtml: job.jobDescription ?? job.jobExcerpt ?? "",
      publishedAt: job.pubDate ?? new Date().toISOString(),
      };
    });
  });
}

interface ArbeitnowJob {
  slug: string;
  company_name: string;
  title: string;
  description: string;
  remote: boolean;
  url: string;
  tags: string[];
  job_types: string[];
  location: string | null;
  created_at: number;
}

/**
 * Arbeitnow serves 250 jobs per page ordered by recency; only a fraction are
 * flagged remote, so we pull the first two pages to get a useful set.
 */
export async function fetchArbeitnow(): Promise<Job[]> {
  return cached("arbeitnow", async () => {
    const pages = await Promise.allSettled(
      [1, 2].map((page) =>
        fetch(`https://www.arbeitnow.com/api/job-board-api?page=${page}`, {
          headers: REQUEST_HEADERS,
          cache: "no-store",
        })
      )
    );

  const jobs: Job[] = [];
  const seen = new Set<string>();

  for (const page of pages) {
    if (page.status === "rejected") continue;
    const res = page.value;
    if (!res.ok) continue;

    const data = (await res.json()) as { data: ArbeitnowJob[] };
    for (const job of data.data ?? []) {
      if (!job.remote || seen.has(job.slug)) continue;
      seen.add(job.slug);
      jobs.push({
        id: `arbeitnow-${job.slug}`,
        source: "arbeitnow",
        title: job.title,
        company: job.company_name ?? "Unknown company",
        companyLogo: null,
        applyUrl: job.url,
        location: job.location || "Remote",
        region: regionForLocation(job.location ?? ""),
        apac: apacEligibility(job.location ?? ""),
        jobType: normalizeJobType(
          job.job_types ?? [],
          `${job.title} ${(job.tags ?? []).join(" ")}`
        ),
        category: normalizeCategory(undefined, job.tags ?? [], job.title),
        tags: normalizeTags(job.tags),
        level: levelForTitle(job.title),
        salary: null,
        descriptionHtml: job.description ?? "",
        publishedAt: new Date(job.created_at * 1000).toISOString(),
      });
    }
  }

  if (jobs.length === 0 && pages.every((p) => p.status === "rejected")) {
    throw new Error("Arbeitnow API unreachable");
  }
  return jobs;
  });
}
