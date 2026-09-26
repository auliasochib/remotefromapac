import mongoose, { models, Schema } from "mongoose";

/**
 * The user's current resume: extracted text and derived signals.
 *
 * One analysis per user (re-upload replaces it). The raw file is never stored
 * — only the extracted text, truncated, which is what matching, review and
 * cover-letter generation read.
 */
const ResumeAnalysisSchema = new Schema(
  {
    user: { type: String, required: true, unique: true, index: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    textChars: { type: Number, required: true },
    /** Extracted text, capped — enough context for AI features. */
    textPreview: { type: String, required: true },
    skills: { type: [String], default: [] },
    yearsExperience: { type: Number, default: null },
    /** How the skills were derived, for transparency in the UI. */
    engine: { type: String, default: "heuristic" },
  },
  { timestamps: true }
);

export const ResumeAnalysisModel =
  models.ResumeAnalysis ??
  mongoose.model("ResumeAnalysis", ResumeAnalysisSchema, "resumeAnalyses");

export interface ResumeAnalysisDoc {
  user: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  textChars: number;
  textPreview: string;
  skills: string[];
  yearsExperience: number | null;
  engine: string;
  createdAt: Date;
  updatedAt: Date;
}
