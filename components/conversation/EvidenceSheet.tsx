"use client";

import { Clock3, ExternalLink, ShieldCheck, X } from "lucide-react";
import type { Aspect, Claim, Source } from "@/lib/schemas";

export type EvidenceSelection = {
  source: Source;
  claims: Claim[];
  aspect?: Aspect;
  note?: string;
};

function HighlightedQuote({ source, claim }: { source: Source; claim: Claim }) {
  let start = claim.quoteStart;
  let end = claim.quoteEnd;
  if (source.text.slice(start, end) !== claim.quote) {
    start = source.text.indexOf(claim.quote);
    end = start < 0 ? start : start + claim.quote.length;
  }

  if (start < 0) return <p>{claim.quote}</p>;
  const excerptStart = Math.max(0, start - 160);
  const excerptEnd = Math.min(source.text.length, end + 220);
  return <p>
    {excerptStart > 0 ? "…" : ""}
    {source.text.slice(excerptStart, start)}
    <mark>{source.text.slice(start, end)}</mark>
    {source.text.slice(end, excerptEnd)}
    {excerptEnd < source.text.length ? "…" : ""}
  </p>;
}

export function EvidenceSheet({ selection, onClose }: { selection: EvidenceSelection | null; onClose: () => void }) {
  if (!selection) return null;
  const { source, claims, aspect, note } = selection;
  const date = source.dates.modified ?? source.dates.published;

  return <div className="evidence-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="evidence-sheet" role="dialog" aria-modal="true" aria-labelledby="evidence-title">
      <button className="evidence-close" type="button" aria-label="Close evidence" onClick={onClose}><X size={18} /></button>
      <p className="evidence-eyebrow">Source evidence</p>
      <h2 id="evidence-title">{source.title}</h2>
      <div className="evidence-meta">
        <span>{source.domain ?? (source.kind === "text" ? "Pasted source" : "Uploaded document")}</span>
        {date && <span><Clock3 size={13} />{date}</span>}
        {source.isOfficial && <span><ShieldCheck size={13} />Official source</span>}
      </div>
      {aspect && <p className="evidence-aspect">Checking: {aspect.label}</p>}
      {claims.length ? claims.map((claim) => <article className="evidence-claim" key={claim.id}>
        <h3>{claim.statement}</h3>
        <div className="evidence-quote"><HighlightedQuote source={source} claim={claim} /></div>
      </article>) : <p className="evidence-empty">{note ?? "No supported claim was extracted for this check."}</p>}
      <div className="evidence-footer">
        <span>Sourced</span>
        {source.url && <a href={source.url} target="_blank" rel="noreferrer">Open original <ExternalLink size={14} /></a>}
      </div>
    </section>
  </div>;
}
