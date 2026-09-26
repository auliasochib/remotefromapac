import mongoose, { models, Schema } from "mongoose";

/**
 * A saved alert: "tell me about new jobs matching these keywords".
 *
 * This is the subscription record Phase 5 delivery builds on. Delivery
 * channels (email via Resend, Telegram bot, WhatsApp, web push) each need a
 * provider credential — until one is configured the cron can compile the
 * matching jobs but not send them.
 */
const JobAlertSchema = new Schema(
  {
    user: { type: String, required: true, index: true },
    /** Space/comma separated keywords, matched against title/tags/category. */
    keywords: { type: String, required: true },
    frequency: {
      type: String,
      enum: ["instant", "daily", "weekly"],
      default: "daily",
    },
    /** Delivery targets enabled for this alert. */
    channels: {
      type: [String],
      enum: ["email", "telegram", "whatsapp", "push"],
      default: ["email"],
    },
    active: { type: Boolean, default: true },
    /** Jobs already included in a sent digest, to avoid repeats. */
    lastSentJobIds: { type: [String], default: [] },
    lastSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

JobAlertSchema.index({ user: 1, keywords: 1 }, { unique: true });

export const JobAlertModel =
  models.JobAlert ?? mongoose.model("JobAlert", JobAlertSchema, "subscriptions");

export interface JobAlertDoc {
  user: string;
  keywords: string;
  frequency: "instant" | "daily" | "weekly";
  channels: string[];
  active: boolean;
  lastSentJobIds: string[];
  lastSentAt: Date | null;
  _id: unknown;
}
