import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB, isDbConfigured } from "@/lib/db";
import { JobModel } from "@/models/job";
import { ResumeAnalysisModel } from "@/models/resume-analysis";
import { isAiConfigured, generateJson } from "@/lib/ai";
import { SKILL_COUNT } from "@/lib/skills";
import { getPremiumStatus } from "@/lib/premium";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface ChecklistItem {
  check: string;
  pass: boolean;
  detail: string;
}

interface ReviewSection {
  name: string;
  verdict: "strong" | "ok" | "weak";
  feedback: string;
}

interface ReviewResult {
  mode: "ai" | "heuristic";
  /** 0-100 recruiter-grade score. Present in both modes. */
  overallScore?: number;
  grade?: "Strong" | "Competitive" | "Needs work";
  executiveSummary?: string;
  sections?: ReviewSection[];
  topStrengths?: string[];
  criticalIssues?: { issue: string; why: string; fix: string }[];
  summary: string;
  checklist: ChecklistItem[];
  missingKeywords: string[];
  atsTips: string[];
  skillSuggestions: string[];
}

function heuristicReview(
  text: string,
  skills: string[],
  years: number | null
): ReviewResult {
  const words = text.split(/\s+/).filter(Boolean).length;
  const checklist: ChecklistItem[] = [];

  const hasEmail = /[\w.+-]+@[\w-]+\.[\w.]+/.test(text);
  checklist.push({
    check: "Contact email",
    pass: hasEmail,
    detail: hasEmail
      ? "An email address was found."
      : "No email address detected — put one near the top of the resume.",
  });
  const hasPhone = /(\+\d{1,3}[ -]?)?\(?\d{3}\)?[ -]?\d{3}[ -]?\d{4}/.test(text);
  const hasLinkedIn = /linkedin\.com\/[a-z]/i.test(text);
  checklist.push({
    check: "Phone or LinkedIn",
    pass: hasPhone || hasLinkedIn,
    detail:
      hasPhone || hasLinkedIn
        ? "Secondary contact details found."
        : "Add a phone number and/or LinkedIn URL.",
  });

  const sections: [string, RegExp][] = [
    ["Experience", /experience|employment|work history/i],
    ["Education", /education|degree|b\.?sc|bachelor|university|bootcamp/i],
    ["Skills", /skills|technologies|tech stack|competencies/i],
  ];
  for (const [name, re] of sections) {
    const present = re.test(text);
    checklist.push({
      check: `${name} section`,
      pass: present,
      detail: present
        ? `A ${name.toLowerCase()} section was detected.`
        : `No clear ${name.toLowerCase()} heading — ATS parsers score structured resumes higher.`,
    });
  }

  const actionVerbs = (
    text.match(
      /\b(led|built|designed|developed|launched|improved|reduced|increased|automated|migrated|scaled|shipped|owned)\b/gi
    ) ?? []
  ).length;
  checklist.push({
    check: "Action verbs",
    pass: actionVerbs >= 5,
    detail: `${actionVerbs} achievement verbs found (aim for 8+).`,
  });

  const quantified = (
    text.match(/\b\d+(\.\d+)?\s?(%|percent|x\b)|\$\s?\d|\b\d+k\b/gi) ?? []
  ).length;
  checklist.push({
    check: "Quantified achievements",
    pass: quantified >= 3,
    detail:
      quantified >= 3
        ? `${quantified} numeric results found.`
        : `Only ${quantified} numeric results — add metrics (%, $, users, latency).`,
  });

  checklist.push({
    check: "Length",
    pass: words >= 200 && words <= 1200,
    detail: `${words} words (sweet spot: 400–800 for most roles).`,
  });

  checklist.push({
    check: "Experience stated",
    pass: years !== null,
    detail:
      years !== null
        ? `About ${years} year(s) of experience detected.`
        : 'State total experience explicitly, e.g. "7 years of experience".',
  });

  const passed = checklist.filter((item) => item.pass).length;
  const overallScore = Math.round((passed / checklist.length) * 100);
  const grade =
    overallScore >= 80 ? "Strong" : overallScore >= 60 ? "Competitive" : "Needs work";

  const topSkills = skills.slice(0, 8);
  return {
    mode: "heuristic",
    overallScore,
    grade,
    summary: `Rule-based review of ${words} words: ${passed}/${checklist.length} structural checks passed. ${skills.length} of the ${SKILL_COUNT} skills the matcher knows were detected.`,
    checklist,
    missingKeywords: [],
    atsTips: [
      hasEmail
        ? "Keep the email as plain text (not inside an image or table cell)."
        : "Add a plain-text email — image-only headers break ATS parsing.",
      "Use standard section headings: Experience, Education, Skills.",
      "One column layout parses more reliably than multi-column templates.",
      "Export as text-based PDF (not scanned) — this file parsed correctly.",
    ],
    skillSuggestions: topSkills.length
      ? [
          `Make sure these detected skills also appear in your Experience bullets: ${topSkills.join(", ")}.`,
        ]
      : [
          "Few skills were detected — name your stack explicitly (languages, frameworks, tools).",
        ],
  };
}

interface AiReview {
  overallScore?: number;
  grade?: string;
  executiveSummary?: string;
  sections?: { name?: string; verdict?: string; feedback?: string }[];
  topStrengths?: string[];
  criticalIssues?: { issue?: string; why?: string; fix?: string }[];
  atsTips?: string[];
  keywordGaps?: string[];
  skillSuggestions?: string[];
}

