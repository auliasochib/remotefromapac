import { NextRequest, NextResponse } from "next/server";
import { getJobs } from "@/lib/jobs";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  try {
    const result = await getJobs({
      search: sp.get("q") ?? undefined,
      jobType: sp.get("type") ?? undefined,
      level: sp.get("level") ?? undefined,
      category: sp.get("category") ?? undefined,
      region: sp.get("region") ?? undefined,
      page: Number(sp.get("page") ?? "1") || 1,
      pageSize: Number(sp.get("pageSize") ?? "20") || 20,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/jobs failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch jobs. Please try again." },
      { status: 502 }
    );
  }
}
