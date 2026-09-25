import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SaveJobButton } from "@/components/save-job-button";
import { initials, timeAgo } from "@/lib/format";
import type { Job, JobType } from "@/lib/types";

const TYPE_LABELS: Record<JobType, string> = {
  "full-time": "Full-Time",
  "part-time": "Part-Time",
  contract: "Contract",
  internship: "Internship",
  freelance: "Freelance",
  other: "Other",
};

export function JobCard({ job, search }: { job: Job; search?: string }) {
  const detailHref = `/jobs/${job.id}${
    search ? `?q=${encodeURIComponent(search)}` : ""
  }`;

  return (
    <Card className="flex h-full flex-col transition-shadow hover:shadow-md">
      <CardHeader className="flex-row items-start gap-3 space-y-0">
        {job.companyLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={job.companyLogo}
            alt=""
            className="h-10 w-10 shrink-0 rounded-md border object-contain p-1"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-muted text-xs font-semibold text-muted-foreground">
            {initials(job.company)}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <CardTitle className="truncate text-base">
            <Link
              href={detailHref}
              className="hover:underline"
              title={job.title}
            >
              {job.title}
            </Link>
          </CardTitle>
          <p className="truncate text-sm text-muted-foreground">
            {job.company} · {job.location}
          </p>
        </div>

        <SaveJobButton job={job} />
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary">{TYPE_LABELS[job.jobType]}</Badge>
          <Badge variant="outline">{job.category}</Badge>
          <Badge variant="outline">{job.region}</Badge>
          <Badge variant="outline" className="capitalize">
            {job.level}
          </Badge>
          {job.salary ? (
            <Badge variant="outline">{job.salary}</Badge>
          ) : null}
        </div>

        <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {timeAgo(job.publishedAt)} · via {job.source}
          </span>
          <Button
            variant="ghost"
            size="sm"
            render={<Link href={detailHref} />}
          >
            Details <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
