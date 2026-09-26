import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB, isDbConfigured } from "@/lib/db";
import { ensureUser } from "@/models/user";
import { ResumeAnalysisModel } from "@/models/resume-analysis";
import { extractSkills, extractYearsExperience } from "@/lib/skills";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const EXTRACT_TEXT_CAP = 20_000;
const STORE_TEXT_CAP = 8_000;

async function pdfToText(buffer: ArrayBuffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}

/**
 * Upload (or replace) the signed-in user's resume.
 *
 * Accepts PDF and plain-text/Markdown files up to 2 MB. The file itself is
 * never stored — only extracted text (capped) plus the derived skill list.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Uploads cost parsing time and storage — a few per hour is plenty.
  const limit = checkRateLimit(`upload:${email}`, 10, 60 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }
  if (!isDbConfigured()) {
    return NextResponse.json(
      {
        error: "db_not_configured",
        message: "Set MONGODB_URI to store resume analyses.",
      },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "bad_request", message: "Expected a multipart form upload." },
      { status: 400 }
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "bad_request", message: "Attach a file under the 'file' field." },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "too_large", message: "Resume must be 2 MB or smaller." },
      { status: 413 }
    );
  }

  const name = file.name || "resume";
  const isPdf =
    file.type === "application/pdf" || name.toLowerCase().endsWith(".pdf");
  const isText =
    file.type.startsWith("text/") ||
    /\.(txt|md|markdown)$/i.test(name) ||
    file.type === "application/octet-stream";

  if (!isPdf && !isText) {
    return NextResponse.json(
      {
        error: "unsupported_type",
        message: "Unsupported file. Upload a PDF or a plain-text/Markdown resume.",
      },
      { status: 415 }
    );
  }

  const buffer = await file.arrayBuffer();

  let text = "";
  try {
    text = isPdf ? await pdfToText(buffer) : new TextDecoder().decode(buffer);
  } catch (error) {
    console.error("Resume extraction failed:", error);
    return NextResponse.json(
      {
        error: "extraction_failed",
        message:
          "Could not read text from that file. If it is a scanned PDF, export a text-based PDF or upload a .txt version.",
      },
      { status: 422 }
    );
  }

  text = text.replace(/\u0000/g, "").trim().slice(0, EXTRACT_TEXT_CAP);
  if (text.length < 80) {
    return NextResponse.json(
      {
        error: "no_text",
        message:
          "Almost no text was found in that file — it may be an image-only PDF. Upload a text-based resume.",
      },
      { status: 422 }
    );
  }

  const skills = extractSkills(text);
  const yearsExperience = extractYearsExperience(text);

  try {
    await connectDB();
    await ensureUser({
      email,
      name: session.user?.name ?? null,
      image: session.user?.image ?? null,
    });

    const analysis = await ResumeAnalysisModel.findOneAndUpdate(
      { user: email },
      {
        $set: {
          user: email,
          fileName: name,
          mimeType: file.type || (isPdf ? "application/pdf" : "text/plain"),
          sizeBytes: file.size,
          textChars: text.length,
          textPreview: text.slice(0, STORE_TEXT_CAP),
          skills,
          yearsExperience,
          engine: "heuristic",
        },
      },
      { upsert: true, new: true }
    ).lean<{
      fileName: string;
      skills: string[];
      yearsExperience: number | null;
      textChars: number;
      updatedAt: Date;
    }>();

    return NextResponse.json({
      ok: true,
      analysis: {
        fileName: analysis?.fileName,
        skills: analysis?.skills ?? skills,
        yearsExperience: analysis?.yearsExperience ?? yearsExperience,
        textChars: analysis?.textChars ?? text.length,
        updatedAt: analysis?.updatedAt,
      },
    });
  } catch (error) {
    console.error("Resume upload failed:", error);
    return NextResponse.json(
      { error: "server_error", message: "Could not save the resume analysis." },
      { status: 500 }
    );
  }
}
