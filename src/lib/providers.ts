import type { JobLevel, JobRegion, JobType } from "./types";

/**
 * Normalisation helpers shared by the ingest pipeline. This module holds no
 * fetching — all data comes from first-party ATS job-board APIs (see
 * lib/sources.ts and the sourcing policy in lib/source-meta.ts).
 */

/** Countries and broad regions mapped to the board's region filter. */
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
    "pakistan", "sri lanka", "nepal", "taiwan", "hong kong", "uae",
    "dubai", "saudi", "israel", "qatar", "kuwait", "jordan",
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
