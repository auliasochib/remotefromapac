import type { JobSource } from "./types";

/**
 * Sourcing policy (hard rule):
 *
 * Every source in this app is a first-party, published-for-programmatic-access
 * channel — an official API, an RSS feed, or an ATS job-board endpoint exposed
 * by the employer itself. We do NOT scrape HTML pages, do NOT bypass logins,
 * cookies, paywalls or bot challenges, and do NOT re-sell or repost data taken
 * from second- or third-party aggregators (LinkedIn, Indeed, Wellfound,
 * Glassdoor, etc. are excluded for exactly this reason).
 *
 * Attribution requirements of the sources are honored: RemoteOK's API terms
 * require a followed link back to the original posting (every Apply link is a
 * plain <a> to the source URL), and Remotive / Arbeitnow / WWR ask to be
 * credited as the source — the UI labels each job "via <source>" and links
 * here.
 */

export const SOURCE_SITES: Record<JobSource, string> = {
  remotive: "https://remotive.com",
  arbeitnow: "https://www.arbeitnow.com",
  jobicy: "https://jobicy.com",
  weworkremotely: "https://weworkremotely.com",
  remoteok: "https://remoteok.com",
  adzuna: "https://www.adzuna.com",
  himalayas: "https://himalayas.app",
  greenhouse: "https://boards.greenhouse.io",
  lever: "https://jobs.lever.co",
  ashby: "https://jobs.ashbyhq.com",
};

export function sourceSite(source: string): string | null {
  return SOURCE_SITES[source as JobSource] ?? null;
}
