import { NextRequest } from "next/server";
import { callJson } from "@/lib/llm";
import { MODELS } from "@/lib/models";
import { buildSourceSuggestionsPrompt, SOURCE_SUGGESTIONS_SYSTEM } from "@/lib/prompts";
import { SuggestRequest, SuggestedSourcesOutput } from "@/lib/schemas";

const MAX_REQUEST_BYTES = 32 * 1024;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 8;
type RateLimitState = { timestamps: number[] };
const globalRateLimit = globalThis as typeof globalThis & { pramanaSuggestionRateLimit?: Map<string, RateLimitState> };
const rateLimit = globalRateLimit.pramanaSuggestionRateLimit ??= new Map<string, RateLimitState>();

function isRateLimited(request: NextRequest) {
  const forwarded = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ?? "local";
  const now = Date.now();
  const current = rateLimit.get(forwarded) ?? { timestamps: [] };
  current.timestamps = current.timestamps.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
  if (current.timestamps.length >= RATE_LIMIT_MAX) {
    rateLimit.set(forwarded, current);
    return true;
  }
  current.timestamps.push(now);
  rateLimit.set(forwarded, current);
  return false;
}

export async function POST(request: NextRequest) {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return Response.json({ error: "Send the suggestion request as JSON." }, { status: 415 });
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_REQUEST_BYTES) {
    return Response.json({ error: "The suggestion request is too large." }, { status: 413 });
  }
  if (isRateLimited(request)) {
    return Response.json({ error: "Too many suggestion requests. Wait a minute and try again." }, { status: 429 });
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "The request body must be valid JSON." }, { status: 400 }); }
  const parsed = SuggestRequest.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "The request is invalid." }, { status: 400 });

  try {
    const suggestions = await callJson({
      model: MODELS.fast,
      effort: "low",
      system: SOURCE_SUGGESTIONS_SYSTEM,
      user: buildSourceSuggestionsPrompt(parsed.data.question, parsed.data.aspects),
      schema: SuggestedSourcesOutput,
      name: "source_suggestions",
    });
    return Response.json(suggestions, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const missingKey = error instanceof Error && error.message.includes("GROQ_API_KEY");
    return Response.json({
      error: missingKey
        ? "Source suggestions need the server-side GROQ_API_KEY. Add it to .env.local and restart the dev server."
        : "Source suggestions could not be generated. Try again in a moment.",
    }, { status: missingKey ? 503 : 502, headers: { "Cache-Control": "no-store" } });
  }
}
