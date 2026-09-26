import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB, isDbConfigured } from "@/lib/db";
import { JobAlertModel } from "@/models/job-alert";

export const dynamic = "force-dynamic";

/** List the signed-in user's job alerts. */
export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isDbConfigured()) {
    return NextResponse.json({ alerts: [] });
  }

  await connectDB();
  const alerts = await JobAlertModel.find({ user: email })
    .sort({ createdAt: -1 })
    .lean<{
      _id: unknown;
      keywords: string;
      frequency: string;
      channels: string[];
      active: boolean;
    }[]>();

  return NextResponse.json({
    alerts: alerts.map((a) => ({
      id: String(a._id),
      keywords: a.keywords,
      frequency: a.frequency,
      channels: a.channels,
      active: a.active,
    })),
  });
}

/** Create or update an alert for a keyword set. */
export async function POST(request: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "db_not_configured", message: "Set MONGODB_URI to store alerts." },
      { status: 503 }
    );
  }

  let keywords = "";
  let frequency = "daily";
  try {
    const body = await request.json();
    keywords = String(body?.keywords ?? "").trim().slice(0, 200);
    if (["instant", "daily", "weekly"].includes(body?.frequency)) {
      frequency = body.frequency;
    }
  } catch {
    // handled below
  }
  if (!keywords) {
    return NextResponse.json(
      { error: "bad_request", message: "keywords is required." },
      { status: 400 }
    );
  }

  await connectDB();
  const alert = await JobAlertModel.findOneAndUpdate(
    { user: email, keywords },
    { $set: { user: email, keywords, frequency, active: true } },
    { upsert: true, new: true }
  ).lean<{ _id: unknown; keywords: string; frequency: string; active: boolean }>();

  return NextResponse.json({
    ok: true,
    alert: {
      id: String(alert?._id),
      keywords: alert?.keywords,
      frequency: alert?.frequency,
      active: alert?.active,
    },
  });
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "db_not_configured" }, { status: 503 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  await connectDB();
  await JobAlertModel.deleteOne({ user: email, _id: id });
  return NextResponse.json({ ok: true });
}
