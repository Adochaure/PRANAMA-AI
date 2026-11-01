import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  AnalysisResult,
  AspectsOutput,
  ChecklistOutput,
  ConflictOutput,
  ExtractionOutput,
  type Aspect,
  type Claim,
  type Finding,
  type Source,
} from "../lib/schemas";
import {
  ASPECTS_SYSTEM,
  buildAspectsPrompt,
  buildChecklistPrompt,
  buildConflictPrompt,
  buildExtractionPrompt,
  CHECKLIST_SYSTEM,
  CONFLICT_SYSTEM,
  EXTRACTION_SYSTEM,
} from "../lib/prompts";
import { callJson } from "../lib/llm";
import { MODELS } from "../lib/models";

const includeRenewal = process.argv.includes("--include-renewal");
const mock = process.argv.includes("--mock");
const question = "What are the eligibility and application requirements for the Surya Scholars Grant?";
const today = process.env.SAMPLE_TODAY ?? "2026-11-01";

type SampleDefinition = {
  id: string;
  filename: string;
  title: string;
  url: string | null;
  domain: string | null;
  isOfficial: boolean;
  published: string | null;
  cycles: string[];
};

const definitions: SampleDefinition[] = [
  { id: "official", filename: "official.md", title: "Surya Scholars Grant — Official Notice", url: "https://scholarships.example.gov.in/surya/notice-2026", domain: "scholarships.example.gov.in", isOfficial: true, published: "2026-06-10", cycles: ["2026-27"] },
  { id: "blog", filename: "blog.md", title: "How to apply for the Surya Scholars Grant", url: "https://study-notes.example/blog/surya-grant", domain: "study-notes.example", isOfficial: false, published: "2026-07-18", cycles: ["2026-27"] },
  { id: "old-notice", filename: "old-notice.md", title: "Surya Scholars Grant — Archived Notice", url: "https://archive.example.gov.in/surya/notice-2023", domain: "archive.example.gov.in", isOfficial: true, published: "2023-05-02", cycles: ["2023-24"] },
  { id: "aggregator", filename: "aggregator.md", title: "Surya Scholars Grant summary", url: "https://grants.example/directory/surya", domain: "grants.example", isOfficial: false, published: null, cycles: [] },
  ...(includeRenewal ? [{ id: "renewal-faq", filename: "renewal-faq.md", title: "Surya Scholars Grant — Renewal FAQ", url: "https://scholarships.example.gov.in/surya/renewal-faq", domain: "scholarships.example.gov.in", isOfficial: true, published: "2026-09-01", cycles: ["2026-27"] }] : []),
];

const fixtureAspects: Aspect[] = [
  { id: "academic_cycle", label: "Academic cycle", question: "Which academic cycle does this notice cover?", description: "The year or cycle the information applies to.", importance: 3, keywords: ["academic cycle", "2026-27", "application year"] },
  { id: "eligibility_income", label: "Income eligibility", question: "What household income qualifies?", description: "The maximum household income for applicants.", importance: 5, keywords: ["household income", "income limit", "annual income"] },
  { id: "application_deadline", label: "Application deadline", question: "When is the application due?", description: "The last date to submit a new application.", importance: 5, keywords: ["deadline", "last date", "due date"] },
  { id: "supporting_documents", label: "Supporting documents", question: "Which income document must applicants submit?", description: "The required proof of income.", importance: 5, keywords: ["income certificate", "income-tax return", "supporting document"] },
  { id: "application_channel", label: "Application route", question: "Where should an application be submitted?", description: "The official application route.", importance: 4, keywords: ["apply", "application portal", "submit online"] },
  { id: "application_fee", label: "Application fee", question: "Is there an application fee?", description: "Any fee required to apply.", importance: 3, keywords: ["application fee", "fee", "payment"] },
  { id: "award_amount", label: "Award amount", question: "How much financial support can the award provide?", description: "The maximum scholarship amount.", importance: 3, keywords: ["award amount", "scholarship amount", "financial support"] },
  { id: "renewal_conditions", label: "Renewal conditions", question: "What must a student do to renew the award?", description: "Academic and document conditions for renewal.", importance: 4, keywords: ["renewal", "renew", "marks", "fresh income certificate"] },
  { id: "support_contact", label: "Support contact", question: "How can applicants contact the scholarship team?", description: "An official way to get help.", importance: 2, keywords: ["contact", "help", "scholarship cell"] },
];

