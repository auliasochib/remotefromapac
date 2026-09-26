"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string; code?: string }
  | { status: "done"; letter: string };

export function CoverLetterGenerator({ jobId }: { jobId: string }) {
  const [state, setState] = useState<State>({ status: "idle" });
  const [copied, setCopied] = useState(false);

  async function generate() {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        setState({
          status: "error",
          code: "unauthorized",
          message: "Sign in (and upload your resume on the Dashboard) to generate a cover letter.",
        });
        return;
      }
      if (res.status === 409) {
        setState({
          status: "error",
          code: "no_resume",
          message: "Upload your resume on the Dashboard first — the letter is written from it.",
        });
        return;
      }
      if (!res.ok) {
        setState({
          status: "error",
          message: data.message ?? data.error ?? "Generation failed.",
        });
        return;
      }
      setState({ status: "done", letter: data.letter });
    } catch {
      setState({ status: "error", message: "Network error — try again." });
    }
  }

  async function copy() {
    if (state.status !== "done") return;
    await navigator.clipboard.writeText(state.letter).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-4 rounded-xl border border-border/70 bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          AI cover letter
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-lg text-primary hover:text-primary"
          onClick={generate}
          disabled={state.status === "loading"}
        >
          {state.status === "loading" ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Wand2 className="mr-1.5 h-3.5 w-3.5" />
          )}
          {state.status === "done" ? "Regenerate" : "Generate"}
        </Button>
      </div>

      {state.status === "error" ? (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {state.message}{" "}
          {state.code === "unauthorized" ? (
            <Link href="/signin" className="text-primary underline">
              Sign in
            </Link>
          ) : null}
          {state.code === "no_resume" ? (
            <Link href="/dashboard" className="text-primary underline">
              Open Dashboard
            </Link>
          ) : null}
        </p>
      ) : null}

      {state.status === "done" ? (
        <>
          <p className="mt-3 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg bg-background p-3 text-xs leading-relaxed">
            {state.letter}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 w-full rounded-lg"
            onClick={copy}
          >
            {copied ? (
              <>
                <Check className="mr-1.5 h-3.5 w-3.5" /> Copied
              </>
            ) : (
              <>
                <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy letter
              </>
            )}
          </Button>
        </>
      ) : null}

      {state.status === "idle" ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Written from your uploaded resume and this job&apos;s description.
          Requires an AI provider key.
        </p>
      ) : null}
    </div>
  );
}
