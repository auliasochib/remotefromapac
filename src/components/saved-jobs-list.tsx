"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, ExternalLink, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
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

export function SavedJobsList() {
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/saved-jobs");
      if (res.status === 401) {
        setState({ status: "unauthenticated" });
        return;
      }
      if (res.status === 503) {
        setState({ status: "not-configured" });
        return;
      }
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      setState({ status: "ready", jobs: data.jobs ?? [] });
    } catch {
      setState({
        status: "error",
        message: "Could not load saved jobs. Please try again.",
      });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(jobId: string) {
    setState((prev) =>
      prev.status === "ready"
        ? { status: "ready", jobs: prev.jobs.filter((j) => j.jobId !== jobId) }
        : prev
    );
    await fetch(`/api/saved-jobs?jobId=${encodeURIComponent(jobId)}`, {
      method: "DELETE",
    }).catch(() => undefined);
    load();
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
        <Button variant="outline" size="sm" onClick={load}>
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
        <Card key={job._id}>
          <CardHeader className="flex-row items-center gap-3 space-y-0 py-4">
            {job.companyLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={job.companyLogo}
                alt=""
                className="h-10 w-10 shrink-0 rounded-md border object-contain p-1"
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-muted text-xs font-semibold text-muted-foreground">
                {initials(job.company ?? "?")}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate text-base">{job.title}</CardTitle>
              <p className="truncate text-sm text-muted-foreground">
                {job.company} {job.location ? `· ${job.location}` : ""}
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {job.jobType ? (
                  <Badge variant="secondary">{job.jobType}</Badge>
                ) : null}
                {job.category ? (
                  <Badge variant="outline">{job.category}</Badge>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                size="sm"
                render={
                  <a href={job.url} target="_blank" rel="noopener noreferrer" />
                }
              >
                Apply <ExternalLink className="ml-1 h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => remove(job.jobId)}
                aria-label="Remove saved job"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
        </Card>
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
