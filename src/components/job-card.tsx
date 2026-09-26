import Link from "next/link";
import { ArrowUpRight, Building2, Clock, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

/** Deterministic tile colour so a company keeps the same look everywhere. */
const TILE_STYLES = [
  "from-violet-500 to-fuchsia-500",
  "from-blue-500 to-cyan-500",
  "from-emerald-500 to-teal-500",
  "from-orange-500 to-amber-500",
  "from-rose-500 to-pink-500",
  "from-indigo-500 to-violet-500",
];

function tileStyle(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) % 997;
  }
  return TILE_STYLES[hash % TILE_STYLES.length];
}

export function JobCard({
  job,
  search,
  index = 0,
}: {
  job: Job;
  search?: string;
  index?: number;
}) {
  const detailHref = `/jobs/${job.id}${
    search ? `?q=${encodeURIComponent(search)}` : ""
  }`;

  return (
    <article
      className="animate-rise group relative flex flex-col rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-violet-500/5"
      style={{ "--delay": `${Math.min(index, 11) * 40}ms` } as React.CSSProperties}
    >
      <div className="flex items-start gap-3">
        {job.companyLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={job.companyLogo}
            alt=""
            className="h-11 w-11 shrink-0 rounded-xl border border-border/70 bg-background object-contain p-1.5"
          />
        ) : (
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${tileStyle(
              job.company
            )} text-sm font-bold text-white shadow-sm`}
          >
            {initials(job.company)}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-[0.95rem] font-semibold leading-snug">
            <Link
              href={detailHref}
              className="line-clamp-2 transition-colors group-hover:text-primary"
              title={job.title}
            >
              {job.title}
            </Link>
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{job.company}</span>
          </p>
        </div>

        <div className="shrink-0">
          <SaveJobButton job={job} iconOnly />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {job.apac === "apac" ? (
          <Badge className="rounded-md border-transparent bg-gradient-to-r from-violet-600 to-fuchsia-500 font-medium text-white">
            <MapPin className="h-3 w-3" />
            APAC
          </Badge>
        ) : null}
        <Badge className="rounded-md border-transparent bg-primary/10 font-medium text-primary hover:bg-primary/15 dark:bg-primary/15">
          {TYPE_LABELS[job.jobType]}
        </Badge>
        <Badge variant="outline" className="rounded-md font-normal">
          {job.category}
        </Badge>
        <Badge variant="outline" className="rounded-md font-normal capitalize">
          {job.level}
        </Badge>
      </div>

      {job.tags.length > 0 ? (
        <p className="mt-3 line-clamp-1 text-xs text-muted-foreground" title={job.tags.join(" · ")}>
          {job.tags.slice(0, 5).join(" · ")}
        </p>
      ) : null}

      {job.salary ? (
        <p className="mt-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          {job.salary}
        </p>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/60 pt-3.5 text-xs text-muted-foreground">
        <span
          className="flex min-w-0 items-center gap-1.5"
          title={`${job.location} · via ${job.source}`}
        >
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{job.location}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5" title={`via ${job.source}`}>
          <Clock className="h-3.5 w-3.5" />
          {timeAgo(job.publishedAt)}
        </span>
        <Link
          href={detailHref}
          className="flex shrink-0 items-center gap-0.5 font-medium text-primary hover:underline"
        >
          View
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  );
}
