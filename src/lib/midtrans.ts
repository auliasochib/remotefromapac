import crypto from "node:crypto";

/**
 * Midtrans Snap integration.
 *
 * Configure in the Midtrans dashboard (sandbox: dashboard.sandbox.midtrans.com):
 *   MIDTRANS_SERVER_KEY  — kept server-side only, signs API calls + webhooks
 *   MIDTRANS_CLIENT_KEY  — public, used by snap.js in the browser
 *   MIDTRANS_IS_PRODUCTION — "true" for production, otherwise sandbox
 *   MIDTRANS_PRICE_IDR   — optional premium price override (default 99000)
 *
 * The payment prompt is Midtrans Snap: the client opens a popup via snap.js
 * using a token minted server-side; payment confirmation arrives at
 * POST /api/payments/webhook, whose signature is verified here.
 */

export function midtransConfigured(): boolean {
  return Boolean(
    process.env.MIDTRANS_SERVER_KEY && process.env.MIDTRANS_CLIENT_KEY
  );
}

export function midtransPriceIdr(): number {
  const parsed = Number(process.env.MIDTRANS_PRICE_IDR);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 99_000;
}

function isProduction(): boolean {
  return process.env.MIDTRANS_IS_PRODUCTION === "true";
}

function snapApiUrl(): string {
  return isProduction()
    ? "https://app.midtrans.com/snap/v1/transactions"
    : "https://app.sandbox.midtrans.com/snap/v1/transactions";
}

export function snapJsUrl(): string {
  return isProduction()
    ? "https://app.midtrans.com/snap/snap.js"
    : "https://app.sandbox.midtrans.com/snap/snap.js";
}

export interface SnapResult {
  token: string;
  redirectUrl?: string;
}

/** Mint a Snap transaction token for a one-time premium payment. */
export async function createSnapTransaction(input: {
  orderId: string;
  amountIdr: number;
  email: string;
  name?: string | null;
}): Promise<SnapResult> {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) throw new Error("MIDTRANS_SERVER_KEY is not configured");

  const auth = Buffer.from(`${serverKey}:`).toString("base64");
  const res = await fetch(snapApiUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      transaction_details: {
        order_id: input.orderId,
        gross_amount: input.amountIdr,
      },
      item_details: [
        {
          id: "premium-30d",
          name: "RemoteFromAPAC Premium (30 hari)",
          price: input.amountIdr,
          quantity: 1,
        },
      ],
      customer_details: {
        email: input.email,
        ...(input.name ? { first_name: input.name } : {}),
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Midtrans Snap error ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as { token: string; redirect_url?: string };
  if (!data.token) throw new Error("Midtrans Snap returned no token");
  return { token: data.token, redirectUrl: data.redirect_url };
}

/**
 * Verify the webhook signature: sha512(order_id + status_code + gross_amount
 * + server_key), compared timing-safe against the provided signature_key.
 */
export function verifyWebhookSignature(input: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  signatureKey: string;
}): boolean {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) return false;

  const expected = crypto
    .createHash("sha512")
    .update(`${input.orderId}${input.statusCode}${input.grossAmount}${serverKey}`)
    .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(input.signatureKey ?? "");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
