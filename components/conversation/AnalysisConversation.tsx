"use client";

import { useState, type CSSProperties } from "react";
import { AlertTriangle, Check, Clock3, Copy, FileText, Link2, LoaderCircle, Map as MapIcon, Plus, Search } from "lucide-react";
import type { AnalysisResult, Claim, Finding, Source } from "@/lib/schemas";
import { CoverageMap } from "./CoverageMap";
import { EvidenceSheet, type EvidenceSelection } from "./EvidenceSheet";

type Props = {
  question: string;
  sources: Array<{ id: string; name: string; kind: "url" | "file" | "text" }>;
  result: AnalysisResult | null;
  loading: boolean;
  statusLine: string;
  error: string;
  isSample: boolean;
  canRetry: boolean;
  onRetry: () => void;
  onAddSource: () => void;
  onSuggestSources: () => void;
};

function SourceIcon({ kind }: { kind: "url" | "file" | "text" }) {
  if (kind === "url") return <Link2 size={14} />;
  if (kind === "text") return <FileText size={14} />;
  return <FileText size={14} />;
}

function EvidenceLinks({ finding, result, onOpen }: { finding: Finding; result: AnalysisResult; onOpen: (claim: Claim) => void }) {
  const claims = new Map(result.claims.map((claim) => [claim.id, claim]));
  const sourceById = new Map(result.sources.map((source) => [source.id, source]));
  const seen = new Set<string>();
  const evidence = finding.evidence.filter((item) => {
    if (seen.has(item.claimId)) return false;
    seen.add(item.claimId);
    return Boolean(claims.get(item.claimId) && sourceById.get(item.sourceId));
  });
  if (!evidence.length) return null;
  return <div className="finding-citations" aria-label="Evidence citations">{evidence.map((item) => {
    const claim = claims.get(item.claimId)!;
    const source = sourceById.get(item.sourceId)!;
    const number = result.claims.findIndex((candidate) => candidate.id === claim.id) + 1;
    return <button key={item.claimId} type="button" onClick={() => onOpen(claim)} aria-label={`Open evidence ${number} from ${source.title}`}>[{number}]</button>;
  })}</div>;
}

function EvidenceCards({ finding, result, onOpen }: { finding: Finding; result: AnalysisResult; onOpen: (claim: Claim) => void }) {
  const claimById = new Map(result.claims.map((claim) => [claim.id, claim]));
  const sourceById = new Map(result.sources.map((source) => [source.id, source]));
  const evidence = finding.evidence.map((item) => ({ item, claim: claimById.get(item.claimId), source: sourceById.get(item.sourceId) })).filter((entry): entry is { item: Finding["evidence"][number]; claim: Claim; source: Source } => Boolean(entry.claim && entry.source));
  return <div className="conflict-evidence-grid">{evidence.slice(0, 2).map(({ item, claim, source }) => {
    const citation = result.claims.findIndex((candidate) => candidate.id === claim.id) + 1;
    return <button className="conflict-evidence" type="button" key={item.claimId} onClick={() => onOpen(claim)}>
      <span>{claim.statement} <b>[{citation}]</b></span><small>{source.title}</small>
    </button>;
  })}</div>;
}

