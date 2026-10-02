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
 * Sourcing policy: employer career pages only. Every fetch below hits the
 * company's own ATS job-board API (Greenhouse, Lever, Ashby) — first-party
 * data, published by the employer. No third-party job boards, no HTML
 * scraping. See lib/source-meta.ts.
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
