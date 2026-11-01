import { NextRequest } from "next/server";
import { AnalyzeRequest, type StreamEvent } from "@/lib/schemas";
import { runAnalysis } from "@/lib/pipeline/run";

export const maxDuration = 300;

const MAX_REQUEST_BYTES = 4 * 1024 * 1024;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 12;

type RateLimitState = { timestamps: number[] };
const globalRateLimit = globalThis as typeof globalThis & { pramanaAnalysisRateLimit?: Map<string, RateLimitState> };
const rateLimit = globalRateLimit.pramanaAnalysisRateLimit ??= new Map<string, RateLimitState>();

class RequestBodyTooLargeError extends Error {}

async function readJsonLimited(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_REQUEST_BYTES) throw new RequestBodyTooLargeError();
  if (!request.body) throw new Error("Request body is empty.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_REQUEST_BYTES) {
      await reader.cancel();
      throw new RequestBodyTooLargeError();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

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
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return errorResponse("Send the analysis request as JSON.", 415);
  }
  if (isRateLimited(request)) return errorResponse("Too many analyses were started. Wait a minute and try again.", 429);

  let body: unknown;
  try {
    body = await readJsonLimited(request);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return errorResponse("The request is larger than the 4 MB limit.", 413);
    return errorResponse("The request body must be valid JSON.", 400);
  }
  const parsed = AnalyzeRequest.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? "The analysis request is invalid.", 400);

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
        const message = error instanceof Error && error.message.includes("GROQ_API_KEY")
          ? "Analysis is not configured yet. Add the server-side GROQ_API_KEY and try again."
          : "Analysis could not be completed. Please check the sources and try again.";
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
}