/** Deep review of the stored resume: rules first, AI for the professional pass. */
export async function POST(request: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "db_not_configured", message: "Set MONGODB_URI first." },
      { status: 503 }
    );
  }

  // Optional: a target role steers the critique and the market benchmark.
  let targetRole = "";
  try {
    const body = await request.json();
    targetRole = String(body?.targetRole ?? "").slice(0, 120);
  } catch {
    // no body — fine
  }

  await connectDB();
  const analysis = await ResumeAnalysisModel.findOne({ user: email }).lean<{
    textPreview: string;
    skills: string[];
    yearsExperience: number | null;
  } | null>();

  if (!analysis) {
    return NextResponse.json(
      { error: "no_resume", message: "Upload a resume first." },
      { status: 409 }
    );
  }

  const base = heuristicReview(
    analysis.textPreview,
    analysis.skills,
    analysis.yearsExperience
  );

  const { premium } = await getPremiumStatus(email);
  // The AI critique is premium; free users get the rule-based review plus
  // aiGated so the UI can show the upgrade prompt.
  const aiGated = !premium;
  if (!isAiConfigured() || !premium) {
    return NextResponse.json({ review: base, aiGated });
  }

  // Benchmark against real market demand: prefer jobs matching the target
  // role, otherwise the most recent postings.
  const marketFilter = targetRole
    ? { title: new RegExp(escapeRegex(targetRole), "i") }
    : {};
  const benchmarkJobs = await JobModel.find({
    apac: { $in: ["apac"] },
    ...marketFilter,
  })
    .sort({ publishedAt: -1 })
    .limit(40)
    .select("title tags -_id")
    .lean<{ title: string; tags?: string[] }[]>();

  const market = (
    benchmarkJobs.length
      ? benchmarkJobs
      : await JobModel.find({ apac: { $in: ["apac"] } })
          .sort({ publishedAt: -1 })
          .limit(40)
          .select("title tags -_id")
          .lean<{ title: string; tags?: string[] }[]>()
  )
    .map((job) => `${job.title}${job.tags?.length ? ` [${job.tags.join(", ")}]` : ""}`)
    .join("\n");

  try {
    const ai = await generateJson<AiReview>(
      "You are a principal technical recruiter and ATS specialist with 15 years of experience placing remote candidates across the Asia-Pacific region at global companies. You give precise, direct, evidence-based feedback — every point must reference something concrete in the resume or the market data. Never generic advice, never flattery.",
      `${targetRole ? `Target role: ${targetRole}\n\n` : ""}Live market snapshot — recent APAC job postings (title [tags]):\n${market}\n\nCandidate signals: ~${analysis.yearsExperience ?? "?"} years experience; detected skills: ${analysis.skills.join(", ") || "none"}.\n\nResume:\n${analysis.textPreview.slice(0, 6000)}\n\nProduce a recruiter-grade review as JSON:\n{\n  "overallScore": 0-100 (how competitive this resume is for the target role in this market),\n  "grade": "Strong" | "Competitive" | "Needs work",\n  "executiveSummary": "2-3 sentences positioning the candidate against the market",\n  "sections": [\n    { "name": "Structure & formatting", "verdict": "strong|ok|weak", "feedback": "1-2 sentences, specific" },\n    { "name": "Impact & achievements", "verdict": "...", "feedback": "..." },\n    { "name": "ATS compatibility", "verdict": "...", "feedback": "..." },\n    { "name": "Keyword alignment vs market", "verdict": "...", "feedback": "..." },\n    { "name": "Remote-readiness (APAC)", "verdict": "...", "feedback": "..." }\n  ],\n  "topStrengths": ["3-5 concrete strengths"],\n  "criticalIssues": [ { "issue": "...", "why": "why it matters to a recruiter", "fix": "the exact change to make" } ] (max 4, prioritized),\n  "atsTips": ["max 5, specific"],\n  "keywordGaps": ["market keywords missing from the resume, max 8"],\n  "skillSuggestions": ["max 5"]\n}`,
      2400
    );

    const verdictAllowed = new Set(["strong", "ok", "weak"]);
    const review: ReviewResult = {
      mode: "ai",
      overallScore:
        typeof ai.overallScore === "number"
          ? Math.max(0, Math.min(100, Math.round(ai.overallScore)))
          : base.overallScore,
      grade:
        ai.grade === "Strong" || ai.grade === "Competitive" || ai.grade === "Needs work"
          ? ai.grade
          : base.grade,
      executiveSummary: String(ai.executiveSummary ?? "").slice(0, 600) || base.summary,
      summary: base.summary,
      sections: (ai.sections ?? [])
        .filter((section) => section?.name && section?.feedback)
        .slice(0, 6)
        .map((section) => ({
          name: String(section.name).slice(0, 60),
          verdict: (verdictAllowed.has(String(section.verdict).toLowerCase())
            ? String(section.verdict).toLowerCase()
            : "ok") as ReviewSection["verdict"],
          feedback: String(section.feedback).slice(0, 400),
        })),
      topStrengths: (ai.topStrengths ?? []).slice(0, 5).map(String),
      criticalIssues: (ai.criticalIssues ?? [])
        .filter((issue) => issue?.issue)
        .slice(0, 4)
        .map((issue) => ({
          issue: String(issue.issue).slice(0, 200),
          why: String(issue.why ?? "").slice(0, 240),
          fix: String(issue.fix ?? "").slice(0, 240),
        })),
      checklist: [],
      missingKeywords: (ai.keywordGaps ?? []).slice(0, 8).map(String),
      atsTips: (ai.atsTips ?? []).slice(0, 5).map(String),
      skillSuggestions: (ai.skillSuggestions ?? []).slice(0, 5).map(String),
    };
    return NextResponse.json({ review, aiGated: false });
  } catch (error) {
    console.error("AI review failed, falling back to heuristic:", error);
    return NextResponse.json({
      review: {
        ...base,
        summary: `${base.summary} (AI review was unavailable: ${String(error).slice(0, 120)})`,
      },
      aiGated: false,
    });
  }
}
