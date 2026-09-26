import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB, isDbConfigured } from "@/lib/db";
import { JobModel } from "@/models/job";
import { ResumeAnalysisModel } from "@/models/resume-analysis";
import { scoreJobMatch } from "@/lib/skills";

export const dynamic = "force-dynamic";

const CANDIDATE_POOL = 300;

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
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return NextResponse.json({
    analysis: {
      skills: resumeSkills,
      yearsExperience: resumeYears,
      fileName: undefined,
    },
    poolSize: candidates.length,
    matches: scored.map(({ job, score, strengths, missing }) => ({
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
