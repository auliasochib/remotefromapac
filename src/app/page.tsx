import { Database, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { JobBrowser } from "@/components/job-browser";

const HIGHLIGHTS = [
  {
    icon: Sparkles,
    title: "One search, every board",
    text: "Results from three job boards merged and de-duplicated.",
  },
  {
    icon: RefreshCw,
    title: "Always fresh",
    text: "Feeds refresh every 15 minutes, ordered by recency.",
  },
  {
    icon: ShieldCheck,
    title: "Apply at the source",
    text: "We link straight to the original posting — no middleman.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="hero-glow relative overflow-hidden border-b border-border/60">
          <div className="bg-grid-dots pointer-events-none absolute inset-0" />
          <div className="relative mx-auto w-full max-w-4xl px-4 py-16 text-center sm:py-20">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Remote roles, curated for APAC time zones
            </span>

            <h1 className="mt-6 font-heading text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
              Find your next
              <br className="hidden sm:block" />{" "}
              <span className="text-gradient">remote job</span>
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Remote jobs from multiple job boards, in one searchable
              dashboard. Search once — see them all.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
              {HIGHLIGHTS.map((item) => (
                <div
                  key={item.title}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <item.icon className="h-4 w-4 text-primary" />
                  {item.title}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Job board */}
        <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
          <JobBrowser />
        </section>
      </main>

      <footer className="border-t border-border/60 py-10">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-4 px-4 text-center sm:px-6">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Database className="h-4 w-4 text-primary" />
              Job data from Remotive, Arbeitnow &amp; Jobicy
            </span>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {HIGHLIGHTS.map((item) => (
              <span
                key={item.title}
                className="rounded-full border border-border/70 bg-card px-3 py-1 text-xs text-muted-foreground"
                title={item.text}
              >
                {item.title}
              </span>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            Built with Next.js, Tailwind CSS and shadcn/ui
          </p>
        </div>
      </footer>
    </div>
  );
}
