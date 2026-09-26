import { XMLParser } from "fast-xml-parser";
import { apacEligibility } from "./apac";
import {
  levelForTitle,
  normalizeCategory,
  normalizeJobType,
  normalizeTags,
  regionForLocation,
} from "./providers";
import type { Job } from "./types";

/*
 * Sourcing policy: every feed below is a first-party, published-for-
 * programmatic-access channel — an official API, an RSS feed, or an ATS
 * job-board endpoint exposed by the employer. No HTML scraping and no data
 * re-fetched from second- or third-party aggregators. See lib/source-meta.ts.
 */

const REQUEST_HEADERS = {
  "User-Agent": "RemoteFromAPAC/1.0 (remote job aggregator)",
  Accept: "application/json, text/xml;q=0.9, */*;q=0.8",
};

/** Descriptions are stored for the detail page; cap them to keep documents small. */
const MAX_DESCRIPTION_CHARS = 30_000;

function capHtml(html: string): string {
  if (!html) return "";
  return html.length > MAX_DESCRIPTION_CHARS
    ? `${html.slice(0, MAX_DESCRIPTION_CHARS)}…`
    : html;
}

/**
 * Plain text used to infer the employment type when a source publishes no
 * explicit value — titles like "(Contract)" carry the signal.
 */
function textForType(title: string, html: string): string {
  const plain = (html ?? "").replace(/<[^>]*>/g, " ").slice(0, 600);
  return `${title} ${plain}`;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
  rsquo: "\u2019",
  lsquo: "\u2018",
  rdquo: "\u201d",
  ldquo: "\u201c",
  ndash: "\u2013",
  mdash: "\u2014",
  hellip: "\u2026",
  bull: "\u2022",
  middot: "\u00b7",
  copy: "\u00a9",
  reg: "\u00ae",
  trade: "\u2122",
  euro: "\u20ac",
  pound: "\u00a3",
  yen: "\u00a5",
  deg: "\u00b0",
};

/**
 * Decode HTML entities in a single pass.
 *
 * Greenhouse returns the job description HTML-escaped (`&lt;p&gt;…`), unlike
 * every other source we read, so its markup has to be decoded before it can be
 * rendered. Decoding is applied only there: on a source that already returns
 * raw HTML it would corrupt descriptions that intentionally show escaped
 * markup (e.g. an article about writing HTML).
 */
function decodeHtmlEntities(input: string): string {
  if (!input || !input.includes("&")) return input;

  return input.replace(
    /&(#[0-9]+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g,
    (match, code: string) => {
      if (code.startsWith("#")) {
        const isHex = code[1] === "x" || code[1] === "X";
        const value = parseInt(isHex ? code.slice(2) : code.slice(1), isHex ? 16 : 10);
        if (Number.isNaN(value) || value < 0 || value > 0x10ffff) return match;
        try {
          return String.fromCodePoint(value);
        } catch {
          return match;
        }
      }
      return NAMED_ENTITIES[code] ?? NAMED_ENTITIES[code.toLowerCase()] ?? match;
    }
  );
}

function toIso(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === "") {
    return new Date().toISOString();
  }
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  return Number.isNaN(date.getTime())
    ? new Date().toISOString()
    : date.toISOString();
}

/* -------------------------------------------------------------------------- */
/* We Work Remotely — public RSS feeds (one per category)                      */
/* -------------------------------------------------------------------------- */

const WWR_CATEGORIES = [
  "programming",
  "design",
  "devops-sysadmin",
  "customer-support",
  "sales-and-marketing",
  "product",
] as const;

interface WwrItem {
  title?: string;
  region?: string;
  category?: string;
  description?: string;
  pubDate?: string;
  link?: string;
}

/** WWR titles are formatted as "Company Name: Job Title". */
function splitWwrTitle(raw: string): { company: string; title: string } {
  const idx = raw.indexOf(": ");
  if (idx === -1) return { company: "Unknown company", title: raw.trim() };
  return {
    company: raw.slice(0, idx).trim(),
    title: raw.slice(idx + 2).trim(),
  };
}

function slugFromLink(link: string): string {
  const parts = link.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? link;
}

