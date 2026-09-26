import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCredits, getPremiumStatus } from "@/lib/premium";
import {
  midtransConfigured,
  midtransPriceIdr,
  midtransSearchPriceIdr,
} from "@/lib/midtrans";

export const dynamic = "force-dynamic";

/** The signed-in user's plan state, plus the prices the paywall should show. */
export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const status = await getPremiumStatus(email);
  const credits = status.premium ? null : await getCredits(email);
  return NextResponse.json({
    ...status,
    credits,
    searchPriceIdr: midtransSearchPriceIdr(),
    priceIdr: midtransPriceIdr(),
    paymentEnabled: midtransConfigured(),
  });
}
