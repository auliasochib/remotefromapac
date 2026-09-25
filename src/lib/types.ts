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

export interface Job {
  id: string;
  source: "remotive" | "arbeitnow" | "jobicy";
  title: string;
  company: string;
  companyLogo: string | null;
  /** Apply URL on the original source */
  url: string;
  location: string;
  region: JobRegion;
  jobType: JobType;
  category: string;
  level: JobLevel;
  salary: string | null;
  descriptionHtml: string;
  publishedAt: string;
}

export interface JobQuery {
  search?: string;
  jobType?: string;
  level?: string;
  category?: string;
  region?: string;
  page?: number;
  pageSize?: number;
}

export interface JobListResponse {
  jobs: Job[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
