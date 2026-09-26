import { connectDB } from "./db";
import { UserModel } from "@/models/user";

const PREMIUM_DAYS = 30;

/** Emails that always get premium — for the site owner's own account. */
export function premiumBypassEmails(): string[] {
  return (process.env.PREMIUM_BYPASS_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export interface PremiumStatus {
  premium: boolean;
  plan: "free" | "premium";
  premiumUntil: string | null;
  bypass: boolean;
}

/**
 * Premium = a settled Midtrans payment not yet expired. Emails listed in
 * PREMIUM_BYPASS_EMAILS (e.g. the site owner) always pass.
 */
export async function getPremiumStatus(email: string): Promise<PremiumStatus> {
  if (premiumBypassEmails().includes(email.toLowerCase())) {
    return { premium: true, plan: "premium", premiumUntil: null, bypass: true };
  }
  if (!process.env.MONGODB_URI) {
    return { premium: false, plan: "free", premiumUntil: null, bypass: false };
  }

  await connectDB();
  const user = await UserModel.findOne({ email })
    .lean<{ plan?: string; premiumUntil?: Date | null } | null>();
  const until = user?.premiumUntil ?? null;
  const premium = Boolean(until && new Date(until).getTime() > Date.now());

  return {
    premium,
    plan: premium ? "premium" : "free",
    premiumUntil: until ? new Date(until).toISOString() : null,
    bypass: false,
  };
}

/** Extend premium by 30 days from now (or from the existing expiry). */
export async function grantPremium(
  email: string,
  days = PREMIUM_DAYS
): Promise<Date> {
  await connectDB();
  const user = await UserModel.findOne({ email }).lean<{
    premiumUntil?: Date | null;
  } | null>();
  const current = user?.premiumUntil ? new Date(user.premiumUntil) : null;
  const base = current && current.getTime() > Date.now() ? current : new Date();
  const premiumUntil = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

  await UserModel.updateOne(
    { email },
    { $set: { plan: "premium", premiumUntil } },
    { upsert: true }
  );
  return premiumUntil;
}

/** True when the AI call about to be made may charge the AI provider. */
export async function aiFeatureAllowed(email: string): Promise<boolean> {
  return getPremiumStatus(email).then((status) => status.premium);
}
