"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  overallScore?: number;
  grade?: string;
  executiveSummary?: string;
  sections?: { name: string; verdict: "strong" | "ok" | "weak"; feedback: string }[];
  topStrengths?: string[];
  criticalIssues?: { issue: string; why: string; fix: string }[];
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
  const [alerts, setAlerts] = useState<
    { id: string; keywords: string; frequency: string }[]
  >([]);
  const [alertKeywords, setAlertKeywords] = useState("");
  const [alertFrequency, setAlertFrequency] = useState("daily");
  const [alertBusy, setAlertBusy] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/job-alerts").catch(() => null);
      if (!cancelled && res?.ok) {
        const data = await res.json().catch(() => null);
        if (!cancelled && data) setAlerts(data.alerts ?? []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function addAlert() {
    const keywords = alertKeywords.trim();
    if (!keywords || alertBusy) return;
    setAlertBusy(true);
    try {
      const res = await fetch("/api/job-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords, frequency: alertFrequency }),
      });
      if (res.ok) {
        setAlertKeywords("");
        const data = await res.json();
        setAlerts((prev) => [
          { id: data.alert.id, keywords: data.alert.keywords, frequency: data.alert.frequency },
          ...prev,
        ]);
      }
    } finally {
      setAlertBusy(false);
    }
  }

  async function removeAlert(id: string) {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    await fetch(`/api/job-alerts?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    }).catch(() => undefined);
  }

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

            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <Input
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="Target role (optional) — e.g. Senior Frontend"
                className="w-full rounded-lg sm:w-64"
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
              <div className="flex flex-col gap-5">
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
            <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
              {/* Report header */}
              <div className="border-b border-border/60 bg-gradient-to-r from-violet-500/5 via-transparent to-fuchsia-500/5 p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="font-heading text-lg font-semibold">
                        Resume review
                      </h2>
                      <Badge
                        variant="outline"
                        className="rounded-md font-normal capitalize"
                        title={
                          review.data.mode === "ai"
                            ? "Recruiter-grade critique generated with DeepSeek"
                            : "Rule-based review — add an AI provider key for deeper critique"
                        }
                      >
                        {review.data.mode === "ai" ? "AI review" : "Rule-based"}
                      </Badge>
                    </div>
                    {review.data.executiveSummary ? (
                      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                        {review.data.executiveSummary}
                      </p>
                    ) : (
                      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                        {review.data.summary}
                      </p>
                    )}
                  </div>

                  {typeof review.data.overallScore === "number" ? (
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-16 w-16 flex-col items-center justify-center rounded-2xl font-heading ${
                          review.data.overallScore >= 80
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : review.data.overallScore >= 60
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                              : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        <span className="text-xl font-bold leading-none">
                          {review.data.overallScore}
                        </span>
                        <span className="text-[10px] uppercase tracking-wide opacity-70">
                          /100
                        </span>
                      </div>
                      {review.data.grade ? (
                        <Badge
                          variant="outline"
                          className="rounded-md font-normal"
                        >
                          {review.data.grade}
                        </Badge>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-6 p-6">
                {/* Section verdicts */}
                {review.data.sections && review.data.sections.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {review.data.sections.map((section) => {
                      const dot =
                        section.verdict === "strong"
                          ? "bg-emerald-500"
                          : section.verdict === "ok"
                            ? "bg-amber-500"
                            : "bg-destructive";
                      return (
                        <div
                          key={section.name}
                          className="rounded-xl border border-border/70 p-4"
                        >
                          <p className="flex items-center gap-2 text-sm font-semibold">
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full ${dot}`}
                            />
                            {section.name}
                          </p>
                          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                            {section.feedback}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {/* Top strengths */}
                {review.data.topStrengths && review.data.topStrengths.length > 0 ? (
                  <div>
                    <h3 className="text-sm font-semibold">Top strengths</h3>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {review.data.topStrengths.map((strength) => (
                        <Badge
                          key={strength}
                          className="rounded-md border-transparent bg-emerald-500/10 font-normal text-emerald-700 dark:text-emerald-400"
                        >
                          <Check className="h-3 w-3" />
                          {strength}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Prioritized fixes */}
                {review.data.criticalIssues && review.data.criticalIssues.length > 0 ? (
                  <div>
                    <h3 className="text-sm font-semibold">
                      Priority fixes — in order of impact
                    </h3>
                    <ol className="mt-3 space-y-3">
                      {review.data.criticalIssues.map((issue, index) => (
                        <li
                          key={issue.issue}
                          className="rounded-xl border border-border/70 bg-muted/30 p-4"
                        >
                          <p className="text-sm font-semibold">
                            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                              {index + 1}
                            </span>
                            {issue.issue}
                          </p>
                          {issue.why ? (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {issue.why}
                            </p>
                          ) : null}
                          {issue.fix ? (
                            <p className="mt-1.5 text-sm">
                              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                Fix:{" "}
                              </span>
                              {issue.fix}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}

                {/* Keyword gaps */}
                {review.data.missingKeywords.length > 0 ? (
                  <div>
                    <h3 className="text-sm font-semibold">
                      Keyword gaps vs the market
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Add these only if they truthfully describe your experience.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {review.data.missingKeywords.map((keyword) => (
                        <Badge
                          key={keyword}
                          variant="outline"
                          className="rounded-md font-normal"
                        >
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Rule-based structural checks (heuristic mode) */}
                {review.data.checklist.length > 0 ? (
                  <div>
                    <h3 className="text-sm font-semibold">Structural checks</h3>
                    <ul className="mt-2.5 space-y-2.5">
                      {review.data.checklist.map((item) => (
                        <li
                          key={item.check}
                          className="flex items-start gap-2.5 text-sm"
                        >
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
                            <span className="text-muted-foreground">
                              {" "}
                              — {item.detail}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {/* ATS tips */}
                {review.data.atsTips.length > 0 ? (
                  <div>
                    <h3 className="text-sm font-semibold">ATS tips</h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {review.data.atsTips.map((tip) => (
                        <li key={tip}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {review.data.skillSuggestions.length > 0 ? (
                  <div>
                    <h3 className="text-sm font-semibold">Skill recommendations</h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {review.data.skillSuggestions.map((tip) => (
                        <li key={tip}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {/* Job alerts */}
          {analysis ? (
            <section className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
              <h2 className="font-heading text-lg font-semibold">Job alerts</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Tell us what to watch for. Delivery to your inbox is coming
                soon — your alert is stored today.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Input
                  value={alertKeywords}
                  onChange={(e) => setAlertKeywords(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addAlert();
                    }
                  }}
                  placeholder="Keywords — e.g. react frontend singapore"
                  className="min-w-56 flex-1 rounded-lg"
                />
                <Select
                  value={alertFrequency}
                  onValueChange={(value) => {
                    if (value) setAlertFrequency(value);
                  }}
                  items={{ daily: "Daily", weekly: "Weekly", instant: "Instant" }}
                >
                  <SelectTrigger className="w-32 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instant">Instant</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  className="rounded-lg"
                  onClick={addAlert}
                  disabled={alertBusy || !alertKeywords.trim()}
                >
                  {alertBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Add alert"
                  )}
                </Button>
              </div>

              {alerts.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {alerts.map((alert) => (
                    <li
                      key={alert.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/30 px-4 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {alert.keywords}
                        </p>
                        <p className="text-xs capitalize text-muted-foreground">
                          {alert.frequency}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-lg text-muted-foreground hover:text-destructive"
                        onClick={() => removeAlert(alert.id)}
                        aria-label="Remove alert"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
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
