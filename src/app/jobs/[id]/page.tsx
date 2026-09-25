import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import sanitizeHtml from "sanitize-html";
import { ArrowLeft, Clock, ExternalLink, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SiteHeader } from "@/components/site-header";
import { SaveJobButton } from "@/components/save-job-button";
import { getJobById } from "@/lib/jobs";
import { initials, timeAgo } from "@/lib/format";
import type { JobType } from "@/lib/types";

const TYPE_LABELS: Record<JobType, string> = {
  "full-time": "Full-Time",
  "part-time": "Part-Time",
  contract: "Contract",
  internship: "Internship",
  freelance: "Freelance",
  other: "Other",
};

interface JobPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}

export async function generateMetadata({
  params,
  searchParams,
}: JobPageProps): Promise<Metadata> {
  const { id } = await params;
  const { q } = await searchParams;
  const job = await getJobById(id, q);
  if (!job) return { title: "Job not found" };
  return { title: `${job.title} at ${job.company}` };
}

export default async function JobDetailPage({
  params,
  searchParams,
}: JobPageProps) {
  const { id } = await params;
  const { q } = await searchParams;
  const job = await getJobById(id, q);
  if (!job) notFound();

  const description = sanitizeHtml(job.descriptionHtml, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2"]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ["src", "alt", "width", "height"],
      a: ["href", "target", "rel"],
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        target: "_blank",
        rel: "noopener noreferrer",
      }),
    },
  });

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <Button
          variant="ghost"
          size="sm"
          className="mb-6 -ml-2 rounded-lg text-muted-foreground hover:text-foreground"
          render={<Link href="/" />}
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to jobs
        </Button>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* Job description */}
          <div className="min-w-0">
            <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm sm:p-8">
              <div className="flex items-start gap-4">
                {job.companyLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={job.companyLogo}
                    alt=""
                    className="hidden h-14 w-14 shrink-0 rounded-xl border border-border/70 bg-background object-contain p-1.5 sm:block"
                  />
                ) : (
                  <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-base font-bold text-white shadow-sm sm:flex">
                    {initials(job.company)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h1 className="font-heading text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
                    {job.title}
                  </h1>
                  <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {job.company}
                    </span>
                    <span aria-hidden>·</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {job.location}
                    </span>
                    <span aria-hidden>·</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {timeAgo(job.publishedAt)}
                    </span>
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-1.5">
                <Badge className="rounded-md border-transparent bg-primary/10 font-medium text-primary dark:bg-primary/15">
                  {TYPE_LABELS[job.jobType]}
                </Badge>
                <Badge variant="outline" className="rounded-md font-normal">
                  {job.category}
                </Badge>
                <Badge variant="outline" className="rounded-md font-normal">
                  {job.region}
                </Badge>
                <Badge variant="outline" className="rounded-md font-normal capitalize">
                  {job.level} level
                </Badge>
                {job.salary ? (
                  <Badge className="rounded-md border-transparent bg-emerald-500/10 font-medium text-emerald-600 dark:text-emerald-400">
                    {job.salary}
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-border/70 bg-card p-6 shadow-sm sm:p-8">
              <h2 className="font-heading text-lg font-semibold">
                Job description
              </h2>
              <Separator className="my-5" />
              <article
                className="prose prose-sm max-w-none dark:prose-invert [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_h1]:font-heading [&_h1]:text-xl [&_h1]:font-bold [&_h2]:font-heading [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-heading [&_h3]:font-semibold [&_img]:max-w-full [&_img]:rounded-lg [&_li]:my-1 [&_p]:leading-relaxed"
                dangerouslySetInnerHTML={{ __html: description }}
              />
            </div>
          </div>

          {/* Sidebar */}
          <aside>
            <div className="sticky top-24 space-y-4">
              <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  {job.companyLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={job.companyLogo}
                      alt=""
                      className="h-12 w-12 rounded-xl border border-border/70 bg-background object-contain p-1.5"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-bold text-white">
                      {initials(job.company)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{job.company}</p>
                    <p className="text-xs capitalize text-muted-foreground">
                      via {job.source}
                    </p>
                  </div>
                </div>

                <Button
                  className="mt-5 w-full rounded-xl shadow-md shadow-violet-500/20"
                  size="lg"
                  render={
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                >
                  Apply on {job.source}
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
                <SaveJobButton job={job} className="mt-2.5 w-full" />
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Opens the original posting in a new tab.
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-muted/30 p-5">
                <h3 className="text-sm font-semibold">Job details</h3>
                <dl className="mt-3 space-y-2.5 text-sm">
                  <Detail label="Type" value={TYPE_LABELS[job.jobType]} />
                  <Detail label="Level" value={job.level} capitalize />
                  <Detail label="Category" value={job.category} />
                  <Detail label="Region" value={job.region} />
                  <Detail label="Location" value={job.location} />
                  <Detail label="Source" value={job.source} capitalize />
                  {job.salary ? (
                    <Detail label="Salary" value={job.salary} />
                  ) : null}
                </dl>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function Detail({
  label,
  value,
  capitalize = false,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd
        className={`min-w-0 truncate text-right font-medium ${
          capitalize ? "capitalize" : ""
        }`}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}
