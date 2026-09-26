import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB, isDbConfigured } from "@/lib/db";
import { JobModel } from "@/models/job";
import { ResumeAnalysisModel } from "@/models/resume-analysis";
import { isAiConfigured, generateJson } from "@/lib/ai";
import { SKILL_COUNT } from "@/lib/skills";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface ChecklistItem {
  check: string;
  pass: boolean;
  detail: string;
}

interface ReviewResult {
  mode: "ai" | "heuristic";
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

  // Contact details — ATS and recruiters both look for these.
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

  // Standard sections ATS parsers expect.
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

  // Impact and action language.
  const actionVerbs = (text.match(
    /\b(led|built|designed|developed|launched|improved|reduced|increased|automated|migrated|scaled|shipped|owned)\b/gi
  ) ?? []).length;
  checklist.push({
    check: "Action verbs",
    pass: actionVerbs >= 5,
    detail: `${actionVerbs} achievement verbs found (aim for 8+).`,
  });

  const quantified = (text.match(/\b\d+(\.\d+)?\s?(%|percent|x\b)|\$\s?\d|\b\d+k\b/gi) ?? [])
    .length;
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

  const topSkills = skills.slice(0, 8);
  return {
    mode: "heuristic",
    summary: `Structural review of ${words} words. ${skills.length} skills detected out of the ${SKILL_COUNT} the matcher knows. This is a rule-based review — configure an AI provider key for a deeper, role-aware critique.`,
    checklist,
    missingKeywords: [],
    atsTips: [
      hasEmail
        ? "Keep the email as plain text (not inside an image or table cell)."
        : "Add a plain-text email — image-only headers break ATS parsing.",
      "Use standard section headings: Experience, Education, Skills.",
      "Export as text-based PDF (not scanned) — this file parsed fine." +
        (text.length < 200 ? "" : ""),
      "One column layout parses more reliably than multi-column templates.",
    ],
    skillSuggestions: topSkills.length
      ? [`Make sure these detected skills also appear in your Experience bullets: ${topSkills.join(", ")}.`]
      : ["Few skills were detected — name your stack explicitly (languages, frameworks, tools)."],
  };
}

interface AiReview {
  summary: string;
  checklist?: { check: string; pass: boolean; detail: string }[];
  missingKeywords?: string[];
  atsTips?: string[];
  skillSuggestions?: string[];
}

/** Deep review of the stored resume: rules first, AI for role-aware critique. */
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

  // Optional: a target role steers the AI critique.
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

  if (!isAiConfigured()) {
    return NextResponse.json({ review: base });
  }

  // AI pass: re-frame the critique against the target role and suggest
  // keywords pulled from what the local job market actually asks for.
  try {
    const recentTitles = await JobModel.find({
      apac: { $in: ["apac", "worldwide"] },
    })
      .sort({ publishedAt: -1 })
      .limit(40)
      .select("title tags -_id")
      .lean<{ title: string; tags?: string[] }[]>();

    const market = recentTitles
      .map((job) => `${job.title}${job.tags?.length ? ` [${job.tags.join(", ")}]` : ""}`)
      .join("\n");

    const ai = await generateJson<AiReview>(
      "You are a senior technical recruiter and ATS expert reviewing a resume.",
      `${targetRole ? `Target role: ${targetRole}\n` : ""}Recent remote jobs in this market (title [tags]):\n${market}\n\nResume:\n${analysis.textPreview.slice(0, 6000)}\n\nReturn JSON: { "summary": string (2-3 sentences), "checklist": [{ "check": string, "pass": boolean, "detail": string }] (cover resume structure, formatting, and ATS parsing risks), "missingKeywords": string[] (keywords from the market list the resume should include if truthful), "atsTips": string[], "skillSuggestions": string[] }.`,
      1400
    );

    const review: ReviewResult = {
      mode: "ai",
      summary: ai.summary || base.summary,
      checklist: [
        ...(ai.checklist ?? []).map((item) => ({
          check: String(item.check ?? "").slice(0, 80),
          pass: Boolean(item.pass),
          detail: String(item.detail ?? "").slice(0, 240),
        })),
        // Keep the deterministic checks the AI cannot see.
        ...base.checklist.slice(0, 2),
      ],
      missingKeywords: (ai.missingKeywords ?? []).slice(0, 10).map(String),
      atsTips: (ai.atsTips ?? base.atsTips).slice(0, 6).map(String),
      skillSuggestions: (ai.skillSuggestions ?? base.skillSuggestions).slice(0, 6).map(String),
    };
    return NextResponse.json({ review });
  } catch (error) {
    console.error("AI review failed, falling back to heuristic:", error);
    return NextResponse.json({
      review: {
        ...base,
        summary: `${base.summary} (AI review was unavailable: ${String(error).slice(0, 120)})`,
      },
    });
  }
}
