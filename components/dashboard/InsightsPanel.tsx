"use client";

import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  Grid2X2,
  Info,
  LoaderCircle,
  RotateCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import type { AnalysisResult } from "@/lib/schemas";

type Props = {
  result: AnalysisResult | null;
  loading: boolean;
  onOpenCoverageMap: () => void;
  onBackToChat: () => void;
  checkedIds: Set<string>;
  onToggleCheck: (id: string) => void;
  onExportJson: () => void;
  onRefresh?: () => void;
};

export default function InsightsPanel({
  result,
  loading,
  onOpenCoverageMap,
  onBackToChat,
  checkedIds,
  onToggleCheck,
  onExportJson,
  onRefresh,
}: Props) {
  const [copied, setCopied] = useState(false);

  const gaps = result?.findings.filter((f) => f.type === "gap") ?? [];
  const conflicts = result?.findings.filter((f) => f.type === "conflict") ?? [];
  const outdated = result?.findings.filter((f) => f.type === "outdated") ?? [];
  const aspectById = new Map(result?.aspects.map((a) => [a.id, a]) ?? []);

  const completeness = result?.score.completeness ?? 0;
  const darkSpot = result?.score.darkSpot ?? 0;

  async function copyChecklist() {
    if (!result?.checklist.length) return;
    const text = result.checklist
      .map((item) => `${item.rank}. ${item.action}\n   Reason: ${item.reason}\n   Check: ${item.where_to_verify}`)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const conicDeg = Math.round(completeness * 3.6);
  const gapDeg = Math.min(360, conicDeg + Math.round(darkSpot * 3.6));

  return (
    <section className="insights-panel" aria-label="Analysis insights">
      <div className="insights-header">
        <div>
          <button className="insights-back" type="button" onClick={onBackToChat}>
            <ArrowLeft size={15} />Back to research
          </button>
          <h2>Research insights</h2>
        </div>
        {onRefresh && (
          <button
            type="button"
            className="insights-more"
            title="Refresh analysis"
            aria-label="Refresh analysis"
            onClick={onRefresh}
            disabled={loading}
          >
            {loading ? <LoaderCircle size={15} className="analysis-spinner" /> : <RotateCw size={15} />}
          </button>
        )}
      </div>

      {loading && !result && (
        <div style={{ padding: "40px 10px", textAlign: "center", color: "#6b7280" }}>
          <LoaderCircle size={24} className="analysis-spinner" style={{ margin: "0 auto 12px" }} />
          <p style={{ fontSize: "12px", margin: 0 }}>Evaluating claims against sources…</p>
        </div>
      )}

      {!result && !loading && (
        <div style={{ padding: "40px 10px", textAlign: "center", color: "#838995" }}>
          <Info size={28} style={{ margin: "0 auto 10px", opacity: 0.5 }} />
          <strong style={{ display: "block", fontSize: "12px", color: "#373e4c", marginBottom: "4px" }}>
            Workspace ready
          </strong>
          <p style={{ fontSize: "11px", margin: 0, lineHeight: "16px" }}>
            Start a question with your sources or try the sample grant to inspect coverage insights.
          </p>
        </div>
      )}

      {result && (
        <>
          {/* Coverage Score Ring Card */}
          <div className="coverage-card">
            <div className="coverage-card-top">
              <span>Source coverage</span>
              <button
                type="button"
                aria-label="Coverage details"
                title="Completeness represents verified quote-backed claims against required aspects."
              >
                <Info size={14} />
              </button>
            </div>
            <div className="coverage-main">
              <div
                className="coverage-ring"
                role="img"
                aria-label={`${completeness} percent source coverage`}
                style={{
                  background: `conic-gradient(var(--blue) 0deg ${conicDeg}deg, var(--red) ${conicDeg}deg ${gapDeg}deg, #eef0f3 ${gapDeg}deg 360deg)`,
                }}
              >
                <div>
                  <strong>{completeness}</strong>
                  <small>%</small>
                </div>
              </div>
              <div className="coverage-copy">
                <strong>
                  {completeness >= 85
                    ? "Substantially proven"
                    : completeness >= 65
                    ? "Good starting point"
                    : "Significant gaps remain"}
                </strong>
                <p>
                  Sources verify {result.cells.filter((c) => c.status === "covered").length} of {result.aspects.length} required aspects.
                </p>
                <button type="button" onClick={onOpenCoverageMap}>
                  View coverage map <ChevronRight size={14} />
                </button>
              </div>
            </div>
            <div className="coverage-legend">
              <span><i className="legend-covered" />Covered</span>
              <span><i className="legend-gap" />Gap / Missing</span>
            </div>
          </div>

          {/* Attention / Findings Summary */}
          <div className="finding-summary">
            <div className="insight-section-title">
              <h3>What needs attention</h3>
            </div>
            
            <button className="summary-row" type="button" onClick={onBackToChat}>
              <span className="summary-icon missing-icon"><TriangleAlert size={15} /></span>
              <span>
                <strong>Missing information</strong>
                <small>{gaps.length ? gaps.map((g) => aspectById.get(g.aspectId)?.label || g.title).slice(0, 2).join(", ") : "None found"}</small>
              </span>
              <b>{gaps.length}</b>
            </button>

            <button className="summary-row" type="button" onClick={onBackToChat}>
              <span className="summary-icon conflict-icon">≠</span>
              <span>
                <strong>Source disagreement</strong>
                <small>{conflicts.length ? conflicts.map((c) => aspectById.get(c.aspectId)?.label || c.title).slice(0, 2).join(", ") : "No disagreements"}</small>
              </span>
              <b>{conflicts.length}</b>
            </button>

            <button className="summary-row" type="button" onClick={onBackToChat}>
              <span className="summary-icon dated-icon"><Clock3 size={15} /></span>
              <span>
                <strong>Outdated information</strong>
                <small>{outdated.length ? outdated.map((o) => o.title).slice(0, 2).join(", ") : "Up to date"}</small>
              </span>
              <b>{outdated.length}</b>
            </button>
          </div>

          {/* Ranked Checklist Card */}
          {result.checklist.length > 0 && (
            <div className="verify-card">
              <div className="insight-section-title">
                <div>
                  <h3>Verify next</h3>
                  <p>Ranked by impact and uncertainty</p>
                </div>
                <button className="copy-checklist" type="button" onClick={copyChecklist} aria-label="Copy checklist">
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <ol className="insights-checklist">
                {result.checklist.map((item) => {
                  const isChecked = checkedIds.has(item.id);
                  return (
                    <li className={isChecked ? "is-checked" : ""} key={item.id}>
                      <button
                        type="button"
                        className="check-control"
                        aria-label={`Mark verified: ${item.action}`}
                        aria-pressed={isChecked}
                        onClick={() => onToggleCheck(item.id)}
                      >
                        {isChecked && <Check size={12} />}
                      </button>
                      <span>
                        <strong>{item.action}</strong>
                        <small>{item.where_to_verify}</small>
                      </span>
                      <b>{item.rank}</b>
                    </li>
                  );
                })}
              </ol>
              <button className="view-checklist" type="button" onClick={copyChecklist}>
                {copied ? "Copied checklist" : "Copy checklist"} <ArrowUpRight size={13} />
              </button>
            </div>
          )}

          {/* Sources Reviewed Card */}
          <div className="sources-card">
            <div className="insight-section-title">
              <div>
                <h3>Sources reviewed</h3>
                <p>{result.sources.length} sources analyzed</p>
              </div>
              <button
                type="button"
                className="sources-export"
                title="Export complete analysis JSON"
                aria-label="Export analysis JSON"
                onClick={onExportJson}
              >
                <ArrowDownToLine size={15} />
              </button>
            </div>
            {result.sources.map((source) => {
              const isOld = source.dates.cycles.some((c) => /20(2[0-4]|25)/.test(c));
              return (
                <div className="reviewed-source" key={source.id}>
                  <span className={`source-favicon ${source.isOfficial ? "official" : isOld ? "old" : ""}`}>
                    {source.isOfficial ? <ShieldCheck size={13} /> : source.title.charAt(0).toUpperCase()}
                  </span>
                  <span>
                    <strong title={source.title}>{source.title}</strong>
                    <small>{source.domain ?? (source.kind === "text" ? "Pasted text" : "Uploaded file")}</small>
                  </span>
                  <span className={`source-trust ${source.isOfficial ? "" : "muted"}`}>
                    {source.isOfficial ? "Official" : isOld ? "Outdated" : "Sourced"}
                  </span>
                </div>
              );
            })}
            <button className="show-all-sources" type="button" onClick={onOpenCoverageMap}>
              View source coverage matrix <ChevronRight size={14} />
            </button>
          </div>

          <div className="insights-footnote">
            <span className="footnote-mark">i</span>
            <p>Findings are potential gaps based on the sources reviewed, not guaranteed facts.</p>
          </div>

          <button className="coverage-mobile-cta" type="button" onClick={onOpenCoverageMap}>
            <Grid2X2 size={15} />Open coverage map <ChevronRight size={14} />
          </button>
        </>
      )}
    </section>
  );
}
