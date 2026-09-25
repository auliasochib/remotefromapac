import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import sanitizeHtml from "sanitize-html";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Button
          variant="ghost"
          size="sm"
          className="mb-6"
          render={<Link href="/" />}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to jobs
        </Button>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Job description */}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold sm:text-3xl">{job.title}</h1>
            <p className="mt-2 text-muted-foreground">
              {job.company} · {job.location} · Posted {timeAgo(job.publishedAt)}
            </p>

            <div className="mt-4 flex flex-wrap gap-1.5">
              <Badge variant="secondary">{TYPE_LABELS[job.jobType]}</Badge>
              <Badge variant="outline">{job.category}</Badge>
              <Badge variant="outline">{job.region}</Badge>
              <Badge variant="outline" className="capitalize">
                {job.level} level
              </Badge>
              {job.salary ? <Badge variant="outline">{job.salary}</Badge> : null}
            </div>

            <Separator className="my-6" />

            <article
              className="prose prose-sm max-w-none dark:prose-invert [&_a]:text-primary [&_a]:underline [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_img]:max-w-full [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
              dangerouslySetInnerHTML={{ __html: description }}
            />
          </div>

          {/* Sidebar */}
          <aside>
            <Card className="sticky top-20">
              <CardHeader className="flex-row items-center gap-3 space-y-0">
                {job.companyLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={job.companyLogo}
                    alt=""
                    className="h-12 w-12 rounded-md border object-contain p-1"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-md border bg-muted text-sm font-semibold text-muted-foreground">
                    {initials(job.company)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold">{job.company}</p>
                  <p className="text-xs text-muted-foreground">
                    via {job.source}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" size="lg" render={<a href={job.url} target="_blank" rel="noopener noreferrer" />}>
                  Apply on {job.source}
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
                <SaveJobButton job={job} className="w-full" />
                <p className="text-center text-xs text-muted-foreground">
                  You will be redirected to the original job posting.
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}
