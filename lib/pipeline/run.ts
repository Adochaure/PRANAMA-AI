import {
  AnalysisResult,
  type AnalyzeRequest,
  type Aspect,
  type Claim,
  type Source,
  type StreamEvent,
} from "../schemas";
import { ingestSources } from "../ingest";
import { extractSourceClaims, reuseVerifiedCachedClaims } from "./claims";
import { makeAspects } from "./aspects";
import { verifyClaims } from "./verify";
import { buildCoverage } from "./coverage";
import { compareClaims } from "./conflicts";
import { buildFindings } from "./findings";
import { calculateScore } from "./score";
import { makeChecklist } from "./checklist";

export type AnalysisOptions = {
  onEvent?: (event: StreamEvent) => void | Promise<void>;
  now?: Date;
};

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>) {
  const output = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      output[index] = await fn(items[index], index);
    }
  }));
  return output;
}

export async function runAnalysis(request: AnalyzeRequest, options: AnalysisOptions = {}) {
  const now = options.now ?? new Date();
  const today = now.toISOString().slice(0, 10);
  const emit = async (event: StreamEvent) => options.onEvent?.(event);
  const step = async (name: Extract<StreamEvent, { type: "step" }>['step'], status: "start" | "done", detail?: string) => {
    await emit({ type: "step", step: name, status, ...(detail ? { detail } : {}) });
  };

  await step("ingest", "start", "Reading and checking sources");
  const sources = await ingestSources(request.sources, (source) => emit({ type: "source", id: source.id, status: source.status }), now);
  await step("ingest", "done", `${sources.length} source${sources.length === 1 ? "" : "s"} ready`);

  await step("aspects", "start", "Preparing the facts to verify");
  const aspects: Aspect[] = await makeAspects(request.question, today, request.aspects);
  await step("aspects", "done", `${aspects.length} aspects`);

  await step("claims", "start", "Extracting claims from readable sources");
  const cachedBySource = reuseVerifiedCachedClaims(request.cachedClaims, sources);
  const rawBySource = new Map<string, Awaited<ReturnType<typeof extractSourceClaims>>["claims"]>();
  const reusableClaims: Claim[] = [];
  const sourcesToExtract: Source[] = [];
  for (const source of sources) {
    const provided = request.cachedClaims?.filter((claim) => claim.sourceId === source.id) ?? [];
    const reusable = cachedBySource.get(source.id) ?? [];
    const unchanged = request.cachedSourceHashes?.[source.id] === source.hash;
    if (unchanged && provided.length > 0 && reusable.length === provided.length) {
      reusableClaims.push(...reusable);
      rawBySource.set(source.id, []);
    } else {
      sourcesToExtract.push(source);
    }
  }
  const extracted = await mapLimit(sourcesToExtract, 3, async (source) => extractSourceClaims(source, request.question, today, aspects));
  for (const output of extracted) rawBySource.set(output.sourceId, output.claims);
  const verified = verifyClaims(rawBySource, sources, aspects, reusableClaims);
  await step("claims", "done", `${verified.claims.length} claims retained`);

  await step("verify", "start", "Checking quotes and source coverage");
  const coverage = buildCoverage(aspects, sources, verified.claims);
  await step("verify", "done", `${verified.discardedClaims} unsupported claim${verified.discardedClaims === 1 ? "" : "s"} discarded`);

  await step("analyze", "start", "Checking dates, coverage, and disagreements");
  const comparisons = await compareClaims(today, verified.claims, sources, aspects);
  const analysis = buildFindings({ aspects, sources, claims: verified.claims, gaps: coverage.gaps, conflicts: comparisons, today: now });
  const score = calculateScore({
    aspects,
    sources,
    claims: verified.claims,
    cells: coverage.cells,
    findings: analysis.findings,
    outdatedSourceIds: analysis.outdatedSourceIds,
    outdatedClaimIds: analysis.outdatedClaimIds,
  });
  await step("analyze", "done", `${analysis.findings.length} findings`);

  await step("checklist", "start", "Ranking what to verify next");
  const checklist = await makeChecklist(request.question, analysis.findings, aspects);
  await step("checklist", "done", `${checklist.length} checklist items`);

  const result = AnalysisResult.parse({
    question: request.question,
    generatedAt: now.toISOString(),
    aspects,
    sources,
    claims: verified.claims,
    cells: coverage.cells,
    findings: analysis.findings,
    checklist,
    score,
    discardedClaims: verified.discardedClaims,
    warnings: analysis.warnings,
  });
  await emit({ type: "result", data: result });
  return result;
}
