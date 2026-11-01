import type { Aspect, Claim, ConflictOutput, Finding, Source } from "../schemas";
import { analyzeStaleness } from "./staleness";

export function buildFindings(input: {
  aspects: Aspect[];
  sources: Source[];
  claims: Claim[];
  gaps: Finding[];
  conflicts: ConflictOutput;
  today: Date;
}) {
  const { findings: staleFindings, warnings: staleWarnings, ...staleness } = analyzeStaleness(input.aspects, input.sources, input.claims, input.today);
  const findings = [...input.gaps, ...staleFindings];
  for (const verdict of input.conflicts.verdicts) {
    if (verdict.verdict !== "conflict") continue;
    const claimIds = verdict.claim_ids.filter((id) => input.claims.some((claim) => claim.id === id && claim.aspectId === verdict.aspect_id));
    const evidence = claimIds.flatMap((claimId) => {
      const claim = input.claims.find((candidate) => candidate.id === claimId);
      return claim ? [{ claimId, sourceId: claim.sourceId, quote: claim.quote }] : [];
    });
    if (evidence.length < 2) continue;
    const aspect = input.aspects.find((candidate) => candidate.id === verdict.aspect_id);
    findings.push({
      id: `conflict-${verdict.aspect_id}`,
      type: "conflict",
      aspectId: verdict.aspect_id,
      title: `Sources disagree about ${aspect?.label.toLocaleLowerCase("en-US") ?? verdict.aspect_id}`,
      explanation: verdict.explanation,
      severity: aspect && aspect.importance >= 4 ? "high" : "medium",
      evidence,
      label: "sourced",
    });
  }
  const warnings = [
    ...staleWarnings,
    ...input.sources.filter((source) => source.status === "failed" || source.status === "blocked" || source.status === "empty").map((source) => `${source.title}: ${source.error ?? "source unavailable"}`),
    ...input.conflicts.verdicts.filter((verdict) => verdict.verdict === "different_scope" || verdict.verdict === "unclear").map((verdict) => verdict.explanation),
  ];
  return { ...staleness, findings, warnings: [...new Set(warnings)] };
}
