import { ExtractionOutput, type Aspect, type Claim, type Source } from "../schemas";
import { buildExtractionPrompt, EXTRACTION_SYSTEM } from "../prompts";
import { MODELS } from "../models";
import { callJson } from "../llm";

export async function extractSourceClaims(source: Source, question: string, today: string, aspects: Aspect[]) {
  if (source.status === "failed" || source.status === "blocked" || source.status === "empty") {
    return { sourceId: source.id, claims: ExtractionOutput.parse({ claims: [] }).claims };
  }
  const result = await callJson({
    model: MODELS.fast,
    effort: "low",
    system: EXTRACTION_SYSTEM,
    user: buildExtractionPrompt({ question, today, aspects, source }),
    schema: ExtractionOutput,
    name: "source_claims",
  });
  return { sourceId: source.id, claims: result.claims };
}

export function reuseVerifiedCachedClaims(cachedClaims: Claim[] | undefined, sources: Source[]) {
  const reusableBySource = new Map<string, Claim[]>();
  if (!cachedClaims?.length) return reusableBySource;
  const sourcesById = new Map(sources.map((source) => [source.id, source]));
  for (const claim of cachedClaims) {
    const source = sourcesById.get(claim.sourceId);
    if (!source || source.status !== "ok" && source.status !== "truncated") continue;
    if (claim.quoteStart < 0 || claim.quoteEnd > source.text.length || claim.quoteEnd <= claim.quoteStart) continue;
    if (source.text.slice(claim.quoteStart, claim.quoteEnd) !== claim.quote) continue;
    const group = reusableBySource.get(source.id) ?? [];
    group.push(claim);
    reusableBySource.set(source.id, group);
  }
  return reusableBySource;
}
