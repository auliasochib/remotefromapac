"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Job } from "@/lib/types";

export function SaveJobButton({
  job,
  initialSaved = false,
  className,
  iconOnly = false,
}: {
  job: Job;
  initialSaved?: boolean;
  className?: string;
  iconOnly?: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const next = !saved;
    setSaved(next); // optimistic

    try {
      const res = next
        ? await fetch("/api/saved-jobs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jobId: job.id,
              title: job.title,
              company: job.company,
              companyLogo: job.companyLogo,
              url: job.applyUrl,
              location: job.location,
              jobType: job.jobType,
              category: job.category,
              region: job.region,
              source: job.source,
            }),
          })
        : await fetch(`/api/saved-jobs?jobId=${encodeURIComponent(job.id)}`, {
            method: "DELETE",
          });

      if (res.status === 401) {
        setSaved(!next);
        router.push("/signin");
        return;
      }
      if (!res.ok) {
        setSaved(!next);
        const data = await res.json().catch(() => null);
        alert(data?.message ?? data?.error ?? "Something went wrong.");
        return;
      }
      if (next) router.refresh();
    } catch {
      setSaved(!next);
      alert("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size={iconOnly ? "icon-sm" : "sm"}
      onClick={toggle}
      disabled={busy}
      aria-label={saved ? "Remove from saved jobs" : "Save job"}
      title={saved ? "Remove from saved jobs" : "Save job"}
      className={`shrink-0 rounded-lg text-muted-foreground hover:text-foreground ${
        saved ? "text-primary hover:text-primary" : ""
      } ${className ?? ""}`}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : saved ? (
        <BookmarkCheck className="h-4 w-4 fill-primary/20" />
      ) : (
        <Bookmark className="h-4 w-4" />
      )}
      {iconOnly ? null : saved ? (
        "Saved"
      ) : (
        "Save"
      )}
    </Button>
  );
}
