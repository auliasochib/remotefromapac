import mongoose, { models, Schema } from "mongoose";
import type {
  ApacEligibility,
  JobLevel,
  JobRegion,
  JobSource,
  JobType,
} from "@/lib/types";

const JobSchema = new Schema(
  {
    /** `<source>-<externalId>` — primary key for upserts */
    id: { type: String, required: true, unique: true },
    source: { type: String, required: true, index: true },
    title: { type: String, required: true },
    company: { type: String, required: true },
    companyLogo: { type: String, default: null },
    applyUrl: { type: String, required: true },
    location: { type: String, default: "" },
    region: { type: String, index: true },
    apac: { type: String, index: true },
    jobType: { type: String, index: true },
    category: { type: String, index: true },
    tags: { type: [String], default: [], index: true },
    level: { type: String, index: true },
    salary: { type: String, default: null },
    descriptionHtml: { type: String, default: "" },
    publishedAt: { type: Date, index: true },
    /** When the sync last saw this posting — used to prune stale listings. */
    syncedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

// Keyword search runs through a case-insensitive regex over title, company,
// category, tags and description (see buildDbFilter in lib/jobs.ts). A regex is
// used deliberately so partial words match — searching "front" finds
// "frontend" — which a $text index cannot do. Revisit if the collection grows
// enough that a collection scan stops being fast.

export const JobModel =
  models.Job ?? mongoose.model("Job", JobSchema, "jobs");

export interface JobDoc {
  id: string;
  source: JobSource;
  title: string;
  company: string;
  companyLogo?: string | null;
  applyUrl: string;
  location?: string;
  region?: JobRegion;
  apac?: ApacEligibility;
  jobType?: JobType;
  category?: string;
  tags?: string[];
  level?: JobLevel;
  salary?: string | null;
  descriptionHtml?: string;
  publishedAt: Date;
  syncedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