export async function fetchWeWorkRemotely(): Promise<Job[]> {
  const parser = new XMLParser({ ignoreAttributes: false, processEntities: true });

  const responses = await Promise.allSettled(
    WWR_CATEGORIES.map(async (category) => {
      const res = await fetch(
        `https://weworkremotely.com/categories/remote-${category}-jobs.rss`,
        { headers: REQUEST_HEADERS, cache: "no-store" }
      );
      if (!res.ok) throw new Error(`WWR ${category}: HTTP ${res.status}`);
      return { category, xml: await res.text() };
    })
  );

  const jobs: Job[] = [];
  const seen = new Set<string>();

  for (const result of responses) {
    if (result.status !== "fulfilled") continue;
    const { xml } = result.value;

    let items: WwrItem[];
    try {
      const doc = parser.parse(xml) as {
        rss?: { channel?: { item?: WwrItem | WwrItem[] } };
      };
      const raw = doc.rss?.channel?.item;
      items = Array.isArray(raw) ? raw : raw ? [raw] : [];
    } catch {
      continue;
    }

    for (const item of items) {
      const link = (item.link ?? "").trim();
      if (!link || seen.has(link)) continue;
      seen.add(link);

      const { company, title } = splitWwrTitle(item.title ?? "");
      if (!title) continue;

      const location = (item.region ?? "Remote").trim() || "Remote";

      jobs.push({
        id: `weworkremotely-${slugFromLink(link)}`,
        source: "weworkremotely",
        title,
        company,
        companyLogo: null,
        applyUrl: link,
        location,
        region: regionForLocation(location),
        apac: apacEligibility(location),
        jobType: normalizeJobType("", textForType(title, item.description ?? "")),
        category: normalizeCategory(
          result.value.category.replace(/-/g, " "),
          [item.category ?? ""],
          title
        ),
        tags: normalizeTags(item.category, result.value.category.replace(/-/g, " ")),
        level: levelForTitle(title),
        salary: null,
        descriptionHtml: capHtml(item.description ?? ""),
        publishedAt: toIso(item.pubDate),
      });
    }
  }

  if (jobs.length === 0 && responses.every((r) => r.status === "rejected")) {
    throw new Error("We Work Remotely feed unreachable");
  }
  return jobs;
}

/* -------------------------------------------------------------------------- */
/* RemoteOK — public JSON API                                                  */
/* -------------------------------------------------------------------------- */

interface RemoteOkJob {
  id?: string;
  slug?: string;
  company?: string;
  position?: string;
  company_logo?: string;
  logo?: string;
  description?: string;
  location?: string;
  apply_url?: string;
  url?: string;
  date?: string;
  epoch?: number;
  tags?: string[];
  salary_min?: number;
  salary_max?: number;
}

function remoteOkSalary(job: RemoteOkJob): string | null {
  const { salary_min: min, salary_max: max } = job;
  if (!min && !max) return null;
  const fmt = (n: number) => `$${Math.round(n / 1000)}k`;
  if (min && max) return `${fmt(min)} - ${fmt(max)} / year`;
  return `${fmt((max ?? min) as number)} / year`;
}

