import { NextRequest, NextResponse } from "next/server";
import { syncJobs } from "@/lib/sync";
import { isDbConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";
/** A full sync fetches every source; allow generous time on serverless. */
export const maxDuration = 300;

/** Secrets that may authorize a sync — SYNC_SECRET for manual runs, and
 * CRON_SECRET, which Vercel automatically sends with scheduled invocations. */
function configuredSecrets(): string[] {
  return [process.env.SYNC_SECRET, process.env.CRON_SECRET].filter(
    (value): value is string => Boolean(value)
  );
}

function isAuthorized(request: NextRequest): boolean {
  const secrets = configuredSecrets();
  if (secrets.length === 0) return false;

  const header = request.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const queryToken = request.nextUrl.searchParams.get("token") ?? "";

  return secrets.some((secret) => bearer === secret || queryToken === secret);
}

/**
 * Refresh the job database from every configured source.
 *
 * Protected by `SYNC_SECRET` (manual) or `CRON_SECRET` (Vercel Cron sends it
 * automatically), so a scheduler can call it without it being public.
 */
export async function POST(request: NextRequest) {
  if (configuredSecrets().length === 0) {
    return NextResponse.json(
      { error: "SYNC_SECRET is not configured on the server." },
      { status: 503 }
    );
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "db_not_configured", message: "Set MONGODB_URI to sync jobs." },
      { status: 503 }
    );
  }

  try {
    const result = await syncJobs();
    console.log("Job sync completed:", JSON.stringify(result));
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Job sync failed:", error);
    return NextResponse.json(
      { error: "Sync failed", message: String(error) },
      { status: 500 }
    );
  }
}

/** Vercel Cron issues GET requests. */
export async function GET(request: NextRequest) {
  return POST(request);
}
