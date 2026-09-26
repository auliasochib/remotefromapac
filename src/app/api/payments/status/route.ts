import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPremiumStatus } from "@/lib/premium";
import { midtransConfigured, midtransPriceIdr } from "@/lib/midtrans";

export const dynamic = "force-dynamic";

/** The signed-in user's plan state, plus the price the paywall should show. */
export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const status = await getPremiumStatus(email);
  return NextResponse.json({
    ...status,
    priceIdr: midtransPriceIdr(),
    paymentEnabled: midtransConfigured(),
  });
}