export function AnalysisConversation({ question, sources, result, loading, statusLine, error, isSample, canRetry, onRetry, onAddSource, onSuggestSources }: Props) {
  const [evidence, setEvidence] = useState<EvidenceSelection | null>(null);
  const [coverageOpen, setCoverageOpen] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(() => new Set());
  const [copyStatus, setCopyStatus] = useState("");
  const sourceById = new Map(result?.sources.map((source) => [source.id, source]) ?? []);
  const aspectById = new Map(result?.aspects.map((aspect) => [aspect.id, aspect]) ?? []);
  const gaps = result?.findings.filter((finding) => finding.type === "gap") ?? [];
  const conflicts = result?.findings.filter((finding) => finding.type === "conflict") ?? [];
  const outdated = result?.findings.filter((finding) => finding.type === "outdated") ?? [];
  const sourceWarnings = result?.sources.filter((source) => ["failed", "blocked", "empty", "truncated"].includes(source.status)) ?? [];

  function openClaim(claim: Claim) {
    const source = sourceById.get(claim.sourceId);
    if (!source) return;
    setEvidence({ source, claims: [claim], aspect: aspectById.get(claim.aspectId) });
  }

  async function copyChecklist() {
    if (!result?.checklist.length) return;
    const content = result.checklist.map((item) => `${item.rank}. ${item.action}\n   ${item.reason}\n   Check: ${item.where_to_verify}`).join("\n\n");
    try {
      await navigator.clipboard.writeText(content);
      setCopyStatus("Checklist copied");
    } catch {
      setCopyStatus("Clipboard access is unavailable in this browser");
    }
    window.setTimeout(() => setCopyStatus(""), 2400);
  }

  return <>
    <section className="landing-chat-transcript" aria-label="Analysis conversation">
      <div className="landing-chat-column">
        <div className="user-question-block"><p>{question}</p><div className="conversation-source-chips" aria-label="Sources attached to this question">{sources.map((source) => <span className="conversation-source-chip" title={source.name} key={source.id}><SourceIcon kind={source.kind} /><span>{source.name}</span></span>)}</div></div>
        <article className="analysis-document" aria-live="polite">
          {loading && <div className="analysis-status-line"><LoaderCircle size={16} className="analysis-spinner" /><span>{statusLine || `Reading ${sources.length} source${sources.length === 1 ? "" : "s"}…`}</span></div>}
          {error && <div className="analysis-error" role="alert"><AlertTriangle size={17} /><span>{error}</span>{canRetry && <button type="button" onClick={onRetry}>Try again</button>}</div>}
          {sourceWarnings.map((source) => <div className="source-warning" role="status" key={source.id}><AlertTriangle size={15} /><span><strong>{source.title}:</strong> {source.error ?? (source.status === "blocked" ? "This page blocked access." : source.status === "truncated" ? "Only part of this source could be read." : "Couldn't read this source. Paste its text instead.")}</span></div>)}
          {result && <>
            <div className="analysis-sample-note"><span>Analysis result</span>{isSample && <span>Sample data</span>}</div>
            <header className="analysis-summary">
              <div className="score-ring" style={{ "--score": `${result.score.completeness * 3.6}deg` } as CSSProperties}><div><strong>{result.score.completeness}</strong><small>%</small></div></div>
              <div className="analysis-summary-copy"><h1>What the sources show</h1><p>Sources support {result.score.completeness}% of the checks needed for this question.</p></div>
            </header>
            <div className="finding-counts"><span><b>{gaps.length}</b> missing</span><span><b>{conflicts.length}</b> {conflicts.length === 1 ? "conflict" : "conflicts"}</span><span><b>{outdated.length}</b> outdated</span></div>
            {result.discardedClaims > 0 && <p className="discarded-note">{result.discardedClaims} unsupported {result.discardedClaims === 1 ? "claim was" : "claims were"} discarded because a matching quote could not be verified.</p>}
            {gaps.length > 0 && <section className="analysis-section"><h2>Missing</h2><ul className="missing-list">{gaps.map((finding) => <li key={finding.id}><span><strong>{aspectById.get(finding.aspectId)?.label ?? finding.title}</strong><small>{finding.explanation}</small></span><EvidenceLinks finding={finding} result={result} onOpen={openClaim} /></li>)}</ul></section>}
            {conflicts.length > 0 && <section className="analysis-section"><h2>Where sources disagree</h2>{conflicts.map((finding) => <div className="source-conflict" key={finding.id}><h3>{aspectById.get(finding.aspectId)?.label ?? finding.title}</h3><p>{finding.explanation}</p><EvidenceCards finding={finding} result={result} onOpen={openClaim} /><EvidenceLinks finding={finding} result={result} onOpen={openClaim} /></div>)}</section>}
            {outdated.length > 0 && <section className="analysis-section"><h2>Outdated</h2><ul className="outdated-list">{outdated.map((finding) => <li key={finding.id}><Clock3 size={16} /><span><strong>{finding.title}</strong><small>{finding.explanation}</small></span><EvidenceLinks finding={finding} result={result} onOpen={openClaim} /></li>)}</ul></section>}
            {result.checklist.length > 0 && <section className="analysis-section verify-section"><div className="verify-heading"><div><h2>Verify next</h2><p>Prioritized checks suggested from the evidence.</p></div><button className="copy-checklist-button" type="button" onClick={copyChecklist}><Copy size={14} />Copy checklist</button></div><ol className="conversation-checklist">{result.checklist.map((item) => {
              const checked = checkedItems.has(item.id);
              return <li className={checked ? "is-checked" : ""} key={item.id}><button type="button" className="conversation-checkbox" aria-label={`${checked ? "Uncheck" : "Mark complete"}: ${item.action}`} aria-pressed={checked} onClick={() => setCheckedItems((current) => { const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; })}>{checked && <Check size={13} />}</button><span className="checklist-rank">{item.rank}.</span><div><strong>{item.action}</strong><small>{item.reason}</small><small className="verify-where">Check: {item.where_to_verify}</small></div><span className="ai-suggested-label">AI-suggested</span></li>;
            })}</ol></section>}
            <div className="analysis-actions"><button type="button" onClick={() => setCoverageOpen(true)}><MapIcon size={15} />View coverage map</button><button type="button" onClick={onAddSource}><Plus size={15} />Add a source</button><button type="button" onClick={onSuggestSources}><Search size={15} />Suggest sources</button><button type="button" onClick={copyChecklist}><Copy size={15} />Copy checklist</button></div>
            {copyStatus && <p className="copy-feedback" role="status">{copyStatus}</p>}
            {result.warnings.length > 0 && <details className="analysis-warnings"><summary>Source notes ({result.warnings.length})</summary><ul>{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></details>}
            <p className="analysis-caveat">These findings flag what to verify in the supplied sources; they are not guaranteed facts.</p>
          </>}
          {!result && !loading && !error && <p className="analysis-empty">Your analysis will appear here.</p>}
        </article>
      </div>
    </section>
    {coverageOpen && result && <CoverageMap result={result} onClose={() => setCoverageOpen(false)} onOpenEvidence={(selection) => setEvidence(selection)} />}
    <EvidenceSheet selection={evidence} onClose={() => setEvidence(null)} />
  </>;
}