async function readSources(): Promise<Source[]> {
  return Promise.all(definitions.map(async (definition) => {
    const text = await readFile(path.join(process.cwd(), "sample", "sources", definition.filename), "utf8");
    return {
      id: definition.id,
      kind: "url" as const,
      url: definition.url,
      title: definition.title,
      domain: definition.domain,
      isOfficial: definition.isOfficial,
      status: "ok" as const,
      error: null,
      text,
      hash: createHash("sha256").update(text).digest("hex"),
      dates: { published: definition.published, modified: null, cycles: definition.cycles },
    };
  }));
}

function fixtureClaims(source: Source) {
  const entries: Record<string, Array<{ aspect_id: string; statement: string; value: string; quote: string; as_of: string | null }>> = {
    official: [
      { aspect_id: "academic_cycle", statement: "The notice applies to the 2026-27 academic cycle.", value: "2026-27", quote: "Academic cycle: 2026-27", as_of: "2026-27" },
      { aspect_id: "eligibility_income", statement: "Applicants need household income below Rs 8 lakh.", value: "Below Rs 8 lakh", quote: "Applicants must have annual household income below Rs 8 lakh.", as_of: "2026-27" },
      { aspect_id: "application_deadline", statement: "Applications are due on 15 December 2026.", value: "15 December 2026", quote: "The online application deadline is 15 December 2026.", as_of: "2026-27" },
      { aspect_id: "supporting_documents", statement: "Applicants must submit a Tehsildar-issued income certificate.", value: "Income certificate issued by the Tehsildar", quote: "Submit an income certificate issued by the Tehsildar with your application.", as_of: "2026-27" },
      { aspect_id: "application_channel", statement: "Applications go through the State Student Support Portal.", value: "State Student Support Portal", quote: "Apply through the State Student Support Portal.", as_of: "2026-27" },
      { aspect_id: "application_fee", statement: "There is no application fee.", value: "No application fee", quote: "There is no application fee.", as_of: "2026-27" },
      { aspect_id: "support_contact", statement: "Applicants can email the scholarship cell for help.", value: "Email the scholarship cell", quote: "For help, contact the scholarship cell by email.", as_of: "2026-27" },
    ],
    blog: [
      { aspect_id: "academic_cycle", statement: "The post is about the 2026-27 cycle.", value: "2026-27", quote: "Academic cycle: 2026-27", as_of: "2026-27" },
      { aspect_id: "application_deadline", statement: "The deadline is 15 December 2026.", value: "15 December 2026", quote: "The application deadline for the 2026-27 cycle is 15 December 2026.", as_of: "2026-27" },
      { aspect_id: "supporting_documents", statement: "The post says to attach the latest income-tax return.", value: "Latest income-tax return", quote: "Applicants should attach a copy of their latest income-tax return with the application.", as_of: "2026-27" },
    ],
    "old-notice": [
      { aspect_id: "academic_cycle", statement: "The archived notice applies to 2023-24.", value: "2023-24", quote: "Academic cycle: 2023-24", as_of: "2023-24" },
      { aspect_id: "eligibility_income", statement: "The old cycle had a Rs 6 lakh income limit.", value: "Below Rs 6 lakh", quote: "For the 2023-24 academic cycle, applicants needed annual household income below Rs 6 lakh.", as_of: "2023-24" },
      { aspect_id: "application_deadline", statement: "The old cycle deadline was 10 November 2023.", value: "10 November 2023", quote: "The application deadline for that cycle was 10 November 2023.", as_of: "2023-24" },
    ],
    aggregator: [
      { aspect_id: "eligibility_income", statement: "The listing says the household income should be below Rs 8 lakh.", value: "Below Rs 8 lakh", quote: "Listings describe eligibility as household income below Rs 8 lakh and an award of up to Rs 50,000.", as_of: null },
      { aspect_id: "award_amount", statement: "The listing gives a maximum award of Rs 50,000.", value: "Up to Rs 50,000", quote: "Listings describe eligibility as household income below Rs 8 lakh and an award of up to Rs 50,000.", as_of: null },
      { aspect_id: "renewal_conditions", statement: "The summary says the award can be renewed for eligible students.", value: "Renewable for eligible students", quote: "The award is renewable for eligible students.", as_of: null },
      { aspect_id: "eligibility_income", statement: "Applicants receive a monthly stipend of Rs 12,000.", value: "Rs 12,000 monthly stipend", quote: "A monthly stipend of Rs 12,000 is guaranteed to every applicant.", as_of: null },
    ],
    "renewal-faq": [
      { aspect_id: "academic_cycle", statement: "The FAQ applies to the 2026-27 cycle.", value: "2026-27", quote: "Academic cycle: 2026-27", as_of: "2026-27" },
      { aspect_id: "renewal_conditions", statement: "Renewal requires at least 60% marks and a fresh income certificate.", value: "At least 60% marks and a fresh income certificate", quote: "For renewal, students must have scored at least 60% marks in the previous academic year.", as_of: "2026-27" },
      { aspect_id: "renewal_conditions", statement: "A fresh income certificate must accompany the renewal request.", value: "Fresh income certificate", quote: "Submit a fresh income certificate with the renewal request.", as_of: "2026-27" },
    ],
  };
  return ExtractionOutput.parse({ claims: entries[source.id] ?? [] });
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]);
    }
  }));
  return results;
}

