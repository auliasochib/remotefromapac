import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB, isDbConfigured } from "@/lib/db";
import { JobModel } from "@/models/job";
import { ResumeAnalysisModel } from "@/models/resume-analysis";
import { getJobById } from "@/lib/jobs";
import { aiNotConfiguredMessage, generateText, isAiConfigured } from "@/lib/ai";
import { getPremiumStatus } from "@/lib/premium";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Generate a tailored cover letter for one job, from the stored resume.
 *
 * This is the one genuinely AI-only feature: without a configured provider the
 * endpoint answers with setup guidance rather than a generic template.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Each letter is a paid DeepSeek call — keep it bounded per user.
  const limit = checkRateLimit(`cover-letter:${email}`, 10, 60 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "ai_not_configured", message: aiNotConfiguredMessage() },
      { status: 503 }
    );
  }

  // Premium feature per the monetization plan — free users get the upgrade
  // prompt (Midtrans Snap) from the client.
  const { premium } = await getPremiumStatus(email);
  if (!premium) {
    return NextResponse.json(
      { error: "payment_required", message: "Cover letters are a Premium feature." },
      { status: 402 }
    );
  }
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "db_not_configured", message: "Set MONGODB_URI first." },
      { status: 503 }
    );
  }

  let jobId = "";
  try {
    const body = await request.json();
    jobId = String(body?.jobId ?? "").slice(0, 200);
  } catch {
    // handled below
  }
  if (!jobId) {
    return NextResponse.json(
      { error: "bad_request", message: "jobId is required." },
      { status: 400 }
    );
  }

  await connectDB();
  const [analysis, stored] = await Promise.all([
    ResumeAnalysisModel.findOne({ user: email }).lean<{
      textPreview: string;
      yearsExperience: number | null;
    } | null>(),
    JobModel.findOne({ id: jobId }).lean<{
      title: string;
      company: string;
      location?: string;
      descriptionHtml?: string;
    } | null>(),
  ]);

  if (!analysis) {
    return NextResponse.json(
      { error: "no_resume", message: "Upload a resume on the Dashboard first." },
      { status: 409 }
    );
  }

  const job = stored
    ? {
        title: stored.title,
        company: stored.company,
        location: stored.location ?? "Remote",
        text: (stored.descriptionHtml ?? "").replace(/<[^>]*>/g, " "),
      }
    : await (async () => {
        const live = await getJobById(jobId);
        if (!live) return null;
        return {
          title: live.title,
          company: live.company,
          location: live.location,
          text: live.descriptionHtml.replace(/<[^>]*>/g, " "),
        };
      })();

  if (!job) {
    return NextResponse.json({ error: "job_not_found" }, { status: 404 });
  }

  try {
    const letter = await generateText(
      "You write concise, specific cover letters for remote-job applicants in the Asia-Pacific region. Plain text only — no markdown, no subject line, no placeholders like [Company]. Use only facts implied by the resume and job description; never invent employers, numbers or credentials. Always write in English, regardless of the language of the resume or the job posting.",
      `Write a cover letter of 220–300 words.

Job: ${job.title} at ${job.company} (${job.location})

Job description (excerpt):
${job.text.slice(0, 3500)}

Candidate resume:
${analysis.textPreview.slice(0, 6000)}

Requirements: open with a specific reason this role fits; connect 2–3 resume skills to the job's stated needs; ${analysis.yearsExperience ? `reference roughly ${analysis.yearsExperience} years of experience once; ` : ""}close with availability across APAC time zones and a call to action.`,
      900
    );

    return NextResponse.json({
      ok: true,
      letter: letter.trim(),
      job: { id: jobId, title: job.title, company: job.company },
    });
  } catch (error) {
    console.error("Cover letter generation failed:", error);
    return NextResponse.json(
      {
        error: "ai_error",
        message: `The AI provider could not generate a letter: ${String(error).slice(0, 200)}`,
      },
      { status: 502 }
    );
  }
}
