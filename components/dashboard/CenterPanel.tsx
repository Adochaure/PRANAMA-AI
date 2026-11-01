"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowDown, ArrowUp, Check, ClipboardPaste, FileText, Link2, Paperclip, Plus, Search, ShieldCheck, Sparkles, X } from "lucide-react";
import type { AnalysisSummary } from "./Sidebar";

type SourceItem = { title: string; kind: "url" | "text" | "pdf"; url?: string; content?: string };
type Props = {
  chatTitle: string;
  activeAnalysisId: string | null;
  resetKey: number;
  userId: string;
  onSaved: (analysis: AnalysisSummary) => void;
  onMenu: () => void;
  onShowInsights: () => void;
};
const sampleQuestion = "What should I verify before applying for the Aarohan Merit Scholarship?";
const initialSources: SourceItem[] = [
  { title: "scholarships.example.gov.in", kind: "url", url: "https://scholarships.example.gov.in" },
  { title: "studyhub.example.com", kind: "url", url: "https://studyhub.example.com" },
  { title: "Aarohan notice 2023-24.pdf", kind: "pdf" },
  { title: "aggregator.example.com", kind: "url", url: "https://aggregator.example.com" },
];

export default function CenterPanel({ chatTitle, activeAnalysisId, resetKey, userId, onSaved, onMenu, onShowInsights }: Props) {
  const [question, setQuestion] = useState(sampleQuestion);
  const [status, setStatus] = useState("");
  const [sources, setSources] = useState<SourceItem[]>(initialSources);
  const [answerVisible, setAnswerVisible] = useState(true);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!activeAnalysisId) return;
    let cancelled = false;
    fetch(`/api/analyses/${activeAnalysisId}`).then(async (response) => {
      if (!response.ok) throw new Error("Could not open this saved analysis.");
      return response.json();
    }).then((payload) => {
      if (cancelled) return;
      const saved = payload.analysis as { question: string; analysis_sources?: Array<{ title: string; kind: SourceItem["kind"]; url: string | null; content: string | null }> };
      setQuestion(saved.question);
      setSources((saved.analysis_sources ?? []).map((source) => ({ title: source.title, kind: source.kind, url: source.url ?? undefined, content: source.content ?? undefined })));
      setAnswerVisible(Boolean(saved.analysis_sources?.length));
      setStatus("");
    }).catch((error: unknown) => { if (!cancelled) setStatus(error instanceof Error ? error.message : "Could not open this analysis."); });
    return () => { cancelled = true; };
  }, [activeAnalysisId]);

  useEffect(() => {
    if (resetKey === 0) return;
    setQuestion(""); setSources([]); setAnswerVisible(false); setStatus(""); setLinkOpen(false);
    inputRef.current?.focus();
  }, [resetKey]);

  function addLink(event: FormEvent) {
    event.preventDefault();
    try {
      const url = new URL(/^https?:\/\//i.test(linkValue) ? linkValue : `https://${linkValue}`);
      if (sources.length >= 8) { setStatus("You can add up to 8 sources."); return; }
      setSources((current) => [...current, { title: url.hostname.replace(/^www\./, ""), kind: "url", url: url.toString() }]);
      setLinkValue(""); setLinkOpen(false); setStatus("Source added to this analysis.");
    } catch { setStatus("Enter a valid web address, such as example.gov.in."); }
  }

  async function send(event?: FormEvent) {
    event?.preventDefault();
    if (question.trim().length < 5) { setStatus("Add a question with at least 5 characters."); inputRef.current?.focus(); return; }
    if (!sources.length) { setStatus("Add at least one source to start an analysis."); return; }
    setSaving(true); setStatus("Saving analysis…");
    try {
      const response = await fetch("/api/analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: activeAnalysisId ?? undefined,
          title: question.trim().slice(0, 72),
          question: question.trim(),
          result: null,
          sources,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not save this analysis.");
      onSaved(payload.analysis as AnalysisSummary);
      setAnswerVisible(true);
      setStatus("Analysis and sources saved to your account.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save this analysis.");
    } finally { setSaving(false); }
  }

  function handleKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); }
  }

  return (
    <section className="conversation-panel" id="workspace">
      <div className="conversation-heading">
        <div className="heading-left"><button className="conversation-menu" onClick={onMenu} aria-label="Open history"><span /><span /><span /></button><div><span className="heading-eyebrow">Analysis</span><h1>{chatTitle}</h1></div></div>
        <div className="heading-actions"><span className="sample-label"><span />Sample data</span><button className="view-insights-button" onClick={onShowInsights}>View insights <ArrowDown size={14} /></button><button className="more-button" aria-label="More analysis options"><span /><span /><span /></button></div>
      </div>
      <div className="conversation-scroll">
        {question && <div className="question-block"><div className="question-avatar">{userId.slice(0, 1).toUpperCase()}</div><div className="question-content"><span className="message-meta">Your question <span>·</span> Saved analysis</span><p>{question}</p><div className="message-sources">{sources.map((source, index) => <span className="mini-source" key={`${source.title}-${index}`}><FileText size={13} />{source.title}</span>)}</div></div></div>}
        {answerVisible && <article className="answer-document">
          <div className="answer-byline"><span className="pramana-avatar"><Sparkles size={14} /></span><strong>Pramana</strong><span className="answer-meta">Sample analysis</span><span className="answer-label"><ShieldCheck size={13} />Evidence review</span></div>
          <p className="answer-intro">Here’s what your sources establish, where they differ, and what to verify before applying.</p>
          <div className="answer-section"><h2><span className="finding-dot gap-dot" />Missing information <span className="section-count">2</span></h2><div className="finding-line"><span className="finding-marker" /><p><strong>Renewal conditions</strong> aren’t described in the sources reviewed. The listing says “renewable” but gives no requirements. <button className="citation-link" onClick={onShowInsights}>[4]</button></p><span className="uncertain-tag">Uncertain</span></div><div className="finding-line"><span className="finding-marker" /><p><strong>Required documents</strong> may vary by applicant category. The current notice should confirm the accepted proof of income. <button className="citation-link" onClick={onShowInsights}>[1]</button></p></div></div>
          <div className="answer-section"><h2><span className="finding-dot conflict-dot" />Where sources disagree <span className="section-count">1</span></h2><div className="conflict-box"><div><span className="conflict-source">Official scholarship notice <button className="citation-link" onClick={onShowInsights}>[1]</button></span><p>Tehsildar income certificate</p></div><div><span className="conflict-source">Student blog <button className="citation-link" onClick={onShowInsights}>[2]</button></span><p>ITR copy</p></div></div></div>
          <div className="answer-section"><h2><span className="finding-dot outdated-dot" />Outdated source <span className="section-count">1</span></h2><p className="outdated-line"><span className="outdated-icon">◷</span>The 2023–24 notice has an older income limit and a deadline that has passed. <button className="citation-link" onClick={onShowInsights}>[3]</button></p></div>
          <div className="answer-section next-step-section"><h2>Verify next</h2><ol className="verify-list"><li><span className="rank-number">1</span><div><strong>Confirm renewal conditions</strong><small>Check the official scholarship portal</small></div><span className="ai-label"><i />AI-suggested</span></li><li><span className="rank-number">2</span><div><strong>Verify which income document is accepted</strong><small>Check the current official notice</small></div><span className="ai-label"><i />AI-suggested</span></li><li><span className="rank-number">3</span><div><strong>Confirm the 15 Dec 2026 deadline</strong><small>Check the official notice</small></div><span className="ai-label"><i />AI-suggested</span></li></ol></div>
          <div className="answer-footer"><span><Check size={14} />Quote checks are part of each finding</span><button onClick={onShowInsights}>Explore evidence <ArrowDown size={13} /></button></div>
        </article>}
        {!answerVisible && <div className="empty-analysis"><span className="pramana-avatar"><Sparkles size={14} /></span><h2>Start with a question and sources</h2><p>Your saved analysis will appear here. Add sources, then send to save it.</p></div>}
        <div className="below-fold-hint"><span />You’re all caught up</div>
      </div>
      <div className="composer-dock">
        {linkOpen && <form className="dashboard-link-popover" onSubmit={addLink}><label htmlFor="dashboard-url">Add a source link</label><div><input id="dashboard-url" value={linkValue} onChange={(event) => setLinkValue(event.target.value)} placeholder="https://example.gov.in/page" autoFocus /><button type="submit">Add source</button></div></form>}
        <form className="dashboard-composer" onSubmit={send}>
          {!!sources.length && <div className="dashboard-source-strip">{sources.map((source, index) => <span className="dashboard-source-chip" key={`${source.title}-${index}`}><FileText size={13} /><span>{source.title}</span><button type="button" aria-label={`Remove ${source.title}`} onClick={() => setSources((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X size={12} /></button></span>)}</div>}
          <textarea ref={inputRef} value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={handleKey} rows={2} placeholder="Ask a follow-up or add a source to continue" aria-label="Ask a question" />
          <div className="dashboard-composer-bottom"><div className="composer-tools"><button type="button" className="tool-icon-button" aria-label="Upload files" title="Upload files" onClick={() => fileRef.current?.click()}><Plus size={18} /></button><button type="button" className="tool-text-button" onClick={() => setLinkOpen((open) => !open)}><Link2 size={15} /><span>Add link</span></button><button type="button" className="tool-text-button" onClick={() => setStatus("Paste text is ready to add in the next build step.")}><ClipboardPaste size={15} /><span>Paste text</span></button><button type="button" className="tool-text-button" onClick={() => setStatus("Source suggestions will be available when discovery is connected.")}><Search size={15} /><span>Suggest</span></button></div><input ref={fileRef} type="file" accept=".pdf,.txt,.md,.html" multiple hidden onChange={(event) => { if (event.target.files?.length) { const files = Array.from(event.target.files).slice(0, Math.max(0, 8 - sources.length)); setSources((items) => [...items, ...files.map((file) => ({ title: file.name, kind: file.name.toLowerCase().endsWith(".pdf") ? "pdf" as const : "text" as const }))]); setStatus("Files added to this analysis."); event.target.value = ""; } }} /><button className="dashboard-send-button" type="submit" aria-label="Send question" disabled={saving}><span><ArrowUp size={21} strokeWidth={2.4} /></span></button></div>
        </form>
        <div className="composer-status" role="status" aria-live="polite">{status || <><Paperclip size={12} /> Sources save to your Supabase account</>}</div>
      </div>
    </section>
  );
}
