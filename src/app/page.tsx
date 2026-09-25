import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { JobBoard } from "@/components/job-board";
import { getJobStats } from "@/lib/stats";
import { getJobs } from "@/lib/jobs";

export default async function Home() {
  // Both read the same MongoDB connection, so the board's first page ships
  // with the HTML instead of arriving after a client round trip.
  const [stats, initialJobs] = await Promise.all([
    getJobStats(),
    getJobs({
      page: 1,
      pageSize: 20,
      sort: "newest",
      apacReachable: true,
    }).catch((error) => {
      console.error("Home: initial jobs unavailable:", error);
      return undefined;
    }),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1">
        <JobBoard stats={stats} initialData={initialJobs} />
      </main>

      <footer className="border-t border-border/60 py-10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Remote roles gathered from job boards and company career pages,
              filtered to what you can take from Asia–Pacific.
            </p>
            <div className="flex items-center gap-4 text-sm">
              <Link
                href="/saved"
                className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Saved jobs
              </Link>
              <Link
                href="/signin"
                className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Sign in
              </Link>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Sources: We Work Remotely, RemoteOK, Remotive, Arbeitnow, Jobicy and
            company career pages via Greenhouse, Lever and Ashby · Built with
            Next.js, Tailwind CSS and shadcn/ui
          </p>
        </div>
      </footer>
    </div>
  );
}
