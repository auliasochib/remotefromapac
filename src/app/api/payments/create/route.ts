import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB, isDbConfigured } from "@/lib/db";
import { ensureUser } from "@/models/user";
import { PaymentModel } from "@/models/payment";
import { getPremiumStatus, getCredits } from "@/lib/premium";
import {
  createSnapTransaction,
  midtransConfigured,
  midtransPriceIdr,
  midtransSearchPriceIdr,
} from "@/lib/midtrans";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Mint a Midtrans Snap token.
 * Body: { plan: "search" | "premium" } — "search" buys one AI search credit
 * (pay-per-use), "premium" buys 30 days of unlimited AI features.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const limit = checkRateLimit(`payments-create:${email}`, 10, 60 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "db_not_configured", message: "Set MONGODB_URI first." },
      { status: 503 }
    );
  }
  if (!midtransConfigured()) {
    return NextResponse.json(
      {
        error: "not_configured",
        message:
          "Payment is not configured on the server. Add MIDTRANS_SERVER_KEY and MIDTRANS_CLIENT_KEY (see README).",
      },
      { status: 503 }
    );
  }

  let plan: "search" | "premium" = "premium";
  try {
    const body = await request.json();
    if (body?.plan === "search") plan = "search";
  } catch {
    // default premium
  }

  await connectDB();
  const [status, credits] = await Promise.all([
    getPremiumStatus(email),
    plan === "search" ? getCredits(email) : Promise.resolve(0),
  ]);
  if (status.premium) {
    return NextResponse.json(
      { error: "already_premium", message: "You are already premium." },
      { status: 400 }
    );
  }
  if (plan === "search" && credits >= 1) {
    return NextResponse.json(
      {
        error: "credit_available",
        message: "You already have an unused search credit.",
      },
      { status: 400 }
    );
  }

  // Registers the account on first payment attempt.
  await ensureUser({
    email,
    name: session.user?.name ?? null,
    image: session.user?.image ?? null,
  });

  const amount = plan === "search" ? midtransSearchPriceIdr() : midtransPriceIdr();
  const orderId = `RFA-${plan === "search" ? "S" : "P"}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
  const itemName =
    plan === "search"
      ? "RemoteFromAPAC — 1x AI job search"
      : "RemoteFromAPAC Premium (30 hari)";

  try {
    const snap = await createSnapTransaction({
      orderId,
      amountIdr: amount,
      email,
      name: session.user?.name ?? null,
      itemName,
    });

    await PaymentModel.create({
      orderId,
      user: email,
      amount,
      type: plan,
      status: "pending",
      snapToken: snap.token,
    });

    return NextResponse.json({
      ok: true,
      orderId,
      plan,
      amount,
      token: snap.token,
      redirectUrl: snap.redirectUrl ?? null,
      clientKey: process.env.MIDTRANS_CLIENT_KEY ?? "",
      snapJsUrl:
        process.env.MIDTRANS_IS_PRODUCTION === "true"
          ? "https://app.midtrans.com/snap/snap.js"
          : "https://app.sandbox.midtrans.com/snap/snap.js",
    });
  } catch (error) {
    console.error("Snap transaction failed:", error);
    return NextResponse.json(
      { error: "snap_error", message: String(error).slice(0, 300) },
      { status: 502 }
    );
  }
}
