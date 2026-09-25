import { SiteHeader } from "@/components/site-header";
import { JobBrowser } from "@/components/job-browser";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1">
        <section className="border-b bg-muted/40 py-12 text-center">
          <div className="mx-auto max-w-3xl px-4">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Find your next remote job
            </h1>
            <p className="mt-3 text-muted-foreground">
              Remote jobs aggregated from multiple job boards into one place.
              Search once — see them all.
            </p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-8">
          <JobBrowser />
        </section>
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Job data from Remotive, Arbeitnow &amp; Jobicy · Built with Next.js,
        Tailwind CSS and shadcn/ui
      </footer>
    </div>
  );
}
