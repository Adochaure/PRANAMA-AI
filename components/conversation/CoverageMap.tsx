"use client";

import { Check, Clock3, X } from "lucide-react";
import type { AnalysisResult, Aspect, Cell, Claim, Source } from "@/lib/schemas";
import type { EvidenceSelection } from "./EvidenceSheet";

type Props = {
  result: AnalysisResult;
  onOpenEvidence: (selection: EvidenceSelection) => void;
  onClose: () => void;
};

function aspectHasConflict(result: AnalysisResult, aspectId: string, sourceId: string) {
  return result.findings.some((finding) => finding.type === "conflict" && finding.aspectId === aspectId && finding.evidence.some((item) => item.sourceId === sourceId));
}

function sourceDate(source: Source) {
  return source.dates.modified ?? source.dates.published;
}

function CellContents({ cell, claims }: { cell: Cell; claims: Claim[] }) {
  if (cell.status === "covered") return <><Check size={13} aria-hidden="true" /><span>{claims.map((claim) => claim.value).join(" · ") || "Covered"}</span></>;
  if (cell.status === "possibly_covered") return <span className="coverage-possible">May be here</span>;
  if (cell.status === "unreadable") return <span>Unreadable</span>;
  return <span className="coverage-empty-cell">Not found</span>;
}

export function CoverageMap({ result, onOpenEvidence, onClose }: Props) {
  const cellByKey = new Map(result.cells.map((cell) => [`${cell.aspectId}:${cell.sourceId}`, cell]));
  const claimById = new Map(result.claims.map((claim) => [claim.id, claim]));

  function openCell(aspect: Aspect, source: Source, cell?: Cell) {
    const claims = cell?.claimIds.map((id) => claimById.get(id)).filter((claim): claim is Claim => Boolean(claim)) ?? [];
    const note = cell?.status === "possibly_covered" ? cell.hint ?? "A source mentions this topic, but the evidence is not detailed enough to confirm it." : cell?.status === "unreadable" ? "This source could not be read. Paste its text or try another copy." : cell?.status === "not_found" ? "No supporting claim for this check was found in this source." : undefined;
    onOpenEvidence({ source, claims, aspect, note });
  }

  return <div className="coverage-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="coverage-dialog" role="dialog" aria-modal="true" aria-labelledby="coverage-title">
      <header className="coverage-dialog-header">
        <div><p>Coverage</p><h2 id="coverage-title">What each source supports</h2></div>
        <button type="button" aria-label="Close coverage map" onClick={onClose}><X size={19} /></button>
      </header>
      <div className="coverage-table-scroll" role="region" aria-label="Source coverage table" tabIndex={0}>
        <table className="coverage-table">
          <thead><tr><th scope="col" className="coverage-aspect-heading">What to verify</th>{result.sources.map((source) => <th scope="col" key={source.id}>
            <strong>{source.title}</strong><small>{source.domain ?? (source.kind === "text" ? "Pasted text" : "Uploaded file")}</small>
            <small className={source.dates.cycles.length && source.dates.cycles.some((cycle) => /20(2[0-4]|25)/.test(cycle)) ? "coverage-old-date" : ""}>{source.dates.cycles[0] ? <><Clock3 size={12} />{source.dates.cycles[0]}</> : sourceDate(source) ?? "Date unknown"}</small>
          </th>)}</tr></thead>
          <tbody>{result.aspects.map((aspect) => <tr key={aspect.id}>
            <th scope="row" className="coverage-aspect"><strong>{aspect.label}</strong><small>{aspect.question}</small></th>
            {result.sources.map((source) => {
              const cell = cellByKey.get(`${aspect.id}:${source.id}`);
              const conflict = aspectHasConflict(result, aspect.id, source.id);
              const gap = result.findings.some((finding) => finding.type === "gap" && finding.aspectId === aspect.id);
              const className = ["coverage-cell", cell?.status === "not_found" && gap ? "coverage-cell-gap" : "", conflict ? "coverage-cell-conflict" : "", cell?.status ? `coverage-cell-${cell.status}` : "coverage-cell-unreadable"].filter(Boolean).join(" ");
              const claims = cell?.claimIds.map((id) => claimById.get(id)).filter((claim): claim is Claim => Boolean(claim)) ?? [];
              return <td key={source.id}><button className={className} type="button" onClick={() => openCell(aspect, source, cell)} aria-label={`${aspect.label}, ${source.title}: ${conflict ? "source disagreement" : cell?.status ?? "unreadable"}`}>
                {conflict ? <><span className="coverage-conflict-label">Disagrees</span><CellContents cell={cell!} claims={claims} /></> : cell ? <CellContents cell={cell} claims={claims} /> : <span>Not found</span>}
              </button></td>;
            })}
          </tr>)}</tbody>
        </table>
      </div>
      <div className="coverage-legend" aria-label="How to read the coverage map">
        <span><i className="legend-supported" /> Supported</span><span><i className="legend-not-found" /> Not found</span><span><i className="legend-possible" /> May be here</span><span><i className="legend-conflict" /> Disagreement</span>
        <p>Select a cell to see the related source evidence.</p>
      </div>
    </section>
  </div>;
}
