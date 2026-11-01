"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  ClipboardPaste,
  Clock3,
  Copy,
  FileText,
  Link2,
  LoaderCircle,
  Map as MapIcon,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import type { AnalysisResult, Claim, SuggestedSource } from "@/lib/schemas";

type SourceItem = {
  id: string;
  kind: "url" | "text" | "pdf";
  title: string;
  url?: string;
  text?: string;
  filename?: string;
  fileBase64?: string;
};

type Props = {
  chatTitle: string;
  activeAnalysisId?: string | null;
  resetKey: number;
  userId?: string;
  result: AnalysisResult | null;
  loading: boolean;
  statusLine: string;
  error: string;
  isSample: boolean;
  checkedIds: Set<string>;
  onToggleCheck: (id: string) => void;
  onOpenCoverageMap: () => void;
  onOpenClaim: (claim: Claim) => void;
  onRunAnalysis: (question: string, sources: SourceItem[], isSample?: boolean) => Promise<void>;
  onFollowUpRenewalDemo?: () => void;
  onMenu: () => void;
  onShowInsights: () => void;
};

const MAX_SOURCES = 8;
const ACCEPTED_FILES = ".pdf,.txt,.md,.html";

function fileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      const comma = dataUrl.indexOf(",");
      if (comma < 0) reject(new Error(`Could not read ${file.name}.`));
      else resolve(dataUrl.slice(comma + 1));
    };
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function normalizeUrl(raw: string) {
  const value = raw.trim();
  if (!value) return "";
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function sourceHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function CenterPanel({
  chatTitle,
  resetKey,
  result,
  loading,
  statusLine,
  error,
  isSample,
  checkedIds,
  onToggleCheck,
  onOpenCoverageMap,
  onOpenClaim,
  onRunAnalysis,
  onFollowUpRenewalDemo,
  onMenu,
  onShowInsights,
}: Props) {
  const [question, setQuestion] = useState("");
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [status, setStatus] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteValue, setPasteValue] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedSource[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestNote, setSuggestNote] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const gaps = (result?.findings ?? []).filter((f) => f.type === "gap");
  const conflicts = (result?.findings ?? []).filter((f) => f.type === "conflict");
  const outdated = (result?.findings ?? []).filter((f) => f.type === "outdated");
  const aspectById = new Map((result?.aspects ?? []).map((a) => [a.id, a]));
  const sourceById = new Map((result?.sources ?? []).map((s) => [s.id, s]));
  const claimById = new Map((result?.claims ?? []).map((c) => [c.id, c]));

  const hasRenewalGap = gaps.some((g) => g.aspectId === "renewal_conditions");

  function resizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = 180;
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  }

  useEffect(() => {
    requestAnimationFrame(resizeTextarea);
  }, [question]);

  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setQuestion("");
    setSources([]);
    setStatus("");
    setLinkOpen(false);
    setPasteOpen(false);
    setSuggestOpen(false);
  }

  function addSource(item: SourceItem) {
    if (sources.length >= MAX_SOURCES) {
      setStatus("You can add up to 8 sources.");
      return false;
    }
    setSources((curr) => [...curr, item]);
    setStatus("Source added.");
    return true;
  }

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files);
    const valid = list.filter((f) => /\.(pdf|txt|md|html?)$/i.test(f.name));
    const room = Math.max(0, MAX_SOURCES - sources.length);
    const accepted = valid.slice(0, room);

    for (const file of accepted) {
      if (/\.pdf$/i.test(file.name)) {
        try {
          const b64 = await fileAsBase64(file);
          addSource({
            id: crypto.randomUUID(),
            kind: "pdf",
            title: file.name,
            filename: file.name,
            fileBase64: b64,
          });
        } catch {
          setStatus(`Could not read ${file.name}.`);
        }
      } else {
        const text = await file.text();
        addSource({
          id: crypto.randomUUID(),
          kind: "text",
          title: file.name,
          text,
        });
      }
    }
  }

  function submitLink(e: FormEvent) {
    e.preventDefault();
    const url = normalizeUrl(linkValue);
    try {
      const parsed = new URL(url);
      if (!/^https?:$/.test(parsed.protocol)) throw new Error();
      if (addSource({
        id: crypto.randomUUID(),
        kind: "url",
        title: sourceHost(url),
        url: parsed.href,
      })) {
        setLinkValue("");
        setLinkOpen(false);
      }
    } catch {
      setStatus("Enter a valid URL (e.g. scholarships.gov.in)");
    }
  }

  function submitPaste(e: FormEvent) {
    e.preventDefault();
    const val = pasteValue.trim();
    if (!val) {
      setStatus("Paste source text first.");
      return;
    }
    if (addSource({
      id: crypto.randomUUID(),
      kind: "text",
      title: pasteTitle.trim() || val.slice(0, 36),
      text: val,
    })) {
      setPasteTitle("");
      setPasteValue("");
      setPasteOpen(false);
    }
  }

  async function fetchSuggestions() {
    setSuggestOpen(true);
    setSuggestLoading(true);
    setSuggestNote("");
    try {
      const activeQ = question.trim() || result?.question || "Scholarship eligibility and renewal requirements";
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: activeQ, aspects: result?.aspects }),
      });
      const data = await res.json() as { sources?: SuggestedSource[]; suggestions?: SuggestedSource[]; error?: string; note?: string };
      const suggestedSources = data.sources ?? data.suggestions;
      if (suggestedSources) {
        setSuggestions(suggestedSources);
        if (data.note) setSuggestNote(data.note);
      } else if (data.error) {
        setStatus(data.error);
      }
    } catch {
      setStatus("Could not load suggestions.");
    } finally {
      setSuggestLoading(false);
    }
  }

  function addSuggestedSource(s: SuggestedSource) {
    addSource({
      id: crypto.randomUUID(),
      kind: "url",
      title: s.title,
      url: s.url,
    });
    setSuggestions((curr) => curr.filter((item) => item.url !== s.url));
  }

  async function handleSend(e?: FormEvent) {
    e?.preventDefault();
    const q = question.trim();
    if (q.length < 5) {
      setStatus("Add a question with at least 5 characters.");
      textareaRef.current?.focus();
      return;
    }
    if (!sources.length) {
      setStatus("Add at least one source before starting analysis.");
      return;
    }
    if (loading) return;

    setStatus("");
    await onRunAnalysis(q, sources, false);
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  }

  async function copyChecklist() {
    if (!result?.checklist?.length) return;
    const content = result.checklist
      .map((item) => `${item.rank}. ${item.action}\n   ${item.reason}\n   Check: ${item.where_to_verify}`)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(content);
      setCopyStatus("Checklist copied to clipboard");
    } catch {
      setCopyStatus("Clipboard access denied");
    }
    window.setTimeout(() => setCopyStatus(""), 2400);
  }

  return (
    <section className="conversation-panel" id="workspace">
      {/* Top Heading */}
      <div className="conversation-heading">
        <div className="heading-left">
          <button className="conversation-menu" type="button" onClick={onMenu} aria-label="Open history">
            <span /><span /><span />
          </button>
          <div>
            <span className="heading-eyebrow">Pramana Research</span>
            <h1>{chatTitle}</h1>
          </div>
        </div>
        <div className="heading-actions">
          {isSample && <span className="sample-label"><span />Sample replay</span>}
          <button className="view-insights-button" type="button" onClick={onShowInsights}>
            View insights <ArrowDown size={14} />
          </button>
        </div>
      </div>

      {/* Main Scrollable Document Area */}
      <div className="conversation-scroll">
        {/* Loading Progress */}
        {loading && (
          <div className="analysis-status-line" style={{ margin: "20px 0" }}>
            <LoaderCircle size={17} className="analysis-spinner" />
            <span>{statusLine || "Reading sources and checking quote evidence…"}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="analysis-error" role="alert" style={{ margin: "16px 0" }}>
            <AlertTriangle size={17} />
            <span>{error}</span>
          </div>
        )}

        {/* Follow-up renewal banner for sample replay */}
        {isSample && hasRenewalGap && onFollowUpRenewalDemo && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              padding: "12px 16px",
              margin: "12px 0 20px",
              border: "1px solid #c3cae6",
              borderRadius: "10px",
              background: "#f0f3fd",
            }}
          >
            <div>
              <strong style={{ fontSize: "12px", color: "#001a9c", display: "block" }}>
                Interactive Demo: Close the Renewal Gap
              </strong>
              <small style={{ fontSize: "11px", color: "#4b5563" }}>
                Notice the missing renewal requirements below. Click to simulate adding the official Renewal FAQ.
              </small>
            </div>
            <button
              type="button"
              onClick={onFollowUpRenewalDemo}
              style={{
                flex: "0 0 auto",
                padding: "8px 14px",
                border: 0,
                borderRadius: "7px",
                background: "#001a9c",
                color: "#fff",
                fontSize: "11px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Add Renewal FAQ →
            </button>
          </div>
        )}

        {/* If Active Result Exists, render full document */}
        {result && (
          <article className="analysis-document" aria-live="polite">
            <header className="analysis-summary">
              <div
                className="score-ring"
                style={{ "--score": `${result.score.completeness * 3.6}deg` } as React.CSSProperties}
              >
                <div>
                  <strong>{result.score.completeness}</strong>
                  <small>%</small>
                </div>
              </div>
              <div className="analysis-summary-copy">
                <h1>Verified evidence summary</h1>
                <p>
                  Sources confirm {result.score.completeness}% of the required knowledge for this question.
                </p>
              </div>
            </header>

            <div className="finding-counts">
              <span><b>{gaps.length}</b> missing</span>
              <span><b>{conflicts.length}</b> {conflicts.length === 1 ? "conflict" : "conflicts"}</span>
              <span><b>{outdated.length}</b> outdated</span>
            </div>

            {result.discardedClaims > 0 && (
              <p className="discarded-note">
                {result.discardedClaims} unsupported {result.discardedClaims === 1 ? "claim was" : "claims were"} discarded
                because verbatim quote verification failed.
              </p>
            )}

            {/* Gaps / Missing Section */}
            {gaps.length > 0 && (
              <section className="analysis-section">
                <h2>Missing information</h2>
                <ul className="missing-list">
                  {gaps.map((f) => (
                    <li key={f.id}>
                      <span>
                        <strong>{aspectById.get(f.aspectId)?.label || f.title}</strong>
                        <small>{f.explanation}</small>
                      </span>
                      {(f.evidence?.length ?? 0) > 0 && (
                        <div className="finding-citations">
                          {f.evidence.map((ev) => {
                            const claim = claimById.get(ev.claimId);
                            if (!claim) return null;
                            const idx = (result.claims ?? []).findIndex((c) => c.id === claim.id) + 1;
                            return (
                              <button
                                key={ev.claimId}
                                type="button"
                                onClick={() => onOpenClaim(claim)}
                                aria-label={`Open citation [${idx}]`}
                              >
                                [{idx}]
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Conflicts / Where Sources Disagree */}
            {conflicts.length > 0 && (
              <section className="analysis-section">
                <h2>Where sources disagree</h2>
                {conflicts.map((f) => (
                  <div className="source-conflict" key={f.id}>
                    <h3>{aspectById.get(f.aspectId)?.label || f.title}</h3>
                    <p>{f.explanation}</p>
                    <div className="conflict-evidence-grid">
                      {(f.evidence ?? []).slice(0, 2).map((ev) => {
                        const claim = claimById.get(ev.claimId);
                        const source = sourceById.get(ev.sourceId);
                        if (!claim || !source) return null;
                        const idx = (result.claims ?? []).findIndex((c) => c.id === claim.id) + 1;
                        return (
                          <button
                            className="conflict-evidence"
                            type="button"
                            key={ev.claimId}
                            onClick={() => onOpenClaim(claim)}
                          >
                            <span>
                              {claim.statement} <b>[{idx}]</b>
                            </span>
                            <small>{source.title}</small>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </section>
            )}

            {/* Outdated Section */}
            {outdated.length > 0 && (
              <section className="analysis-section">
                <h2>Outdated information</h2>
                <ul className="outdated-list">
                  {outdated.map((f) => (
                    <li key={f.id}>
                      <Clock3 size={16} />
                      <span>
                        <strong>{f.title}</strong>
                        <small>{f.explanation}</small>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Verify Next Checklist */}
            {(result.checklist?.length ?? 0) > 0 && (
              <section className="analysis-section verify-section">
                <div className="verify-heading">
                  <div>
                    <h2>Verify next</h2>
                    <p>Ranked checklist of highest-impact items to confirm.</p>
                  </div>
                  <button className="copy-checklist-button" type="button" onClick={copyChecklist}>
                    <Copy size={13} />Copy checklist
                  </button>
                </div>
                <ol className="conversation-checklist">
                  {result.checklist.map((item) => {
                    const checked = checkedIds.has(item.id);
                    return (
                      <li className={checked ? "is-checked" : ""} key={item.id}>
                        <button
                          type="button"
                          className="conversation-checkbox"
                          aria-label={`Mark complete: ${item.action}`}
                          aria-pressed={checked}
                          onClick={() => onToggleCheck(item.id)}
                        >
                          {checked && <Check size={13} />}
                        </button>
                        <span className="checklist-rank">{item.rank}.</span>
                        <div>
                          <strong>{item.action}</strong>
                          <small>{item.reason}</small>
                          <small className="verify-where">Check: {item.where_to_verify}</small>
                        </div>
                        <span className="ai-suggested-label">AI-suggested</span>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}

            {/* Action Bar */}
            <div className="analysis-actions">
              <button type="button" onClick={onOpenCoverageMap}>
                <MapIcon size={15} />View coverage map
              </button>
              <button type="button" onClick={() => setLinkOpen(true)}>
                <Plus size={15} />Add a source
              </button>
              <button type="button" onClick={() => fetchSuggestions()}>
                <Search size={15} />Suggest sources
              </button>
              <button type="button" onClick={copyChecklist}>
                <Copy size={15} />Copy checklist
              </button>
            </div>

            {copyStatus && <p className="copy-feedback" role="status">{copyStatus}</p>}

            {/* Source Warnings */}
            {(result.warnings?.length ?? 0) > 0 && (
              <details className="analysis-warnings">
                <summary>Source notes ({result.warnings?.length ?? 0})</summary>
                <ul>
                  {result.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </details>
            )}
            <p className="analysis-caveat">
              Findings highlight what is supported or missing across reviewed sources; they are not guaranteed facts.
            </p>
          </article>
        )}

        {/* Empty State */}
        {!result && !loading && (
          <div className="empty-analysis" style={{ padding: "40px 16px" }}>
            <span className="pramana-avatar" style={{ margin: "0 auto 16px" }}>
              <Sparkles size={20} />
            </span>
            <h2>What do you want to be sure about?</h2>
            <p style={{ maxWidth: "480px", margin: "8px auto 24px", color: "#6b7280" }}>
              Ask a question and attach your pages, documents, or notes. Pramana works out what a complete answer needs
              and checks each source quote by quote.
            </p>
            <div className="examples" style={{ justifyContent: "center", marginBottom: "20px" }}>
              <button
                className="sample-capsule"
                type="button"
                onClick={() => onRunAnalysis("What are the eligibility and application requirements for the Surya Scholars Grant?", [], true)}
              >
                Try the sample scholarship
              </button>
              <button
                className="example-capsule"
                type="button"
                onClick={() => {
                  setQuestion("What should I verify on this admission page?");
                  textareaRef.current?.focus();
                }}
              >
                Check an admission page
              </button>
              <button
                className="example-capsule"
                type="button"
                onClick={() => {
                  setQuestion("What should I verify before applying for this government scheme?");
                  textareaRef.current?.focus();
                }}
              >
                Review a government scheme
              </button>
            </div>
          </div>
        )}

        {/* Inline Suggest Sources Drawer */}
        {suggestOpen && (
          <div
            style={{
              margin: "18px 0",
              padding: "16px",
              border: "1px solid #d1d5db",
              borderRadius: "10px",
              background: "#fafbfc",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div>
                <strong style={{ fontSize: "13px", color: "#111827" }}>Suggested authoritative sources</strong>
                {suggestNote && <span style={{ display: "block", fontSize: "11px", color: "#6b7280" }}>{suggestNote}</span>}
              </div>
              <button
                type="button"
                onClick={() => setSuggestOpen(false)}
                style={{ background: "transparent", border: 0, cursor: "pointer", color: "#6b7280" }}
              >
                <X size={16} />
              </button>
            </div>

            {suggestLoading && (
              <div style={{ padding: "16px", textAlign: "center", color: "#6b7280", fontSize: "12px" }}>
                <LoaderCircle size={18} className="analysis-spinner" style={{ margin: "0 auto 8px" }} />
                Searching for authoritative sources…
              </div>
            )}

            <div style={{ display: "grid", gap: "8px" }}>
              {suggestions.map((s) => (
                <div
                  key={s.url}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    padding: "10px 12px",
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <strong style={{ fontSize: "12px", color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.title}
                      </strong>
                      {s.officialGuess && (
                        <span style={{ fontSize: "10px", padding: "1px 5px", background: "#ecfdf5", color: "#065f46", borderRadius: "4px" }}>
                          Likely official
                        </span>
                      )}
                    </div>
                    <small style={{ fontSize: "11px", color: "#6b7280", display: "block" }}>{s.domain}</small>
                    <p style={{ fontSize: "11px", color: "#4b5563", margin: "2px 0 0", lineHeight: "14px" }}>{s.snippet}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addSuggestedSource(s)}
                    style={{
                      flex: "0 0 auto",
                      padding: "6px 12px",
                      border: "1px solid #001a9c",
                      borderRadius: "6px",
                      background: "#fff",
                      color: "#001a9c",
                      fontSize: "11px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    + Add source
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Composer Dock at bottom */}
      <div className="composer-dock">
        {linkOpen && (
          <form className="dashboard-link-popover" onSubmit={submitLink}>
            <label htmlFor="dashboard-url">Add a source link</label>
            <div>
              <input
                id="dashboard-url"
                value={linkValue}
                onChange={(e) => setLinkValue(e.target.value)}
                placeholder="https://scholarships.example.gov.in/notice"
                autoFocus
              />
              <button type="submit">Add source</button>
            </div>
          </form>
        )}

        <form className="dashboard-composer" onSubmit={handleSend}>
          {sources.length > 0 && (
            <div className="dashboard-source-strip">
              {sources.map((s, idx) => (
                <span className="dashboard-source-chip" key={s.id || idx}>
                  <FileText size={13} />
                  <span>{s.title}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${s.title}`}
                    onClick={() => setSources((curr) => curr.filter((_, i) => i !== idx))}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKey}
            rows={1}
            placeholder={result ? "Ask a follow-up or add sources to update analysis" : "Ask a question, then add the sources you're relying on"}
            aria-label="Ask a question"
          />

          <div className="dashboard-composer-bottom">
            <div className="composer-tools">
              <button
                type="button"
                className="tool-icon-button"
                aria-label="Upload source file"
                title="Upload PDF, HTML, or text files"
                onClick={() => fileRef.current?.click()}
              >
                <Plus size={18} />
              </button>
              <button
                type="button"
                className="tool-text-button"
                onClick={() => setLinkOpen((o) => !o)}
              >
                <Link2 size={15} /><span>Add link</span>
              </button>
              <button
                type="button"
                className="tool-text-button"
                onClick={() => setPasteOpen(true)}
              >
                <ClipboardPaste size={15} /><span>Paste text</span>
              </button>
              <button
                type="button"
                className="tool-text-button"
                onClick={() => fetchSuggestions()}
              >
                <Search size={15} /><span>Suggest</span>
              </button>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED_FILES}
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) handleFiles(e.target.files);
                e.target.value = "";
              }}
            />

            <button
              className="dashboard-send-button"
              type="submit"
              aria-label="Send question"
              disabled={loading}
            >
              <span><ArrowUp size={21} strokeWidth={2.4} /></span>
            </button>
          </div>
        </form>

        <div className="composer-status" role="status" aria-live="polite">
          {status || (result ? "Add sources or ask follow-ups to expand proof matrix" : "Analyses automatically save to your Supabase account")}
        </div>
      </div>

      {/* Paste Dialog */}
      {pasteOpen && (
        <div
          className="dialog-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPasteOpen(false);
          }}
        >
          <form
            className="paste-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="paste-dialog-title"
            onSubmit={submitPaste}
          >
            <button
              className="dialog-close"
              type="button"
              aria-label="Close"
              onClick={() => setPasteOpen(false)}
            >
              <X size={18} />
            </button>
            <h2 id="paste-dialog-title">Paste source text</h2>
            <label htmlFor="paste-dialog-name">Title <span>(optional)</span></label>
            <input
              id="paste-dialog-name"
              value={pasteTitle}
              onChange={(e) => setPasteTitle(e.target.value)}
              placeholder="Source name or description"
            />
            <label htmlFor="paste-dialog-text">Source text</label>
            <textarea
              id="paste-dialog-text"
              value={pasteValue}
              onChange={(e) => setPasteValue(e.target.value)}
              placeholder="Paste the official notice, policy document, or text here"
              autoFocus
            />
            <button className="primary-action" type="submit">Add source</button>
          </form>
        </div>
      )}
    </section>
  );
}
