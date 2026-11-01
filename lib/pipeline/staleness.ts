import type { Aspect, Claim, Finding, Source } from "../schemas";
import { parseDeadline } from "../ingest/extractDates";

function cycleYear(value: string) {
  const match = value.match(/(20\d{2})\s*[-–/]\s*(\d{2,4})/);
  return match ? Number(match[1]) : -1;
}

export function analyzeStaleness(aspects: Aspect[], sources: Source[], claims: Claim[], today = new Date()) {
  const warnings: string[] = [];
  const findings: Finding[] = [];
  const outdatedSourceIds = new Set<string>();
  const outdatedClaimIds = new Set<string>();
  const newestCycle = Math.max(...sources.flatMap((source) => source.dates.cycles.map(cycleYear)));
  const newestCycleLabel = sources.flatMap((source) => source.dates.cycles).find((cycle) => cycleYear(cycle) === newestCycle);
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const cutoff = new Date(todayUtc);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);

  for (const source of sources) {
    const published = source.dates.published ? new Date(`${source.dates.published}T00:00:00Z`) : null;
    if (published && !Number.isNaN(published.getTime()) && published < cutoff) {
      warnings.push(`${source.title} was published more than 12 months ago.`);
    }
    if (!source.dates.published && source.dates.cycles.length === 0) {
      warnings.push(`${source.title} has no publication date or academic cycle; treat it as uncertain.`);
    }
    const sourceCycle = Math.max(...source.dates.cycles.map(cycleYear), -1);
    if (newestCycle >= 0 && sourceCycle >= 0 && sourceCycle < newestCycle) {
      outdatedSourceIds.add(source.id);
      const evidence = claims.filter((claim) => claim.sourceId === source.id).map((claim) => {
        outdatedClaimIds.add(claim.id);
        return { claimId: claim.id, sourceId: source.id, quote: claim.quote };
      });
      findings.push({
        id: `outdated-${source.id}`,
        type: "outdated",
        aspectId: aspects.find((aspect) => /cycle|year/i.test(`${aspect.id} ${aspect.label}`))?.id ?? "academic_cycle",
        title: `${source.title} is from an older cycle`,
        explanation: `This source covers ${source.dates.cycles.join(", ")}; the newest supplied cycle is ${newestCycleLabel}. Do not apply its old requirements to the current cycle.`,
        severity: "medium",
        evidence,
        label: "uncertain",
      });
    }
  }

  for (const claim of claims) {
    const aspect = aspects.find((item) => item.id === claim.aspectId);
    if (!aspect || !/deadline|last date|due/i.test(`${aspect.id} ${aspect.label} ${aspect.question} ${aspect.keywords.join(" ")}`)) continue;
    const deadline = parseDeadline(claim.value, today);
    if (!deadline) continue;
    const deadlineUtc = new Date(Date.UTC(deadline.getFullYear(), deadline.getMonth(), deadline.getDate()));
    if (deadlineUtc >= todayUtc) continue;
    outdatedClaimIds.add(claim.id);
    findings.push({
      id: `outdated-deadline-${claim.id}`,
      type: "outdated",
      aspectId: aspect.id,
      title: `A deadline in ${aspect.label.toLocaleLowerCase("en-US")} has passed`,
      explanation: `The cited source lists ${claim.value}, which is before the analysis date. Confirm whether a new deadline or extension has been issued.`,
      severity: "high",
      evidence: [{ claimId: claim.id, sourceId: claim.sourceId, quote: claim.quote }],
      label: "sourced",
    });
  }

  return { findings, warnings, outdatedSourceIds, outdatedClaimIds };
}
