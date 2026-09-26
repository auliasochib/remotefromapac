import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB, isDbConfigured } from "@/lib/db";
import { JobModel } from "@/models/job";
import { ResumeAnalysisModel } from "@/models/resume-analysis";
import { scoreJobMatch } from "@/lib/skills";
import { generateJson, isAiConfigured } from "@/lib/ai";

export const dynamic = "force-dynamic";
/** The optional AI re-rank adds one LLM call on top of the database reads. */
export const maxDuration = 120;

const CANDIDATE_POOL = 300;
const AI_SHORTLIST = 25;

/**
 * Match the signed-in user's stored resume against jobs in the database.
 *
 * Scoring is heuristic (skill overlap + seniority alignment) and needs no AI
 * provider. The AI layer builds on top of this data — review and cover letters
 * read the same analysis.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isDbConfigured()) {
    return NextResponse.json(
      {
        error: "db_not_configured",
        message: "Set MONGODB_URI to enable resume matching.",
      },
      { status: 503 }
    );
  }

  let limit = 6;
  try {
    const body = await request.json();
    limit = Math.min(12, Math.max(1, Number(body?.limit) || 6));
  } catch {
    // default limit
  }

  await connectDB();
  const analysis = await ResumeAnalysisModel.findOne({ user: email }).lean<{
    skills: string[];
    yearsExperience: number | null;
    textPreview: string;
  } | null>();

  if (!analysis) {
    return NextResponse.json(
      { error: "no_resume", message: "Upload a resume first." },
      { status: 409 }
    );
  }

  const candidates = await JobModel.find({ apac: { $in: ["apac", "worldwide"] } })
    .sort({ publishedAt: -1 })
    .limit(CANDIDATE_POOL)
    .lean<{
      id: string;
      source: string;
      title: string;
      company: string;
      companyLogo?: string | null;
      applyUrl: string;
      location?: string;
      region?: string;
      apac?: string;
      jobType?: string;
      category?: string;
      tags?: string[];
      level?: string;
      salary?: string | null;
      descriptionHtml?: string;
      publishedAt?: Date;
    }[]>();

  const resumeSkills: string[] = analysis.skills ?? [];
  const resumeYears = analysis.yearsExperience ?? null;

  const scored = candidates
    .map((job) => {
      // Titles carry the strongest requirement signal; tags are curated by the
      // source; the description snippet adds anything the source left out.
      const jobText =
        `${job.title} ${(job.tags ?? []).join(" ")} ${job.category ?? ""} ${(job.descriptionHtml ?? "")
          .replace(/<[^>]*>/g, " ")
          .slice(0, 4000)}`;

      const match = scoreJobMatch(jobText, job.level ?? "mid", resumeSkills, resumeYears);

      // Bonus for keyword overlap with the resume text itself (skills spelled
      // differently in the resume than in the dictionary entries).
      const directHits = resumeSkills.filter((skill) => {
        const rx = new RegExp(
          `(^|[^a-z0-9+#])${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9+#])`,
          "i"
        );
        return rx.test(jobText);
      }).length;
      const score = Math.min(99, match.score + Math.min(6, directHits * 2));

      return {
        job,
        score,
        strengths: match.strengths,
        missing: match.missing,
      };
    })
    .sort((a, b) => b.score - a.score);

  /**
   * Optional AI re-rank: the heuristic pass is a cheap recall filter; the LLM
   * then judges the shortlist semantically — equivalent experience phrased
   * differently, transferable skills, seniority fit — and returns its own
   * scores. Falls back silently to the heuristic order on any failure.
   */
  let mode: "ai" | "heuristic" = "heuristic";
  let finalScored = scored;

  if (isAiConfigured() && scored.length > 0) {
    const shortlist = scored.slice(0, AI_SHORTLIST);
    try {
      const resume = `${analysis.textPreview.slice(0, 5000)}`;
      const listings = shortlist
        .map((entry, index) => {
          const job = entry.job;
          const description = (job.descriptionHtml ?? "")
            .replace(/<[^>]*>/g, " ")
            .replace(/\s+/g, " ")
            .slice(0, 500);
          return `${index}. id=${job.id} | ${job.title} | ${job.company} | ${job.location} | level: ${job.level} | tags: ${(job.tags ?? []).join(", ")}\n   ${description}`;
        })
        .join("\n");

      const ai = await generateJson<{
        matches?: { id: string; score: number; strengths?: string[]; missing?: string[] }[];
      }>(
        "You are a technical recruiter scoring how well a candidate fits remote jobs available in the Asia-Pacific region.",
        `Candidate resume:\n${resume}\n\nJob shortlist:\n${listings}\n\nScore every job 0-100 for this candidate. Judge semantic fit: equivalent experience phrased differently counts, transferable skills count, and penalise hard requirements the resume clearly lacks. "strengths" = candidate skills this job wants (max 6). "missing" = important job requirements the resume lacks (max 4). Return JSON: { "matches": [ { "id": string, "score": number, "strengths": string[], "missing": string[] } ] } — one entry per job, all ${shortlist.length} ids.`,
        2000
      );

      const byId = new Map(
        (ai.matches ?? [])
          .filter((m) => m && typeof m.id === "string")
          .map((m) => [
            m.id,
            {
              score: Math.max(0, Math.min(99, Math.round(Number(m.score) || 0))),
              strengths: (m.strengths ?? []).slice(0, 6).map(String),
              missing: (m.missing ?? []).slice(0, 4).map(String),
            },
          ])
      );

      if (byId.size > 0) {
        finalScored = shortlist.map((entry) => {
          const adjusted = byId.get(entry.job.id);
          return adjusted
            ? { ...entry, ...adjusted }
            : entry;
        });
        mode = "ai";
      }
    } catch (error) {
      console.warn("AI re-rank failed, using heuristic order:", error);
    }
  }

  return NextResponse.json({
    mode,
    analysis: {
      skills: resumeSkills,
      yearsExperience: resumeYears,
    },
    poolSize: candidates.length,
    matches: finalScored.slice(0, limit).map(({ job, score, strengths, missing }) => ({
      job: {
        id: job.id,
        source: job.source,
        title: job.title,
        company: job.company,
        companyLogo: job.companyLogo ?? null,
        applyUrl: job.applyUrl,
        location: job.location ?? "Remote",
        region: job.region ?? "Other",
        apac: job.apac ?? "worldwide",
        jobType: job.jobType ?? "other",
        category: job.category ?? "Other",
        tags: job.tags ?? [],
        level: job.level ?? "mid",
        salary: job.salary ?? null,
        descriptionHtml: job.descriptionHtml ?? "",
        publishedAt: (job.publishedAt ?? new Date()).toISOString(),
      },
      score,
      strengths,
      missing,
    })),
  });
}
