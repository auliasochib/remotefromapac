import mongoose, { models, Schema } from "mongoose";

const PaymentSchema = new Schema(
  {
    /** Our order id, e.g. "RFA-1727350000000-a1b2" */
    orderId: { type: String, required: true, unique: true, index: true },
    user: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "IDR" },
    /** "premium" = 30-day pass, "search" = single AI search credit. */
    type: {
      type: String,
      enum: ["premium", "search"],
      default: "premium",
    },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "expired"],
      default: "pending",
      index: true,
    },
    snapToken: String,
    paidAt: { type: Date, default: null },
    premiumUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

export const PaymentModel =
  models.Payment ?? mongoose.model("Payment", PaymentSchema, "payments");

export interface PaymentDoc {
  orderId: string;
  user: string;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "failed" | "expired";
  snapToken?: string;
  paidAt: Date | null;
  premiumUntil: Date | null;
}
