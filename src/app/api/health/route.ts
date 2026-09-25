import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB, isDbConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Lightweight readiness probe. Reports whether the app can reach MongoDB
 * without exposing connection details or credentials.
 */
export async function GET() {
  const database = await checkDatabase();
  const ok = database !== "error";

  return NextResponse.json(
    {
      status: ok ? "ok" : "degraded",
      database,
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  );
}

async function checkDatabase() {
  if (!isDbConfigured()) return "not-configured";

  try {
    await connectDB();
    await mongoose.connection.db?.admin().ping();
    return "connected";
  } catch (error) {
    console.error("Health check: database unreachable:", error);
    return "error";
  }
}
