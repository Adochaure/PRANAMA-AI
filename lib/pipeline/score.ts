import type { Aspect, Cell, Claim, Finding, Source } from "../schemas";

export function calculateScore(input: {
  aspects: Aspect[];
  sources: Source[];
  claims: Claim[];
  cells: Cell[];
  findings: Finding[];
  outdatedSourceIds?: Set<string>;
  outdatedClaimIds?: Set<string>;
}) {
  const weights = input.aspects.map((aspect) => {
    const cells = input.cells.filter((cell) => cell.aspectId === aspect.id);
    const claims = input.claims.filter((claim) => claim.aspectId === aspect.id);
    const hasConflict = input.findings.some((finding) => finding.aspectId === aspect.id && finding.type === "conflict");
    const allEvidenceOutdated = claims.length > 0 && claims.every((claim) => input.outdatedClaimIds?.has(claim.id) || input.outdatedSourceIds?.has(claim.sourceId));
    const hasOfficialCoverage = cells.some((cell) => cell.status === "covered" && input.sources.some((source) => source.id === cell.sourceId && source.isOfficial));
    const coveredCells = cells.filter((cell) => cell.status === "covered");
    const points = hasConflict
      ? 0.4
      : allEvidenceOutdated
        ? 0.5
        : coveredCells.length
          ? hasOfficialCoverage || new Set(claims.map((claim) => claim.sourceId)).size > 1 ? 1 : 0.8
          : cells.some((cell) => cell.status === "possibly_covered") ? 0.2 : 0;
    return { importance: aspect.importance, points };
  });
  const totalImportance = weights.reduce((sum, item) => sum + item.importance, 0);
  const completeness = totalImportance
    ? Math.round(100 * weights.reduce((sum, item) => sum + item.importance * item.points, 0) / totalImportance)
    : 0;
  return { completeness, darkSpot: 100 - completeness };
}
