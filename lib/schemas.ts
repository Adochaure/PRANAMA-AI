import { z } from "zod";

export const Label = z.enum(["sourced", "ai_suggested", "uncertain"]);

export const Aspect = z.object({
  id: z.string(),
  label: z.string(),
  question: z.string(),
  description: z.string(),
  importance: z.number().int().min(1).max(5),
  keywords: z.array(z.string()).min(2).max(8),
});

export const AspectsOutput = z.object({ aspects: z.array(Aspect).min(6).max(10) });

export const SourceDates = z.object({
  published: z.string().nullable(),
  modified: z.string().nullable(),
  cycles: z.array(z.string()),
});

export const Source = z.object({
  id: z.string(),
  kind: z.enum(["url", "text", "pdf"]),
  url: z.string().nullable(),
  title: z.string(),
  domain: z.string().nullable(),
  isOfficial: z.boolean(),
  status: z.enum(["ok", "truncated", "failed", "blocked", "empty"]),
  error: z.string().nullable(),
  text: z.string(),
  hash: z.string(),
  dates: SourceDates,
});

export const ExtractedClaim = z.object({
  aspect_id: z.string(),
  statement: z.string().max(300),
  value: z.string().max(120),
  quote: z.string().min(10).max(400),
  as_of: z.string().nullable(),
});

export const ExtractionOutput = z.object({ claims: z.array(ExtractedClaim).max(40) });

export const Claim = z.object({
  id: z.string(),
  sourceId: z.string(),
  aspectId: z.string(),
  statement: z.string(),
  value: z.string(),
  quote: z.string(),
  quoteStart: z.number().int().nonnegative(),
  quoteEnd: z.number().int().nonnegative(),
  asOf: z.string().nullable(),
});

export const Cell = z.object({
  aspectId: z.string(),
  sourceId: z.string(),
  status: z.enum(["covered", "not_found", "possibly_covered", "unreadable"]),
  claimIds: z.array(z.string()),
  hint: z.string().nullable(),
});

export const ConflictOutput = z.object({
  verdicts: z.array(z.object({
    aspect_id: z.string(),
    verdict: z.enum(["conflict", "consistent", "different_scope", "unclear"]),
    explanation: z.string().max(300),
    claim_ids: z.array(z.string()),
  })),
});

export const Evidence = z.object({ claimId: z.string(), sourceId: z.string(), quote: z.string() });

export const Finding = z.object({
  id: z.string(),
  type: z.enum(["gap", "conflict", "outdated"]),
  aspectId: z.string(),
  title: z.string(),
  explanation: z.string(),
  severity: z.enum(["high", "medium", "low"]),
  evidence: z.array(Evidence),
  label: Label,
});

export const ChecklistRaw = z.object({
  finding_ids: z.array(z.string()).min(1),
  action: z.string().max(200),
  reason: z.string().max(300),
  where_to_verify: z.string().max(160),
  impact: z.number().int().min(1).max(5),
  uncertainty: z.number().int().min(1).max(5),
});

export const ChecklistOutput = z.object({ items: z.array(ChecklistRaw).max(12) });

export const ChecklistItem = ChecklistRaw.extend({
  id: z.string(),
  rank: z.number().int().positive(),
  label: z.literal("ai_suggested"),
});

export const AnalysisResult = z.object({
  question: z.string(),
  generatedAt: z.string(),
  aspects: z.array(Aspect),
  sources: z.array(Source),
  claims: z.array(Claim),
  cells: z.array(Cell),
  findings: z.array(Finding),
  checklist: z.array(ChecklistItem),
  score: z.object({ completeness: z.number().min(0).max(100), darkSpot: z.number().min(0).max(100) }),
  discardedClaims: z.number().int().nonnegative(),
  warnings: z.array(z.string()),
});

export const AnalyzeRequest = z.object({
  question: z.string().min(5).max(500),
  sources: z.array(z.object({
    id: z.string().min(1).max(100),
    kind: z.enum(["url", "text", "pdf"]),
    url: z.string().url().optional(),
    title: z.string().optional(),
    text: z.string().optional(),
    fileBase64: z.string().max(3_000_000).optional(),
    filename: z.string().max(180).optional(),
    isOfficial: z.boolean().optional(),
  })).min(1).max(8),
  aspects: z.array(Aspect).optional(),
  cachedClaims: z.array(Claim).optional(),
  cachedSourceHashes: z.record(z.string(), z.string()).optional(),
}).superRefine((request, context) => {
  const sourceIds = new Set<string>();
  request.sources.forEach((source, index) => {
    if (sourceIds.has(source.id)) {
      context.addIssue({ code: "custom", path: ["sources", index, "id"], message: "Source IDs must be unique." });
    }
    sourceIds.add(source.id);
    if (source.kind === "url" && !source.url) {
      context.addIssue({ code: "custom", path: ["sources", index, "url"], message: "A URL source needs a URL." });
    }
    if (source.kind === "text" && !source.text?.trim()) {
      context.addIssue({ code: "custom", path: ["sources", index, "text"], message: "A text source needs pasted content." });
    }
    if (source.kind === "pdf" && !source.url && !source.fileBase64) {
      context.addIssue({ code: "custom", path: ["sources", index, "fileBase64"], message: "A PDF source needs a PDF URL or uploaded PDF data." });
    }
    if (source.kind !== "pdf" && source.fileBase64) {
      context.addIssue({ code: "custom", path: ["sources", index, "fileBase64"], message: "Uploaded file data is only accepted for PDF sources." });
    }
  });
});

export const SuggestedSource = z.object({
  url: z.string().url(),
  title: z.string().min(1).max(180),
  snippet: z.string().min(1).max(320),
  domain: z.string().min(1).max(160),
  officialGuess: z.boolean(),
  label: z.literal("ai_suggested"),
});

export const SuggestedSourcesOutput = z.object({ suggestions: z.array(SuggestedSource).length(5) });

export const SuggestRequest = z.object({
  question: z.string().trim().min(5).max(500),
  aspects: z.array(Aspect).min(6).max(10),
});

export const StreamEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("step"), step: z.enum(["ingest", "aspects", "claims", "verify", "analyze", "checklist"]), status: z.enum(["start", "done"]), detail: z.string().optional() }),
  z.object({ type: z.literal("source"), id: z.string(), status: Source.shape.status }),
  z.object({ type: z.literal("result"), data: AnalysisResult }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);

export type Aspect = z.infer<typeof Aspect>;
export type Source = z.infer<typeof Source>;
export type ExtractedClaim = z.infer<typeof ExtractedClaim>;
export type Claim = z.infer<typeof Claim>;
export type ConflictOutput = z.infer<typeof ConflictOutput>;
export type Cell = z.infer<typeof Cell>;
export type Finding = z.infer<typeof Finding>;
export type ChecklistItem = z.infer<typeof ChecklistItem>;
export type SuggestedSource = z.infer<typeof SuggestedSource>;
export type AnalysisResult = z.infer<typeof AnalysisResult>;
export type AnalyzeRequest = z.infer<typeof AnalyzeRequest>;
export type StreamEvent = z.infer<typeof StreamEvent>;
