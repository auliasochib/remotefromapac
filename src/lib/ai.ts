/**
 * AI provider abstraction — no SDK, just fetch against the OpenAI-compatible
 * chat-completions API (OpenRouter, OpenAI) and Google's Gemini API.
 *
 * Configure exactly one of:
 *   OPENROUTER_API_KEY  → https://openrouter.ai (one key, many models)
 *   GEMINI_API_KEY      → https://aistudio.google.com/apikey (free tier)
 *   OPENAI_API_KEY      → platform.openai.com
 * Optional: AI_MODEL overrides the default model for the chosen provider.
 *
 * Everything in the app degrades gracefully when no key is present: the match
 * score and review run on structured heuristics, and the AI-only features
 * (cover letter) answer with a setup hint instead of an error page.
 */

export type AiProvider = "openrouter" | "gemini" | "openai";

export function aiProvider(): AiProvider | null {
  if (process.env.OPENROUTER_API_KEY) return "openrouter";
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return "gemini";
  }
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

export function isAiConfigured(): boolean {
  return aiProvider() !== null;
}

export function aiNotConfiguredMessage(): string {
  return "No AI provider is configured on the server. Add one of OPENROUTER_API_KEY, GEMINI_API_KEY or OPENAI_API_KEY to .env.local (or the Vercel project) and redeploy.";
}

const DEFAULT_MODELS: Record<AiProvider, string> = {
  openrouter: "openai/gpt-4o-mini",
  gemini: "gemini-2.0-flash",
  openai: "gpt-4o-mini",
};

function apiKey(provider: AiProvider): string | undefined {
  switch (provider) {
    case "openrouter":
      return process.env.OPENROUTER_API_KEY;
    case "gemini":
      return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    case "openai":
      return process.env.OPENAI_API_KEY;
  }
}

function model(provider: AiProvider): string {
  return process.env.AI_MODEL || DEFAULT_MODELS[provider];
}

async function callOpenAiCompatible(
  provider: "openrouter" | "openai",
  system: string,
  user: string,
  maxTokens: number
): Promise<string> {
  const endpoint =
    provider === "openrouter"
      ? "https://openrouter.ai/api/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions";

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey(provider)}`,
      // OpenRouter attribution, harmless elsewhere
      "HTTP-Referer": "https://remotefromapac.vercel.app",
      "X-Title": "RemoteFromAPAC",
    },
    body: JSON.stringify({
      model: model(provider),
      max_tokens: maxTokens,
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${provider} API error ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? "";
}

async function callGemini(
  system: string,
  user: string,
  maxTokens: number
): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model("gemini")}:generateContent?key=${apiKey("gemini")}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.4 },
      }),
      signal: AbortSignal.timeout(90_000),
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini API error ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

/** Single-shot completion. Throws when no provider is configured. */
export async function generateText(
  system: string,
  user: string,
  maxTokens = 1200
): Promise<string> {
  const provider = aiProvider();
  if (!provider) throw new Error(aiNotConfiguredMessage());

  if (provider === "gemini") return callGemini(system, user, maxTokens);
  return callOpenAiCompatible(provider, system, user, maxTokens);
}

/**
 * Completion constrained to JSON. Models occasionally wrap JSON in prose or
 * code fences despite instructions, so the first balanced object is extracted
 * and strictly parsed.
 */
export async function generateJson<T>(
  system: string,
  user: string,
  maxTokens = 1200
): Promise<T> {
  const raw = await generateText(
    `${system}\n\nRespond with valid JSON only — no markdown fences, no commentary.`,
    user,
    maxTokens
  );

  const start = raw.indexOf("{");
  if (start === -1) throw new Error("AI response contained no JSON object");

  // Walk the string tracking depth and strings to find the matching brace.
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return JSON.parse(raw.slice(start, i + 1)) as T;
      }
    }
  }
  throw new Error("AI response contained unbalanced JSON");
}
