import { XMLParser } from "fast-xml-parser";
import { apacEligibility } from "./apac";
import {
  levelForTitle,
  normalizeCategory,
  normalizeJobType,
  regionForLocation,
} from "./providers";
import type { Job } from "./types";

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
        url: link,
        location,
        region: regionForLocation(location),
        apac: apacEligibility(location),
        jobType: normalizeJobType("", textForType(title, item.description ?? "")),
        category: normalizeCategory(
          result.value.category.replace(/-/g, " "),
          [item.category ?? ""],
          title
        ),
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
      url,
      location,
      region: regionForLocation(location),
      apac: apacEligibility(location),
      jobType: normalizeJobType(
        "",
        textForType(job.position ?? "", job.description ?? "")
      ),
      category: normalizeCategory(undefined, job.tags ?? [], job.position ?? ""),
      level: levelForTitle(job.position ?? ""),
      salary: remoteOkSalary(job),
      descriptionHtml: capHtml(job.description ?? ""),
      publishedAt: toIso(job.date ?? (job.epoch ? job.epoch * 1000 : undefined)),
    };
  });
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
];

const LEVER_BOARDS = ["toptal"];

const ASHBY_BOARDS = ["openai", "ramp", "zapier", "buffer"];

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
      url: job.absolute_url,
      location,
      region: regionForLocation(location),
      apac: apacEligibility(location),
      jobType: normalizeJobType("", textForType(job.title, job.content ?? "")),
      category: normalizeCategory(department, [], job.title),
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
      url: job.hostedUrl,
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
      url: job.jobUrl,
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
