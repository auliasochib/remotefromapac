"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, ExternalLink, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { initials } from "@/lib/format";

interface SavedJob {
  _id: string;
  jobId: string;
  title: string;
  company?: string;
  companyLogo?: string;
  url: string;
  location?: string;
  jobType?: string;
  category?: string;
  savedAt: string;
}

type State =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "not-configured" }
  | { status: "error"; message: string }
  | { status: "ready"; jobs: SavedJob[] };

async function fetchSavedJobs(): Promise<State> {
  try {
    const res = await fetch("/api/saved-jobs");
    if (res.status === 401) return { status: "unauthenticated" };
    if (res.status === 503) return { status: "not-configured" };
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    const data = await res.json();
    return { status: "ready", jobs: data.jobs ?? [] };
  } catch {
    return {
      status: "error",
      message: "Could not load saved jobs. Please try again.",
    };
  }
}

export function SavedJobsList() {
  const [state, setState] = useState<State>({ status: "loading" });

  const reload = useCallback(() => {
    fetchSavedJobs().then((next) => setState(next));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchSavedJobs().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function retry() {
    setState({ status: "loading" });
    reload();
  }

  async function remove(jobId: string) {
    setState((prev) =>
      prev.status === "ready"
        ? { status: "ready", jobs: prev.jobs.filter((j) => j.jobId !== jobId) }
        : prev
    );
    await fetch(`/api/saved-jobs?jobId=${encodeURIComponent(jobId)}`, {
      method: "DELETE",
    }).catch(() => undefined);
    reload();
  }

  if (state.status === "loading") {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (state.status === "unauthenticated") {
    return (
      <EmptyState
        title="You are not signed in"
        text="Sign in to save jobs and see them here on any device."
      >
        <Button size="sm" render={<Link href="/signin" />}>
          Sign in
        </Button>
      </EmptyState>
    );
  }

  if (state.status === "not-configured") {
    return (
      <EmptyState
        title="Saved jobs need a database"
        text="Set MONGODB_URI in your .env.local file (see README) and restart the app to enable this feature."
      />
    );
  }

  if (state.status === "error") {
    return (
      <EmptyState title="Something went wrong" text={state.message}>
        <Button variant="outline" size="sm" className="rounded-lg" onClick={retry}>
          Retry
        </Button>
      </EmptyState>
    );
  }

  if (state.jobs.length === 0) {
    return (
      <EmptyState
        title="No saved jobs yet"
        text="Browse jobs and press the Save button to bookmark them."
      >
        <Button size="sm" render={<Link href="/" />}>
          Browse jobs
        </Button>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      {state.jobs.map((job) => (
        <div
          key={job._id}
          className="flex flex-wrap items-center gap-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-all hover:border-primary/25 hover:shadow-md sm:p-5"
        >
          {job.companyLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={job.companyLogo}
              alt=""
              className="h-11 w-11 shrink-0 rounded-xl border border-border/70 bg-background object-contain p-1.5"
            />
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-bold text-white shadow-sm">
              {initials(job.company ?? "?")}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-heading text-[0.95rem] font-semibold">
              {job.title}
            </h3>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {job.company} {job.location ? `· ${job.location}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {job.jobType ? (
                <Badge className="rounded-md border-transparent bg-primary/10 font-medium text-primary dark:bg-primary/15">
                  {job.jobType}
                </Badge>
              ) : null}
              {job.category ? (
                <Badge variant="outline" className="rounded-md font-normal">
                  {job.category}
                </Badge>
              ) : null}
            </div>
          </div>
          <div className="flex w-full shrink-0 gap-2 sm:w-auto">
            <Button
              size="sm"
              className="flex-1 rounded-lg sm:flex-none"
              render={
                <a href={job.url} target="_blank" rel="noopener noreferrer" />
              }
            >
              Apply <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => remove(job.jobId)}
              aria-label="Remove saved job"
              title="Remove from saved jobs"
              className="rounded-lg text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border p-10 text-center">
      <Bookmark className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="mt-3 font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
