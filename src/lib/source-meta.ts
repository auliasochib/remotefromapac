import type { JobSource } from "./types";

/**
 * Sourcing policy (hard rule):
 *
 * Every source in this app is a first-party, published-for-programmatic-access
 * channel — the employer's own ATS job-board API (Greenhouse, Lever, Ashby).
 * We do NOT use third-party job boards or aggregators at all, do NOT scrape
 * HTML pages, and do NOT bypass logins, cookies, paywalls or bot challenges.
 *
 * Attribution requirements of the sources are honored: RemoteOK's API terms
 * require a followed link back to the original posting (every Apply link is a
 * plain <a> to the source URL), and Remotive / Arbeitnow / WWR ask to be
 * credited as the source — the UI labels each job "via <source>" and links
 * here.
 */

export const SOURCE_SITES: Record<JobSource, string> = {
  greenhouse: "https://boards.greenhouse.io",
  lever: "https://jobs.lever.co",
  ashby: "https://jobs.ashbyhq.com",
};

export function sourceSite(source: string): string | null {
  return SOURCE_SITES[source as JobSource] ?? null;
}
