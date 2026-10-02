import type { ApacEligibility, JobRegion } from "./types";

/**
 * Classify a job location by how reachable it is from the APAC region.
 *
 * Matching uses word boundaries so short names cannot match by accident
 * ("india" must not match "Indiana", "anz" must not match "Gonzalez").
 */

/** Asia–Pacific countries, regions and major hiring cities. */
const APAC_TERMS = [
  // South-East Asia
  "indonesia", "indonesian", "jakarta", "bandung", "surabaya", "bali",
  "singapore", "singaporean", "malaysia", "kuala lumpur", "penang", "johor",
  "thailand", "bangkok", "vietnam", "vietnamese", "hanoi", "ho chi minh",
  "saigon", "da nang", "philippines", "filipino", "manila", "cebu", "davao",
  "brunei", "cambodia", "phnom penh", "laos", "vientiane", "myanmar",
  "yangon", "timor",
  // East Asia
  "japan", "japanese", "tokyo", "osaka", "kyoto", "nagoya", "fukuoka",
  "south korea", "korea", "korean", "seoul", "busan", "incheon",
  "china", "chinese", "beijing", "shanghai", "shenzhen", "guangzhou",
  "hangzhou", "chengdu", "hong kong", "taiwan", "taipei", "kaohsiung",
  "macau", "macao", "mongolia", "ulaanbaatar",
  // South Asia
  "india", "indian", "bangalore", "bengaluru", "mumbai", "bombay", "delhi",
  "new delhi", "gurgaon", "gurugram", "noida", "hyderabad", "chennai",
  "pune", "kolkata", "ahmedabad", "kochi", "jaipur", "indore",
  "pakistan", "karachi", "lahore", "islamabad", "bangladesh", "dhaka",
  "sri lanka", "colombo", "nepal", "kathmandu", "bhutan", "thimphu",
  "maldives", "male", "afghanistan", "kabul",
  // Oceania / Pacific
  "australia", "australian", "sydney", "melbourne", "brisbane", "perth",
  "adelaide", "canberra", "gold coast", "hobart", "darwin", "newcastle",
  "new zealand", "auckland", "wellington", "christchurch", "queenstown",
  "fiji", "suva", "papua new guinea", "samoa", "tonga", "vanuatu",
  "solomon islands", "new caledonia", "guam", "micronesia", "polynesia",
  // Broad region names used by job boards
  "apac", "apj", "asia", "asian", "asia pacific", "asia-pacific", "asean",
  "anz", "australasia", "south east asia", "southeast asia", "oceania",
  "indo-pacific", "indo pacific",
];

/**
 * Regions that explicitly exclude APAC. Checked first so "Remote - US only"
 * is not mistaken for an open worldwide role.
 */
const NON_APAC_TERMS = [
  "us only", "u.s. only", "usa only", "united states only", "us-based",
  "us based", "u.s.-based", "must be based in the us", "must reside in the us",
  "us remote", "remote us", "us-remote", "usa remote",
  "canada only", "canada-based", "uk only", "u.k. only", "united kingdom only",
  "emea only", "emea", "europe only", "europe-based", "eu only", "eu-based",
  "europe", "european", "north america", "south america", "central america",
  "latam only", "latam", "americas only", "north america only",
  "africa only", "middle east only",
  // Country names that are clearly outside APAC. Bare "us" is safe here:
  // the classifier only ever reads short location strings, where a standalone
  // "us" token means the United States.
  "us",
  "united states", "usa", "u.s.", "canada", "mexico", "brazil", "argentina",
  "colombia", "chile", "peru", "uruguay", "costa rica", "panama",
  "united kingdom", "england", "scotland", "wales", "ireland", "germany",
  "france", "spain", "portugal", "italy", "netherlands", "belgium",
  "switzerland", "austria", "poland", "czech", "czechia", "slovakia",
  "slovenia", "hungary", "romania", "bulgaria", "greece", "croatia",
  "serbia", "ukraine", "estonia", "latvia", "lithuania", "finland",
  "sweden", "norway", "denmark", "iceland", "luxembourg", "malta",
  "cyprus", "turkey", "türkiye", "israel", "egypt", "morocco", "nigeria",
  "kenya", "ghana", "south africa", "ethiopia", "uganda", "tanzania",
  "rwanda", "senegal", "tunisia", "algeria", "zimbabwe", "zambia",
  "saudi arabia", "uae", "united arab emirates", "dubai", "qatar",
  "kuwait", "bahrain", "oman", "jordan", "lebanon", "iraq", "iran",
  "kazakhstan", "uzbekistan", "azerbaijan", "armenia", "georgia",
  "russia", "belarus", "moldova", "san francisco", "new york", "seattle",
  "austin", "boston", "chicago", "denver", "los angeles", "toronto",
  "vancouver", "berlin", "munich", "london", "paris", "amsterdam",
  "dublin", "madrid", "barcelona", "lisbon", "warsaw", "prague", "rome",
  "milan", "stockholm", "copenhagen", "oslo", "helsinki", "zurich",
  "vienna", "brussels", "tel aviv", "cairo", "lagos", "nairobi",
  "são paulo", "sao paulo", "buenos aires", "bogotá", "bogota",
  "mexico city", "remote in canada", "remote in usa",
];

/** Wording that means "we hire from anywhere" in various languages. */
const WORLDWIDE_TERMS = [
  "anywhere", "worldwide", "world wide", "world-wide", "global", "globally",
  "fully remote", "100% remote", "remote only", "remote-only",
  "remote first", "remote-first", "fully distributed", "distributed team",
  "work from anywhere", "wfa", "work from home", "wfh", "telecommute",
  "teleworking", "home office", "homeoffice", "home-office", "virtual",
  "distance", "à distance", "distanciel", "télétravail", "teletrabajo",
  // Plain remote wording, common on remote-only boards
  "remote", "remote job", "remote position", "remote role", "remote work",
  "remote, remote", "n/a", "flexible", "unspecified",
];

function hasTerm(text: string, terms: string[]): boolean {
  for (const term of terms) {
    // Word-boundary match, escaping regex metacharacters in the term.
    const pattern = new RegExp(
      `(^|[^\\p{L}\\p{N}])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`,
      "iu"
    );
    if (pattern.test(text)) return true;
  }
  return false;
}

export function apacEligibility(location: string): ApacEligibility {
  const loc = (location ?? "").toLowerCase().trim();
  if (!loc) return "worldwide";

  if (hasTerm(loc, NON_APAC_TERMS)) return "restricted";
  if (hasTerm(loc, APAC_TERMS)) return "apac";
  if (hasTerm(loc, WORLDWIDE_TERMS)) return "worldwide";

  // Nothing recognisable — a bare city or unknown string. Do not claim it.
  return "restricted";
}

/** True when someone based in APAC can realistically take the job. */
export function isApacReachable(location: string): boolean {
  return apacEligibility(location) !== "restricted";
}

/** Short label describing how the job is reachable from APAC. */
export function apacLabel(location: string): string {
  switch (apacEligibility(location)) {
    case "apac":
      return "APAC";
    case "worldwide":
      return "Worldwide";
    default:
      return "Restricted";
  }
}

const APAC_REGIONS: JobRegion[] = ["Asia", "Oceania"];

export function isApacRegion(region: JobRegion): boolean {
  return APAC_REGIONS.includes(region);
}
