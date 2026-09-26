import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB, isDbConfigured } from "@/lib/db";
import { ensureUser } from "@/models/user";
import { PaymentModel } from "@/models/payment";
import { getPremiumStatus } from "@/lib/premium";
import {
  createSnapTransaction,
  midtransConfigured,
  midtransPriceIdr,
} from "@/lib/midtrans";

export const dynamic = "force-dynamic";

/** Mint a Midtrans Snap token for the signed-in free user. */
export async function POST() {
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

  await connectDB();
  const status = await getPremiumStatus(email);
  if (status.premium) {
    return NextResponse.json(
      { error: "already_premium", message: "You are already premium." },
      { status: 400 }
    );
  }

  // Registers the account on first payment attempt.
  await ensureUser({
    email,
    name: session.user?.name ?? null,
    image: session.user?.image ?? null,
  });

  const amount = midtransPriceIdr();
  const orderId = `RFA-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  try {
    const snap = await createSnapTransaction({
      orderId,
      amountIdr: amount,
      email,
      name: session.user?.name ?? null,
    });

    await PaymentModel.create({
      orderId,
      user: email,
      amount,
      status: "pending",
      snapToken: snap.token,
    });

    return NextResponse.json({
      ok: true,
      orderId,
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
