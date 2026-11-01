import { ConflictOutput, type Aspect, type Claim, type Source } from "../schemas";
import { MODELS } from "../models";
import { buildConflictPrompt, CONFLICT_SYSTEM } from "../prompts";
import { callJson } from "../llm";

export async function compareClaims(today: string, claims: Claim[], sources: Source[], aspects: Aspect[]) {
  const comparedAspects = aspects.filter((aspect) => new Set(claims.filter((claim) => claim.aspectId === aspect.id).map((claim) => claim.sourceId)).size > 1);
  if (!comparedAspects.length) return ConflictOutput.parse({ verdicts: [] });
  const output = await callJson({
    model: MODELS.smart,
    effort: "medium",
    system: CONFLICT_SYSTEM,
    user: buildConflictPrompt(today, claims, sources, comparedAspects),
    schema: ConflictOutput,
    name: "claim_comparisons",
  });
  const allowedAspectIds = new Set(comparedAspects.map((aspect) => aspect.id));
  const knownClaimIds = new Set(claims.map((claim) => claim.id));
  return ConflictOutput.parse({ verdicts: output.verdicts
    .filter((verdict) => allowedAspectIds.has(verdict.aspect_id))
    .map((verdict) => ({ ...verdict, claim_ids: [...new Set(verdict.claim_ids)].filter((id) => knownClaimIds.has(id)) })) });
}
