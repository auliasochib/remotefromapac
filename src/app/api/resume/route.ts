import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB, isDbConfigured } from "@/lib/db";
import { ResumeAnalysisModel } from "@/models/resume-analysis";

export const dynamic = "force-dynamic";

/** The signed-in user's current resume analysis (skills, experience, meta). */
export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isDbConfigured()) {
    return NextResponse.json({ analysis: null });
  }

  await connectDB();
  const analysis = await ResumeAnalysisModel.findOne({ user: email }).lean<{
    fileName: string;
    skills: string[];
    yearsExperience: number | null;
    textChars: number;
    updatedAt: Date;
  } | null>();

  return NextResponse.json({
    analysis: analysis
      ? {
          fileName: analysis.fileName,
          skills: analysis.skills,
          yearsExperience: analysis.yearsExperience,
          textChars: analysis.textChars,
          updatedAt: analysis.updatedAt,
        }
      : null,
  });
}

/** Remove the stored resume analysis. */
export async function DELETE() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "db_not_configured" }, { status: 503 });
  }

  await connectDB();
  await ResumeAnalysisModel.deleteOne({ user: email });
  return NextResponse.json({ ok: true });
}
