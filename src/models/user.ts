import mongoose, { models, Schema } from "mongoose";

/**
 * Minimal user profile. Identity itself lives in Auth.js sessions; this
 * collection holds application-level state (plan, preferences) keyed by the
 * session email.
 */
const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    name: String,
    image: String,
    /** Monetization hook: "free" | "premium". Not enforced during beta. */
    plan: { type: String, default: "free", index: true },
    /** Set by the Midtrans webhook when a premium payment settles. */
    premiumUntil: { type: Date, default: null, index: true },
    /** Pay-per-use balance: 1 credit = 1 AI-ranked search. */
    credits: { type: Number, default: 0 },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const UserModel = models.User ?? mongoose.model("User", UserSchema, "users");

/** Upsert the profile on first use and refresh lastSeenAt. */
export async function ensureUser(input: {
  email: string;
  name?: string | null;
  image?: string | null;
}) {
  return UserModel.findOneAndUpdate(
    { email: input.email },
    {
      $set: { email: input.email },
      $setOnInsert: {
        name: input.name ?? null,
        image: input.image ?? null,
        plan: "free",
      },
      $currentDate: { lastSeenAt: true },
    },
    { upsert: true, new: true }
  ).lean<{ email: string; plan: string }>();
}