function normalizeWithOffsets(input: string) {
  let text = "";
  const starts: number[] = [];
  const ends: number[] = [];
  let previousWasSpace = false;
  for (let index = 0; index < input.length;) {
    const codePoint = input.codePointAt(index)!;
    const original = String.fromCodePoint(codePoint);
    const end = index + original.length;
    const normalized = original.normalize("NFKC")
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2010-\u2015\u2212]/g, "-")
      .toLocaleLowerCase("en-US");
    for (const unit of normalized) {
      if (/\s/u.test(unit)) {
        if (text.length === 0) continue;
        if (previousWasSpace) {
          ends[ends.length - 1] = end;
          continue;
        }
        text += " ";
        starts.push(index);
        ends.push(end);
        previousWasSpace = true;
      } else {
        text += unit;
        for (let offset = 0; offset < unit.length; offset++) {
          starts.push(index);
          ends.push(end);
        }
        previousWasSpace = false;
      }
    }
    index = end;
  }
  if (text.endsWith(" ")) {
    text = text.slice(0, -1);
    starts.pop();
    ends.pop();
  }
  return { text, starts, ends };
}

function verifyClaims(rawClaims: Map<string, ReturnType<typeof ExtractionOutput.parse>["claims"]>, sources: Source[], aspects: Aspect[]) {
  const claims: Claim[] = [];
  let discardedClaims = 0;
  for (const source of sources) {
    const sourceClaims = rawClaims.get(source.id) ?? [];
    const normalizedSource = normalizeWithOffsets(source.text);
    for (const [index, raw] of sourceClaims.entries()) {
      const normalizedQuote = normalizeWithOffsets(raw.quote).text;
      const quoteStart = normalizedSource.text.indexOf(normalizedQuote);
      const validAspect = aspects.some((aspect) => aspect.id === raw.aspect_id);
      if (quoteStart < 0 || !validAspect || normalizedQuote.length < 10) {
        discardedClaims++;
        continue;
      }
      const quoteEnd = quoteStart + normalizedQuote.length;
      claims.push({
        id: `claim-${source.id}-${index + 1}`,
        sourceId: source.id,
        aspectId: raw.aspect_id,
        statement: raw.statement,
        value: raw.value,
        quote: source.text.slice(normalizedSource.starts[quoteStart], normalizedSource.ends[quoteEnd - 1]),
        quoteStart: normalizedSource.starts[quoteStart],
        quoteEnd: normalizedSource.ends[quoteEnd - 1],
        asOf: raw.as_of,
      });
    }
  }
  return { claims, discardedClaims };
}

function findPossiblyCovered(aspect: Aspect, source: Source) {
  const text = normalizeWithOffsets(source.text).text;
  const keywords = aspect.keywords.map((keyword) => normalizeWithOffsets(keyword).text).filter(Boolean);
  const positions = keywords.flatMap((keyword) => {
    const position = text.indexOf(keyword);
    return position < 0 ? [] : [{ keyword, position }];
  });
  for (const first of positions) {
    const matches = positions.filter((item) => Math.abs(item.position - first.position) <= 400);
    if (new Set(matches.map((item) => item.keyword)).size >= 2) {
      const from = Math.max(0, first.position - 120);
      const to = Math.min(source.text.length, from + 400);
      return source.text.slice(from, to).trim();
    }
  }
  return null;
}

function isVagueRenewal(claim: Claim) {
  return claim.aspectId === "renewal_conditions"
    && /renew|renewal/i.test(`${claim.statement} ${claim.value}`)
    && !/mark|score|income|certificate|submit|minimum|criteria|at least/i.test(`${claim.statement} ${claim.value}`);
}

