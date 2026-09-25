import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB, isDbConfigured } from "@/lib/db";
import { SavedJob } from "@/models/saved-job";

export const dynamic = "force-dynamic";

async function currentUser(): Promise<string | null> {
  const session = await auth();
  return session?.user?.email ?? session?.user?.id ?? null;
}

export async function GET() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "db_not_configured", message: "Set MONGODB_URI in .env.local to enable saved jobs." },
      { status: 503 }
    );
  }

  try {
    await connectDB();
    const jobs = await SavedJob.find({ user }).sort({ savedAt: -1 }).lean();
    return NextResponse.json({ jobs });
  } catch (error) {
    console.error("GET /api/saved-jobs failed:", error);
    return NextResponse.json(
      { error: "Failed to load saved jobs." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "db_not_configured", message: "Set MONGODB_URI in .env.local to enable saved jobs." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    if (!body?.jobId || !body?.title || !body?.url) {
      return NextResponse.json(
        { error: "jobId, title and url are required" },
        { status: 400 }
      );
    }

    await connectDB();
    await SavedJob.updateOne(
      { user, jobId: body.jobId },
      {
        $set: {
          user,
          jobId: body.jobId,
          title: body.title,
          company: body.company ?? "",
          companyLogo: body.companyLogo ?? "",
          url: body.url,
          location: body.location ?? "",
          jobType: body.jobType ?? "",
          category: body.category ?? "",
          region: body.region ?? "",
          source: body.source ?? "",
        },
      },
      { upsert: true }
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/saved-jobs failed:", error);
    return NextResponse.json(
      { error: "Failed to save job." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "db_not_configured", message: "Set MONGODB_URI in .env.local to enable saved jobs." },
      { status: 503 }
    );
  }

  const jobId = request.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  try {
    await connectDB();
    await SavedJob.deleteOne({ user, jobId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/saved-jobs failed:", error);
    return NextResponse.json(
      { error: "Failed to remove saved job." },
      { status: 500 }
    );
  }
}