export async function fetchRemoteOk(): Promise<Job[]> {
  const res = await fetch("https://remoteok.com/api", {
    headers: REQUEST_HEADERS,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`RemoteOK API error: ${res.status}`);

  const raw = (await res.json()) as RemoteOkJob[];
  // The first element is the API's terms-of-service notice, not a job.
  const entries = raw.filter((item) => item.id && item.position);

  return entries.map((job): Job => {
    const location = (job.location ?? "").trim() || "Remote";
    const url = job.apply_url || job.url || `https://remoteok.com/remote-jobs/${job.slug}`;

    return {
      id: `remoteok-${job.id}`,
      source: "remoteok",
      title: job.position ?? "Untitled role",
      company: job.company ?? "Unknown company",
      companyLogo: job.company_logo || job.logo || null,
      applyUrl: url,
      location,
      region: regionForLocation(location),
      apac: apacEligibility(location),
      jobType: normalizeJobType(
        "",
        textForType(job.position ?? "", job.description ?? "")
      ),
      category: normalizeCategory(undefined, job.tags ?? [], job.position ?? ""),
      tags: normalizeTags(job.tags),
      level: levelForTitle(job.position ?? ""),
      salary: remoteOkSalary(job),
      descriptionHtml: capHtml(job.description ?? ""),
      publishedAt: toIso(job.date ?? (job.epoch ? job.epoch * 1000 : undefined)),
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Adzuna — official jobs API, strong APAC country coverage                    */
/* -------------------------------------------------------------------------- */

/**
 * Adzuna's API is free with a key (developer.adzuna.com) and covers many APAC
 * countries. Adzuna indexes on-site roles too, so only postings whose title or
 * description mentions remote work are kept — the APAC location check happens
 * in the sync pipeline like every other source.
 *
 * Requires: ADZUNA_APP_ID + ADZUNA_API_KEY
 */
const ADZUNA_COUNTRIES = ["sg", "in", "au", "nz", "hk", "ph", "th", "vn", "my", "id"];

interface AdzunaJob {
  id: string;
  title?: string;
  description?: string;
  redirect_url?: string;
  location?: { display_name?: string };
  company?: { display_name?: string };
  salary_min?: number;
  salary_max?: number;
  created?: string;
}

/** Adzuna returns salary in the posting's local currency — show a neutral range. */
function adzunaSalary(min?: number, max?: number): string | null {
  if (!min && !max) return null;
  const short = (n: number) =>
    n >= 1000 ? `${Math.round(n / 1000)}k` : `${Math.round(n)}`;
  if (min && max) return `${short(min)} - ${short(max)} / yr`;
  return `${short((max ?? min) as number)} / yr`;
}

export async function fetchAdzuna(): Promise<Job[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_API_KEY;
  if (!appId || !appKey) {
    throw new Error("Adzuna keys not configured (ADZUNA_APP_ID / ADZUNA_API_KEY)");
  }

  const responses = await Promise.allSettled(
    ADZUNA_COUNTRIES.map(async (country) => {
      const params = new URLSearchParams({
        app_id: appId,
        app_key: appKey,
        results_per_page: "50",
        what: "remote",
        max_days_old: "14",
      });
      const res = await fetch(
        `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`,
        { headers: REQUEST_HEADERS, cache: "no-store" }
      );
      if (!res.ok) throw new Error(`Adzuna ${country}: HTTP ${res.status}`);
      return { country, data: (await res.json()) as { results?: AdzunaJob[] } };
    })
  );

  const jobs: Job[] = [];
  const seen = new Set<string>();
  let failures = 0;

  for (const result of responses) {
    if (result.status === "rejected") {
      failures++;
      continue;
    }
    const { country, data } = result.value;
    for (const raw of data.results ?? []) {
      const url = raw.redirect_url;
      const dedupeKey = `${country}-${raw.id}`;
      if (!url || seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const title = (raw.title ?? "").replace(/<[^>]*>/g, "").trim();
      if (!title) continue;

      const description = raw.description ?? "";
      // Adzuna indexes on-site roles too — require explicit remote wording.
      if (!/remote|work from home|\bwfh\b/i.test(`${title} ${description}`)) {
        continue;
      }

      const location = raw.location?.display_name || country.toUpperCase();

      jobs.push({
        id: `adzuna-${country}-${raw.id}`,
        source: "adzuna",
        title,
        company: raw.company?.display_name ?? "Unknown company",
        companyLogo: null,
        applyUrl: url,
        location,
        region: regionForLocation(location),
        apac: apacEligibility(location),
        jobType: normalizeJobType("", textForType(title, description)),
        category: normalizeCategory(undefined, [], title),
        tags: normalizeTags(),
        level: levelForTitle(title),
        salary: adzunaSalary(raw.salary_min, raw.salary_max),
        descriptionHtml: capHtml(description),
        publishedAt: toIso(raw.created),
      });
    }
  }

  if (jobs.length === 0 && failures === ADZUNA_COUNTRIES.length) {
    throw new Error(`Adzuna unreachable for all ${failures} countries`);
  }
  if (failures > 0) {
    console.warn(`Adzuna: ${failures}/${ADZUNA_COUNTRIES.length} country queries failed`);
  }
  return jobs;
}

/* -------------------------------------------------------------------------- */
/* Company career pages — via each ATS vendor's public job-board API           */
/* -------------------------------------------------------------------------- */

/**
 * Remote-first companies that hire across APAC, with the ATS they publish on.
 * These vendors expose documented public job-board endpoints intended exactly
 * for this kind of syndication.
 */
const GREENHOUSE_BOARDS = [
  "gitlab",
  "canonical",
  "remotecom",
  "elastic",
  "vercel",
  "cloudflare",
  "proton",
  "stripe",
  "coinbase",
  "mongodb",
  "datadog",
  "twilio",
];

const LEVER_BOARDS = ["toptal"];

const ASHBY_BOARDS = ["openai", "ramp", "zapier", "buffer", "supabase"];

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  content?: string;
  updated_at?: string;
  first_published?: string;
  company_name?: string;
  location?: { name?: string };
  departments?: { name?: string }[];
  metadata?: { name?: string; value?: string | null }[];
}

async function fetchGreenhouse(board: string): Promise<Job[]> {
  const res = await fetch(
    `https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`,
    { headers: REQUEST_HEADERS, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Greenhouse ${board}: HTTP ${res.status}`);

  const data = (await res.json()) as { jobs?: GreenhouseJob[] };
  return (data.jobs ?? []).map((job): Job => {
    const location = (job.location?.name ?? "").trim() || "Remote";
    const department = job.departments?.[0]?.name;

    return {
      id: `greenhouse-${job.id}`,
      source: "greenhouse",
      title: job.title,
      company: job.company_name || board,
      companyLogo: null,
      applyUrl: job.absolute_url,
      location,
      region: regionForLocation(location),
      apac: apacEligibility(location),
      jobType: normalizeJobType("", textForType(job.title, job.content ?? "")),
      category: normalizeCategory(department, [], job.title),
      tags: normalizeTags(
        (job.departments ?? []).map((entry) => entry.name),
        (job.metadata ?? []).map((entry) => entry.value)
      ),
      level: levelForTitle(job.title),
      salary: null,
      descriptionHtml: capHtml(decodeHtmlEntities(job.content ?? "")),
      publishedAt: toIso(job.first_published ?? job.updated_at),
    };
  });
}

interface LeverJob {
  id: string;
  text: string;
  hostedUrl: string;
  description?: string;
  createdAt?: number;
  workplaceType?: string;
  categories?: {
    location?: string;
    commitment?: string;
    team?: string;
    department?: string;
    allLocations?: string[];
  };
}

async function fetchLever(board: string): Promise<Job[]> {
  const res = await fetch(
    `https://api.lever.co/v0/postings/${board}?mode=json`,
    { headers: REQUEST_HEADERS, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Lever ${board}: HTTP ${res.status}`);

  const data = (await res.json()) as LeverJob[];
  return (Array.isArray(data) ? data : []).map((job): Job => {
    const location =
      (job.categories?.allLocations ?? []).filter(Boolean).join(", ") ||
      job.categories?.location ||
      job.workplaceType ||
      "Remote";

    return {
      id: `lever-${job.id}`,
      source: "lever",
      title: job.text,
      company: board,
      companyLogo: null,
      applyUrl: job.hostedUrl,
      location,
      region: regionForLocation(location),
      apac: apacEligibility(location),
      jobType: normalizeJobType(
        job.categories?.commitment,
        textForType(job.text, job.description ?? "")
      ),
      category: normalizeCategory(
        job.categories?.department ?? job.categories?.team,
        [],
        job.text
      ),
      tags: normalizeTags(
        job.categories?.team,
        job.categories?.department,
        job.categories?.commitment
      ),
      level: levelForTitle(job.text),
      salary: null,
      descriptionHtml: capHtml(job.description ?? ""),
      publishedAt: toIso(job.createdAt),
    };
  });
}

interface AshbyJob {
  id: string;
  title: string;
  location?: string;
  secondaryLocations?: { location?: string }[];
  jobUrl: string;
  publishedAt?: string;
  isRemote?: boolean;
  workplaceType?: string;
  employmentType?: string;
  department?: string;
  team?: string;
  descriptionHtml?: string;
  descriptionPlain?: string;
}

async function fetchAshby(board: string): Promise<Job[]> {
  const res = await fetch(
    `https://api.ashbyhq.com/posting-api/job-board/${board}`,
    { headers: REQUEST_HEADERS, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Ashby ${board}: HTTP ${res.status}`);

  const data = (await res.json()) as { jobs?: AshbyJob[] };
  return (data.jobs ?? []).map((job): Job => {
    const secondary = (job.secondaryLocations ?? [])
      .map((entry) => entry.location)
      .filter(Boolean) as string[];
    const location =
      [job.location, ...secondary].filter(Boolean).join(", ") ||
      (job.isRemote ? "Remote" : "Unspecified");

    return {
      id: `ashby-${job.id}`,
      source: "ashby",
      title: job.title,
      company: board,
      companyLogo: null,
      applyUrl: job.jobUrl,
      location,
      region: regionForLocation(location),
      apac: apacEligibility(location),
      jobType: normalizeJobType(
        job.employmentType,
        textForType(job.title, job.descriptionHtml ?? job.descriptionPlain ?? "")
      ),
      category: normalizeCategory(
        job.department ?? job.team,
        [],
        job.title
      ),
      tags: normalizeTags(job.department, job.team, job.employmentType),
      level: levelForTitle(job.title),
      salary: null,
      descriptionHtml: capHtml(job.descriptionHtml ?? job.descriptionPlain ?? ""),
      publishedAt: toIso(job.publishedAt),
    };
  });
}

/**
 * Fetch every configured company board. Individual boards are allowed to fail
 * without taking down the whole sync.
 */
export async function fetchCompanyBoards(): Promise<Job[]> {
  const requests = [
    ...GREENHOUSE_BOARDS.map((board) => () => fetchGreenhouse(board)),
    ...LEVER_BOARDS.map((board) => () => fetchLever(board)),
    ...ASHBY_BOARDS.map((board) => () => fetchAshby(board)),
  ];

  const results = await Promise.allSettled(requests.map((run) => run()));

  const jobs: Job[] = [];
  const failed: string[] = [];
  results.forEach((result) => {
    if (result.status === "fulfilled") jobs.push(...result.value);
    else failed.push(String(result.reason));
  });

  if (jobs.length === 0 && failed.length === requests.length) {
    throw new Error(`All company boards failed: ${failed.join("; ")}`);
  }
  if (failed.length > 0) {
    console.warn(`Company boards: ${failed.length} failed —`, failed.join("; "));
  }
  return jobs;
}
