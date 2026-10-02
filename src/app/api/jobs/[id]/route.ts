import { NextRequest, NextResponse } from "next/server";
import { getJobById } from "@/lib/jobs";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const job = await getJobById(id);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    return NextResponse.json(job);
  } catch (error) {
    console.error(`GET /api/jobs/${id} failed:`, error);
    return NextResponse.json(
      { error: "Failed to fetch job. Please try again." },
      { status: 502 }
    );
  }
}
