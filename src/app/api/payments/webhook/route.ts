import { NextRequest, NextResponse } from "next/server";
import { connectDB, isDbConfigured } from "@/lib/db";
import { PaymentModel } from "@/models/payment";
import { grantPremium, grantSearchCredit } from "@/lib/premium";
import { verifyWebhookSignature } from "@/lib/midtrans";

export const dynamic = "force-dynamic";

/**
 * Midtrans payment notification endpoint.
 *
 * Configure this URL in the Midtrans dashboard (Settings → Configuration →
 * Payment Notification URL): https://<your-domain>/api/payments/webhook
 *
 * Signature (sha512 of order_id+status_code+gross_amount+server_key) is
 * verified before anything is granted; the amount is also cross-checked
 * against the stored order.
 */
export async function POST(request: NextRequest) {
  let body: {
    order_id?: string;
    status_code?: string;
    gross_amount?: string;
    signature_key?: string;
    transaction_status?: string;
    fraud_status?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const orderId = String(body.order_id ?? "");
  if (!orderId || !isDbConfigured()) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  await connectDB();
  const payment = await PaymentModel.findOne({ orderId }).lean<{
    user: string;
    amount: number;
    type?: "premium" | "search";
    status: string;
  } | null>();
  if (!payment) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }

  const valid = verifyWebhookSignature({
    orderId,
    statusCode: String(body.status_code ?? ""),
    grossAmount: String(body.gross_amount ?? ""),
    signatureKey: String(body.signature_key ?? ""),
  });
  if (!valid) {
    console.warn(`Webhook signature mismatch for ${orderId}`);
    return NextResponse.json({ error: "invalid_signature" }, { status: 403 });
  }

  const amountOk =
    Math.round(Number(body.gross_amount ?? 0)) === Math.round(payment.amount);
  if (!amountOk) {
    console.warn(`Webhook amount mismatch for ${orderId}`);
    return NextResponse.json({ error: "amount_mismatch" }, { status: 400 });
  }

  const transactionStatus = String(body.transaction_status ?? "");
  const fraudStatus = String(body.fraud_status ?? "accept");

  if (
    (transactionStatus === "capture" && fraudStatus === "accept") ||
    transactionStatus === "settlement"
  ) {
    if (payment.status !== "paid") {
      if (payment.type === "search") {
        // Pay-per-use: grant one AI search credit.
        await grantSearchCredit(payment.user);
        await PaymentModel.updateOne(
          { orderId },
          { $set: { status: "paid", paidAt: new Date() } }
        );
      } else {
        const premiumUntil = await grantPremium(payment.user);
        await PaymentModel.updateOne(
          { orderId },
          { $set: { status: "paid", paidAt: new Date(), premiumUntil } }
        );
      }
    }
  } else if (["expire", "cancel", "deny"].includes(transactionStatus)) {
    await PaymentModel.updateOne(
      { orderId },
      { $set: { status: transactionStatus === "expire" ? "expired" : "failed" } }
    );
  }
  // "pending" (e.g. bank transfer awaiting payment) leaves the record as-is.

  return NextResponse.json({ ok: true });
}
