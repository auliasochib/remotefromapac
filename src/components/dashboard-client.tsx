"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JobCard } from "@/components/job-card";
import { UpgradeModal } from "@/components/upgrade-modal";
import type { Job } from "@/lib/types";

interface Analysis {
  fileName: string;
  skills: string[];
  yearsExperience: number | null;
  textChars: number;
  updatedAt: string;
}

interface Match {
  job: Job;
  score: number;
  strengths: string[];
  missing: string[];
}

interface Review {
  mode: "ai" | "heuristic";
  summary: string;
  checklist: { check: string; pass: boolean; detail: string }[];
  missingKeywords: string[];
  atsTips: string[];
  skillSuggestions: string[];
}

type SectionState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; data: T };

export function DashboardClient() {
  const [session, setSession] = useState<{ signedIn: boolean } | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [matches, setMatches] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "done"; data: Match[]; mode: "ai" | "heuristic" }
  >({ status: "idle" });
  const [review, setReview] = useState<SectionState<Review>>({ status: "idle" });
  const [targetRole, setTargetRole] = useState("");
  const [paywallOpen, setPaywallOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/resume");
        if (res.status === 401) {
          if (!cancelled) {
            setSession({ signedIn: false });
            setAnalysisLoading(false);
          }
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setSession({ signedIn: true });
          setAnalysis(data.analysis ?? null);
          setAnalysisLoading(false);
        }
      } catch {
        if (!cancelled) {
          setSession({ signedIn: true });
          setAnalysisLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function upload(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/resume/upload", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setUploadError("Please sign in first.");
        return;
      }
      if (!res.ok) {
        setUploadError(data.message ?? data.error ?? "Upload failed.");
        return;
      }
      setAnalysis(data.analysis);
      // A new resume invalidates previous results.
      setMatches({ status: "idle" });
      setReview({ status: "idle" });
    } catch {
      setUploadError("Network error — try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeResume() {
    await fetch("/api/resume", { method: "DELETE" }).catch(() => undefined);
    setAnalysis(null);
    setMatches({ status: "idle" });
    setReview({ status: "idle" });
  }

  async function runMatch() {
    setMatches({ status: "loading" });
    try {
      const res = await fetch("/api/resume/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 9 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMatches({
          status: "error",
          message: data.message ?? data.error ?? "Matching failed.",
        });
        return;
      }
      setMatches({
        status: "done",
        data: data.matches,
        mode: data.mode === "ai" ? "ai" : "heuristic",
      });
      // Free plan: show the results, then surface the Midtrans upgrade prompt
      // automatically — AI ranking is a premium feature.
      if (data.aiGated) setPaywallOpen(true);
    } catch {
      setMatches({ status: "error", message: "Network error — try again." });
    }
  }

  async function runReview() {
    setReview({ status: "loading" });
    try {
      const res = await fetch("/api/resume/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setReview({
          status: "error",
          message: data.message ?? data.error ?? "Review failed.",
        });
        return;
      }
      setReview({ status: "done", data: data.review });
      // Premium feature: prompt the upgrade for free users.
      if (data.aiGated) setPaywallOpen(true);
    } catch {
      setReview({ status: "error", message: "Network error — try again." });
    }
  }

  if (session === null || analysisLoading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-card p-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (!session.signedIn) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card p-10 text-center">
        <Sparkles className="mx-auto h-8 w-8 text-primary" />
        <h2 className="mt-4 font-heading text-xl font-semibold">
          Sign in to use AI matching
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Upload your resume and get a skill-based match score for every job in
          the database, plus a resume review.
        </p>
        <Button className="mt-5 rounded-xl" render={<Link href="/signin" />}>
          Sign in with GitHub
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Resume card */}
      <section className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-heading text-lg font-semibold">Your resume</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              PDF or plain text, up to 2 MB. Only the extracted text is stored —
              never the file itself.
            </p>
          </div>
          {analysis ? (
            <Button
              variant="ghost"
              size="sm"
              className="rounded-lg text-muted-foreground hover:text-destructive"
              onClick={removeResume}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
            </Button>
          ) : null}
        </div>

        {analysis ? (
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5 font-medium">
                <FileText className="h-4 w-4 text-primary" />
                {analysis.fileName}
              </span>
              {analysis.yearsExperience !== null ? (
                <Badge variant="outline" className="rounded-md font-normal">
                  ~{analysis.yearsExperience} yr experience
                </Badge>
              ) : null}
              <Badge variant="outline" className="rounded-md font-normal">
                {analysis.skills.length} skills detected
              </Badge>
            </div>

            {analysis.skills.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {analysis.skills.map((skill) => (
                  <Badge
                    key={skill}
                    variant="secondary"
                    className="rounded-md font-normal"
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No known skills were detected — the matcher will rely on the
                resume text alone.
              </p>
            )}
          </div>
        ) : (
          <label
            className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 px-6 py-10 text-center transition-colors hover:border-primary/40 hover:bg-muted/50"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) upload(file);
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.md,text/plain,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload(file);
              }}
            />
            {uploading ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="mt-3 text-sm font-medium">Extracting text…</span>
              </>
            ) : (
              <>
                <Upload className="h-6 w-6 text-muted-foreground" />
                <span className="mt-3 text-sm font-medium">
                  Drop your resume here, or click to browse
                </span>
                <span className="mt-1 text-xs text-muted-foreground">
                  PDF or TXT · max 2 MB
                </span>
              </>
            )}
          </label>
        )}

        {uploadError ? (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-destructive">
            <XCircle className="h-4 w-4" /> {uploadError}
          </p>
        ) : null}
      </section>

      {analysis ? (
        <>
          {/* Match + review actions */}
          <section className="flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              className="rounded-xl shadow-md shadow-violet-500/20"
              onClick={runMatch}
              disabled={matches.status === "loading"}
            >
              {matches.status === "loading" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Find matching jobs
            </Button>

            <div className="flex items-center gap-2">
              <Input
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="Target role (optional) — e.g. Senior Frontend"
                className="w-64 rounded-lg"
              />
              <Button
                variant="outline"
                size="lg"
                className="rounded-xl"
                onClick={runReview}
                disabled={review.status === "loading"}
              >
                {review.status === "loading" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="mr-2 h-4 w-4" />
                )}
                Review resume
              </Button>
            </div>
          </section>

          {/* Match results */}
          {matches.status === "error" ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {matches.message}
            </p>
          ) : null}
          {matches.status === "done" ? (
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <h2 className="font-heading text-lg font-semibold">
                  Recommended jobs
                </h2>
                <Badge
                  variant="outline"
                  className={`rounded-md font-normal ${
                    matches.mode === "ai"
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : ""
                  }`}
                  title={
                    matches.mode === "ai"
                      ? "Scores judged semantically by the configured AI model"
                      : "Rule-based skill matching — add an AI provider key for semantic ranking"
                  }
                >
                  {matches.mode === "ai" ? "AI-ranked" : "Rule-based"}
                </Badge>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {matches.data.map((match, index) => (
                  <div key={match.job.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold ${
                          match.score >= 75
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : match.score >= 55
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                              : "bg-muted text-muted-foreground"
                        }`}
                        title="Match score"
                      >
                        {match.score}%
                      </div>
                      <p className="text-xs text-muted-foreground">
                        match score
                      </p>
                    </div>
                    <JobCard job={match.job} index={index} />
                    <div className="rounded-xl border border-border/70 bg-muted/30 p-3 text-xs">
                      {match.strengths.length > 0 ? (
                        <p className="text-emerald-600 dark:text-emerald-400">
                          ✓ {match.strengths.join(" · ")}
                        </p>
                      ) : null}
                      {match.missing.length > 0 ? (
                        <p className="mt-1 text-muted-foreground">
                          ✗ Missing: {match.missing.join(", ")}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* Review results */}
          {review.status === "error" ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {review.message}
            </p>
          ) : null}
          {review.status === "done" ? (
            <section className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-heading text-lg font-semibold">
                  Resume review
                </h2>
                <Badge
                  variant="outline"
                  className="rounded-md font-normal capitalize"
                  title={
                    review.data.mode === "ai"
                      ? "Generated with the configured AI provider"
                      : "Rule-based review — add an AI provider key for deeper critique"
                  }
                >
                  {review.data.mode === "ai" ? "AI review" : "Rule-based"}
                </Badge>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {review.data.summary}
              </p>

              <ul className="mt-5 space-y-2.5">
                {review.data.checklist.map((item) => (
                  <li key={item.check} className="flex items-start gap-2.5 text-sm">
                    <span
                      className={
                        item.pass
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-amber-600 dark:text-amber-400"
                      }
                    >
                      {item.pass ? "✓" : "✗"}
                    </span>
                    <span>
                      <span className="font-medium">{item.check}</span>
                      <span className="text-muted-foreground"> — {item.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>

              {review.data.atsTips.length > 0 ? (
                <>
                  <h3 className="mt-6 text-sm font-semibold">ATS tips</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {review.data.atsTips.map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                </>
              ) : null}

              {review.data.skillSuggestions.length > 0 ? (
                <>
                  <h3 className="mt-6 text-sm font-semibold">Skill recommendations</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {review.data.skillSuggestions.map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </section>
          ) : null}
        </>
      ) : null}

      <UpgradeModal
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        onUpgraded={() => window.location.reload()}
      />
    </div>
  );
}
