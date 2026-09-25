import mongoose, { models, Schema } from "mongoose";

const SavedJobSchema = new Schema(
  {
    user: { type: String, required: true, index: true },
    jobId: { type: String, required: true },
    title: { type: String, required: true },
    company: String,
    companyLogo: String,
    url: { type: String, required: true },
    location: String,
    jobType: String,
    category: String,
    region: String,
    source: String,
    savedAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: "savedAt", updatedAt: false } }
);

SavedJobSchema.index({ user: 1, jobId: 1 }, { unique: true });

export const SavedJob =
  models.SavedJob ?? mongoose.model("SavedJob", SavedJobSchema);

export interface SavedJobDoc {
  user: string;
  jobId: string;
  title: string;
  company?: string;
  companyLogo?: string;
  url: string;
  location?: string;
  jobType?: string;
  category?: string;
  region?: string;
  source?: string;
  savedAt: Date;
}