function cycleStart(cycle: string) {
  const match = cycle.match(/(20\d{2})\s*[-–/]\s*(\d{2,4})/);
  return match ? Number(match[1]) : -1;
}

function isOlderThan12Months(published: string, referenceDate: string) {
  const cutoff = new Date(`${referenceDate}T00:00:00Z`);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
  return new Date(`${published}T00:00:00Z`).getTime() < cutoff.getTime();
}

function mockVerdicts(claims: Claim[]) {
  const ids = (aspectId: string) => claims.filter((claim) => claim.aspectId === aspectId).map((claim) => claim.id);
  return ConflictOutput.parse({ verdicts: [
    { aspect_id: "supporting_documents", verdict: "conflict", explanation: "The current-cycle blog asks for an income-tax return, while the official notice asks for a Tehsildar-issued income certificate.", claim_ids: ids("supporting_documents") },
    { aspect_id: "eligibility_income", verdict: "different_scope", explanation: "The Rs 6 lakh limit is explicitly for 2023-24; the current official notice is for 2026-27.", claim_ids: ids("eligibility_income") },
    { aspect_id: "application_deadline", verdict: "different_scope", explanation: "The November 2023 date belongs to the archived 2023-24 cycle, not the current 2026-27 cycle.", claim_ids: ids("application_deadline") },
  ] });
}

function mockChecklist(findings: Finding[]) {
  return ChecklistOutput.parse({ items: findings.map((finding) => ({
    finding_ids: [finding.id],
    action: finding.type === "gap"
      ? finding.aspectId === "renewal_conditions"
        ? "Confirm the renewal criteria in the current official notice"
        : `Confirm ${finding.title.replace(/ is not fully verified$/i, "").toLocaleLowerCase("en-US")} in the current official notice`
      : finding.type === "conflict"
        ? "Confirm which income document is required on the official 2026-27 notice"
        : "Use the current 2026-27 notice instead of the archived notice",
    reason: finding.explanation,
    where_to_verify: "Official Surya Scholars Grant portal or notice",
    impact: finding.severity === "high" ? 5 : finding.severity === "medium" ? 3 : 2,
    uncertainty: finding.label === "uncertain" ? 4 : 2,
  })) });
}

