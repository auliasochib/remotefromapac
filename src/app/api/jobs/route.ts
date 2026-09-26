import { NextRequest, NextResponse } from "next/server";
import { getJobs } from "@/lib/jobs";
import type { JobSort } from "@/lib/types";

export const dynamic = "force-dynamic";

const SORTS: JobSort[] = ["newest", "oldest", "company"];

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const sortParam = sp.get("sort") ?? "newest";
  const sort = SORTS.includes(sortParam as JobSort)
    ? (sortParam as JobSort)
    : "newest";

  try {
    const result = await getJobs({
      search: sp.get("q") ?? undefined,
      jobType: sp.get("type") ?? undefined,
      level: sp.get("level") ?? undefined,
      category: sp.get("category") ?? undefined,
      region: sp.get("region") ?? undefined,
      source: sp.get("source") ?? undefined,
      sort,
      // The database only stores roles located in the Asia-Pacific region;
      // mirror that on the live provider fallback so both paths agree.
      apacLocated: true,
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
