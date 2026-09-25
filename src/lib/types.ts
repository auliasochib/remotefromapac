export type JobType =
  | "full-time"
  | "part-time"
  | "contract"
  | "internship"
  | "freelance"
  | "other";

export type JobLevel = "junior" | "mid" | "senior" | "lead";

export type JobRegion =
  | "Worldwide"
  | "Asia"
  | "Europe"
  | "Americas"
  | "Oceania"
  | "Africa"
  | "Other";

/** Where a job comes from. The job `id` is prefixed with this value. */
export type JobSource =
  | "remotive"
  | "arbeitnow"
  | "jobicy"
  | "weworkremotely"
  | "remoteok"
  | "greenhouse"
  | "lever"
  | "ashby";

/**
 * How reachable a job is from the APAC region.
 *
 * - `apac`       — located in / open to an APAC country
 * - `worldwide`  — open anywhere, so APAC candidates can apply
 * - `restricted` — limited to a region that excludes APAC
 */
export type ApacEligibility = "apac" | "worldwide" | "restricted";

/** Company career pages, grouped for the source filter. */
export const COMPANY_BOARD_SOURCES: JobSource[] = [
  "greenhouse",
  "lever",
  "ashby",
];

/** Pseudo source key that selects every company career board at once. */
export const CAREERS_SOURCE = "careers";

export interface Job {
  /** Stable id: `<source>-<externalId>` */
  id: string;
  source: JobSource;
  title: string;
  company: string;
  companyLogo: string | null;
  /** Apply URL on the original source */
  url: string;
  location: string;
  region: JobRegion;
  apac: ApacEligibility;
  jobType: JobType;
  category: string;
  level: JobLevel;
  salary: string | null;
  descriptionHtml: string;
  publishedAt: string;
}

export type JobSort = "newest" | "oldest" | "company";

export interface JobQuery {
  search?: string;
  jobType?: string;
  level?: string;
  category?: string;
  region?: string;
  /** Restrict to one provider, e.g. "greenhouse". */
  source?: string;
  sort?: JobSort;
  /** Only jobs reachable from APAC — located there or open worldwide. */
  apacReachable?: boolean;
  /** Only jobs actually located in an APAC country. */
  apacLocated?: boolean;
  page?: number;
  pageSize?: number;
}

export interface JobListResponse {
  jobs: Job[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  /** Where the results came from — useful for debugging and monitoring. */
  origin?: "database" | "live";
}