async function main() {
  const sources = await readSources();
  const aspects = mock
    ? AspectsOutput.parse({ aspects: fixtureAspects }).aspects
    : (await callJson({
      model: MODELS.smart,
      effort: "medium",
      system: ASPECTS_SYSTEM,
      user: buildAspectsPrompt(question, today),
      schema: AspectsOutput,
      name: "analysis_aspects",
    })).aspects;

  const extractions = await mapLimit(sources, 3, async (source) => {
    const output = mock
      ? fixtureClaims(source)
      : await callJson({
        model: MODELS.fast,
        effort: "low",
        system: EXTRACTION_SYSTEM,
        user: buildExtractionPrompt({ question, today, aspects, source }),
        schema: ExtractionOutput,
        name: "source_claims",
      });
    return [source.id, output.claims] as const;
  });
  const rawClaims = new Map(extractions);
  const { claims, discardedClaims } = verifyClaims(rawClaims, sources, aspects);

  const cells = aspects.flatMap((aspect) => sources.map((source) => {
    const aspectClaims = claims.filter((claim) => claim.aspectId === aspect.id && claim.sourceId === source.id);
    const vagueClaim = aspectClaims.find(isVagueRenewal);
    if (vagueClaim) {
      return { aspectId: aspect.id, sourceId: source.id, status: "possibly_covered" as const, claimIds: aspectClaims.map((claim) => claim.id), hint: vagueClaim.quote };
    }
    if (aspectClaims.length) {
      return { aspectId: aspect.id, sourceId: source.id, status: "covered" as const, claimIds: aspectClaims.map((claim) => claim.id), hint: null };
    }
    if (["failed", "blocked", "empty"].includes(source.status)) {
      return { aspectId: aspect.id, sourceId: source.id, status: "unreadable" as const, claimIds: [], hint: source.error };
    }
    const hint = findPossiblyCovered(aspect, source);
    return { aspectId: aspect.id, sourceId: source.id, status: hint ? "possibly_covered" as const : "not_found" as const, claimIds: [], hint };
  }));

  const findings: Finding[] = [];
  for (const aspect of aspects) {
    const aspectCells = cells.filter((cell) => cell.aspectId === aspect.id);
    if (aspectCells.length && aspectCells.every((cell) => cell.status !== "covered")) {
      const possible = aspectCells.filter((cell) => cell.status === "possibly_covered");
      findings.push({
        id: `gap-${aspect.id}`,
        type: "gap",
        aspectId: aspect.id,
        title: `${aspect.label} is not fully verified`,
        explanation: possible.length
          ? `A source may mention this, but it does not give enough detail to verify the requirement. Check ${possible.map((cell) => sources.find((source) => source.id === cell.sourceId)?.title).filter(Boolean).join(", ")}.`
          : `None of the readable sources states this information. Check the official notice before acting.`,
        severity: aspect.importance >= 4 ? "high" : "medium",
        evidence: possible.flatMap((cell) => cell.claimIds.map((claimId) => {
          const claim = claims.find((candidate) => candidate.id === claimId)!;
          return { claimId, sourceId: claim.sourceId, quote: claim.quote };
        })),
        label: possible.length ? "uncertain" : "sourced",
      });
    }
  }

  const currentCycleStart = Math.max(...sources.flatMap((source) => source.dates.cycles.map(cycleStart)));
  const staleSourceIds = new Set<string>();
  for (const source of sources) {
    const newestSourceCycle = Math.max(...source.dates.cycles.map(cycleStart), -1);
    if (currentCycleStart >= 0 && newestSourceCycle >= 0 && newestSourceCycle < currentCycleStart) {
      staleSourceIds.add(source.id);
      const staleClaims = claims.filter((claim) => claim.sourceId === source.id);
      findings.push({
        id: `outdated-${source.id}`,
        type: "outdated",
        aspectId: "academic_cycle",
        title: `${source.title} covers an older cycle`,
        explanation: `This source is for ${source.dates.cycles.join(", ")}, while the newest supplied cycle is ${sources.flatMap((item) => item.dates.cycles).find((cycle) => cycleStart(cycle) === currentCycleStart)}. Do not apply its older requirements to the current cycle.`,
        severity: "medium",
        evidence: staleClaims.map((claim) => ({ claimId: claim.id, sourceId: claim.sourceId, quote: claim.quote })),
        label: "uncertain",
      });
    }
  }

  const multiSourceAspects = aspects.filter((aspect) => new Set(claims.filter((claim) => claim.aspectId === aspect.id).map((claim) => claim.sourceId)).size > 1);
  const conflictOutput = mock
    ? mockVerdicts(claims)
    : multiSourceAspects.length
      ? await callJson({
        model: MODELS.smart,
        effort: "medium",
        system: CONFLICT_SYSTEM,
        user: buildConflictPrompt(today, claims, sources, multiSourceAspects),
        schema: ConflictOutput,
        name: "claim_comparisons",
      })
      : ConflictOutput.parse({ verdicts: [] });

  for (const verdict of conflictOutput.verdicts) {
    if (verdict.verdict !== "conflict") continue;
    const matchingClaims = verdict.claim_ids
      .map((id) => claims.find((claim) => claim.id === id && claim.aspectId === verdict.aspect_id))
      .filter((claim): claim is Claim => Boolean(claim));
    if (matchingClaims.length < 2) continue;
    const aspect = aspects.find((candidate) => candidate.id === verdict.aspect_id);
    findings.push({
      id: `conflict-${verdict.aspect_id}`,
      type: "conflict",
      aspectId: verdict.aspect_id,
      title: `Sources disagree about ${aspect?.label.toLocaleLowerCase("en-US") ?? verdict.aspect_id}`,
      explanation: verdict.explanation,
      severity: aspect && aspect.importance >= 4 ? "high" : "medium",
      evidence: matchingClaims.map((claim) => ({ claimId: claim.id, sourceId: claim.sourceId, quote: claim.quote })),
      label: "sourced",
    });
  }

  const warnings = sources.flatMap((source) => [
    ...(!source.dates.published && source.dates.cycles.length === 0 ? [`${source.title} has no publication date or academic cycle; treat it as uncertain.`] : []),
    ...(source.dates.published && isOlderThan12Months(source.dates.published, today) ? [`${source.title} was published more than 12 months before this analysis.`] : []),
    ...(staleSourceIds.has(source.id) ? [`${source.title} is from an older academic cycle.`] : []),
  ]);
  for (const verdict of conflictOutput.verdicts.filter((item) => item.verdict === "different_scope")) {
    warnings.push(verdict.explanation);
  }

  let checklistOutput: ReturnType<typeof ChecklistOutput.parse>;
  if (mock) {
    checklistOutput = mockChecklist(findings);
  } else if (findings.length) {
    checklistOutput = await callJson({
      model: MODELS.smart,
      effort: "medium",
      system: CHECKLIST_SYSTEM,
      user: buildChecklistPrompt(question, findings, aspects),
      schema: ChecklistOutput,
      name: "verification_checklist",
    });
  } else {
    checklistOutput = ChecklistOutput.parse({ items: [] });
  }

  const aspectImportance = new Map(aspects.map((aspect) => [aspect.id, aspect.importance]));
  const checklist = checklistOutput.items
    .map((item, index) => {
      const findingIds = [...new Set(item.finding_ids)].filter((id) => findings.some((finding) => finding.id === id));
      return { ...item, finding_ids: findingIds, _index: index };
    })
    .filter((item) => item.finding_ids.length > 0)
    .sort((a, b) => b.impact * b.uncertainty - a.impact * a.uncertainty
      || Math.max(...b.finding_ids.map((id) => aspectImportance.get(findings.find((finding) => finding.id === id)!.aspectId) ?? 0))
      - Math.max(...a.finding_ids.map((id) => aspectImportance.get(findings.find((finding) => finding.id === id)!.aspectId) ?? 0))
      || a._index - b._index)
    .slice(0, 12)
    .map((item, index) => ({
      finding_ids: item.finding_ids,
      action: item.action,
      reason: item.reason,
      where_to_verify: item.where_to_verify,
      impact: item.impact,
      uncertainty: item.uncertainty,
      id: `check-${index + 1}`,
      rank: index + 1,
      label: "ai_suggested" as const,
    }));

  const pointsByAspect = aspects.map((aspect) => {
    const aspectCells = cells.filter((cell) => cell.aspectId === aspect.id);
    const aspectClaims = claims.filter((claim) => claim.aspectId === aspect.id);
    const hasConflict = findings.some((finding) => finding.aspectId === aspect.id && finding.type === "conflict");
    const onlyOutdatedEvidence = aspectClaims.length > 0 && aspectClaims.every((claim) => staleSourceIds.has(claim.sourceId));
    const hasOfficialCoverage = aspectCells.some((cell) => cell.status === "covered" && sources.find((source) => source.id === cell.sourceId)?.isOfficial);
    const hasAnyCoverage = aspectCells.some((cell) => cell.status === "covered");
    const points = hasConflict
      ? 0.4
      : onlyOutdatedEvidence
        ? 0.5
        : hasAnyCoverage
          ? hasOfficialCoverage || new Set(aspectClaims.map((claim) => claim.sourceId)).size > 1 ? 1 : 0.8
          : aspectCells.some((cell) => cell.status === "possibly_covered") ? 0.2 : 0;
    return { weight: aspect.importance, points };
  });
  const totalWeight = pointsByAspect.reduce((sum, item) => sum + item.weight, 0);
  const completeness = Math.round(100 * pointsByAspect.reduce((sum, item) => sum + item.weight * item.points, 0) / totalWeight);

  const result = AnalysisResult.parse({
    question,
    generatedAt: new Date().toISOString(),
    aspects,
    sources,
    claims,
    cells,
    findings,
    checklist,
    score: { completeness, darkSpot: 100 - completeness },
    discardedClaims,
    warnings,
  });

  if (process.argv.includes("--write-precomputed")) {
    await writeFile(path.join(process.cwd(), "sample", "precomputed-result.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  }

  const has = (type: Finding["type"]) => result.findings.some((finding) => finding.type === type);
  if (!has("conflict")) throw new Error("Sample acceptance failed: planted same-cycle document conflict was not found.");
  if (!has("outdated")) throw new Error("Sample acceptance failed: archived 2023-24 notice was not marked outdated.");
  if (includeRenewal ? result.findings.some((finding) => finding.type === "gap" && finding.aspectId === "renewal_conditions") : !result.findings.some((finding) => finding.type === "gap" && finding.aspectId === "renewal_conditions")) {
    throw new Error(includeRenewal ? "Sample acceptance failed: the renewal FAQ did not close the renewal gap." : "Sample acceptance failed: the missing renewal conditions were not found.");
  }

  console.error(`Sample ${mock ? "mock" : "Groq"} run passed. Findings: ${result.findings.length}; discarded claims: ${result.discardedClaims}; renewal FAQ included: ${includeRenewal}.`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Sample run failed: ${message}`);
  process.exitCode = 1;
});
