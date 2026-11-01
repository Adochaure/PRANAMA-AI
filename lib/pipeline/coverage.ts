import type { Aspect, Cell, Claim, Finding, Source } from "../schemas";
import { normalizeIndexed } from "./verify";

function possiblyCoveredSnippet(aspect: Aspect, source: Source) {
  const indexed = normalizeIndexed(source.text);
  const matches = aspect.keywords
    .map((keyword) => ({ keyword: normalizeIndexed(keyword).normalized, position: indexed.normalized.indexOf(normalizeIndexed(keyword).normalized) }))
    .filter((item) => item.keyword && item.position >= 0);
  for (const first of matches) {
    const nearby = matches.filter((item) => Math.abs(item.position - first.position) <= 400);
    if (new Set(nearby.map((item) => item.keyword)).size < 2) continue;
    const start = Math.max(0, first.position - 120);
    const end = Math.min(indexed.normalized.length - 1, start + 400);
    return source.text.slice(indexed.starts[start] ?? 0, indexed.ends[end] ?? source.text.length).trim();
  }
  return null;
}

function isIncompleteRequirement(aspect: Aspect, claim: Claim) {
  const context = `${aspect.id} ${aspect.label} ${aspect.question} ${aspect.description}`;
  const content = `${claim.statement} ${claim.value}`;
  const isRenewalOrRequirements = /renew|condition|requirement|criteria/i.test(context);
  const mentionsRenewal = /renew|renewal/i.test(content);
  const includesCriteria = /mark|grade|score|income|certificate|submit|minimum|criteria|must|at least|percentage/i.test(content);
  return isRenewalOrRequirements && mentionsRenewal && !includesCriteria;
}

export function buildCoverage(aspects: Aspect[], sources: Source[], claims: Claim[]) {
  const cells: Cell[] = aspects.flatMap((aspect) => sources.map((source) => {
    const found = claims.filter((claim) => claim.aspectId === aspect.id && claim.sourceId === source.id);
    const incomplete = found.filter((claim) => isIncompleteRequirement(aspect, claim));
    const complete = found.filter((claim) => !incomplete.includes(claim));
    if (complete.length) {
      return { aspectId: aspect.id, sourceId: source.id, status: "covered" as const, claimIds: complete.map((claim) => claim.id), hint: null };
    }
    if (incomplete.length) {
      return { aspectId: aspect.id, sourceId: source.id, status: "possibly_covered" as const, claimIds: incomplete.map((claim) => claim.id), hint: incomplete.map((claim) => claim.quote).join("\n") };
    }
    if (["failed", "blocked", "empty"].includes(source.status)) {
      return { aspectId: aspect.id, sourceId: source.id, status: "unreadable" as const, claimIds: [], hint: source.error };
    }
    const hint = possiblyCoveredSnippet(aspect, source);
    return { aspectId: aspect.id, sourceId: source.id, status: hint ? "possibly_covered" as const : "not_found" as const, claimIds: [], hint };
  }));

  const gaps: Finding[] = [];
  for (const aspect of aspects) {
    const aspectCells = cells.filter((cell) => cell.aspectId === aspect.id);
    if (!aspectCells.length || aspectCells.some((cell) => cell.status === "covered")) continue;
    const possible = aspectCells.filter((cell) => cell.status === "possibly_covered");
    const evidence = possible.flatMap((cell) => cell.claimIds.flatMap((claimId) => {
      const claim = claims.find((candidate) => candidate.id === claimId);
      return claim ? [{ claimId, sourceId: claim.sourceId, quote: claim.quote }] : [];
    }));
    gaps.push({
      id: `gap-${aspect.id}`,
      type: "gap",
      aspectId: aspect.id,
      title: `${aspect.label} needs confirmation`,
      explanation: possible.length
        ? `A source may mention this but does not provide enough detail to verify it. Check ${possible.map((cell) => sources.find((source) => source.id === cell.sourceId)?.title ?? "the source").join(", ")}.`
        : aspectCells.every((cell) => cell.status === "unreadable")
          ? "None of the supplied sources could be read. Paste the source text or provide a readable public link."
          : "None of the readable sources states this information. Check the official source before acting.",
      severity: aspect.importance >= 4 ? "high" : aspect.importance >= 3 ? "medium" : "low",
      evidence,
      label: possible.length ? "uncertain" : "sourced",
    });
  }
  return { cells, gaps };
}
