import { NextRequest } from "next/server";
import { AnalyzeRequest, type StreamEvent } from "@/lib/schemas";
import { runAnalysis } from "@/lib/pipeline/run";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;

type RateLimitState = { timestamps: number[] };
const globalRateLimit = globalThis as typeof globalThis & { pramanaAnalysisRateLimit?: Map<string, RateLimitState> };
const rateLimit = globalRateLimit.pramanaAnalysisRateLimit ??= new Map<string, RateLimitState>();

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

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  try {
    if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
      return errorResponse("Send the analysis request as JSON.", 415);
    }
    if (isRateLimited(request)) {
      return errorResponse("Too many analyses were started. Wait a minute and try again.", 429);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("The request body must be valid JSON.", 400);
    }

    const parsed = AnalyzeRequest.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? "The analysis request is invalid.", 400);
    }

    // Check for GROQ API key early before starting stream
    if (!process.env.GROQ_API_KEY) {
      return errorResponse(
        "GROQ_API_KEY is not configured on the server. Please add GROQ_API_KEY to your Vercel Project Settings > Environment Variables, or use 'Try the sample scholarship' on the home page for instant offline evaluation.",
        503
      );
    }

    const encoder = new TextEncoder();
    let canceled = false;
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: StreamEvent) => {
          if (canceled) return;
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          } catch {
            canceled = true;
          }
        };

        try {
          await runAnalysis(parsed.data, { onEvent: send });
        } catch (error) {
          const message = error instanceof Error
            ? error.message
            : "Analysis could not be completed. Please check your sources and try again.";
          send({ type: "error", message });
        } finally {
          if (!canceled) {
            try {
              controller.close();
            } catch {
              canceled = true;
            }
          }
        }
      },
      cancel() {
        canceled = true;
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    console.error("Unhandled error in /api/analyze:", err);
    return errorResponse(
      err instanceof Error ? err.message : "Internal server error during analysis.",
      500
    );
  }
}
