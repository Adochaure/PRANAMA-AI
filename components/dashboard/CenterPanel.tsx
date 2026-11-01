"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowDown, ArrowUp, Check, ClipboardPaste, FileText, Link2, Paperclip, Plus, Search, ShieldCheck, Sparkles, X } from "lucide-react";

type Props = { chatTitle: string; onMenu: () => void; onShowInsights: () => void };
const sampleQuestion = "What should I verify before applying for the Aarohan Merit Scholarship?";

export default function CenterPanel({ chatTitle, onMenu, onShowInsights }: Props) {
  const [question, setQuestion] = useState(sampleQuestion);
  const [status, setStatus] = useState("");
  const [sourceNames, setSourceNames] = useState(["scholarships.example.gov.in", "studyhub.example.com", "Aarohan notice 2023-24.pdf", "aggregator.example.com"]);
  const [answerVisible, setAnswerVisible] = useState(true);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function addLink(event: FormEvent) {
    event.preventDefault();
    try {
      const url = new URL(/^https?:\/\//i.test(linkValue) ? linkValue : `https://${linkValue}`);
      if (sourceNames.length >= 8) { setStatus("You can add up to 8 sources."); return; }
      setSourceNames((sources) => [...sources, url.hostname.replace(/^www\./, "")]);
      setLinkValue(""); setLinkOpen(false); setStatus("Source added to this analysis.");
    } catch { setStatus("Enter a valid web address, such as example.gov.in."); }
  }

  function send(event?: FormEvent) {
    event?.preventDefault();
    if (question.trim().length < 5) { setStatus("Add a question with at least 5 characters."); inputRef.current?.focus(); return; }
    if (!sourceNames.length) { setStatus("Add at least one source to start an analysis."); return; }
    setAnswerVisible(true); setStatus("Question ready. Connect the analysis pipeline to run a live check.");
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
        <div className="question-block"><div className="question-avatar">A</div><div className="question-content"><span className="message-meta">Your question <span>·</span> Today</span><p>{sampleQuestion}</p><div className="message-sources">{sourceNames.map((source) => <span className="mini-source" key={source}><FileText size={13} />{source}</span>)}</div></div></div>
        {answerVisible && <article className="answer-document">
          <div className="answer-byline"><span className="pramana-avatar"><Sparkles size={14} /></span><strong>Pramana</strong><span className="answer-meta">Analysis complete</span><span className="answer-label"><ShieldCheck size={13} />Evidence review</span></div>
          <p className="answer-intro">Here’s what your sources establish, where they differ, and what to verify before applying.</p>
          <div className="answer-section"><h2><span className="finding-dot gap-dot" />Missing information <span className="section-count">2</span></h2><div className="finding-line"><span className="finding-marker" /><p><strong>Renewal conditions</strong> aren’t described in the sources reviewed. The listing says “renewable” but gives no requirements. <button className="citation-link" onClick={onShowInsights}>[4]</button></p><span className="uncertain-tag">Uncertain</span></div><div className="finding-line"><span className="finding-marker" /><p><strong>Required documents</strong> may vary by applicant category. The current notice should confirm the accepted proof of income. <button className="citation-link" onClick={onShowInsights}>[1]</button></p></div></div>
          <div className="answer-section"><h2><span className="finding-dot conflict-dot" />Where sources disagree <span className="section-count">1</span></h2><div className="conflict-box"><div><span className="conflict-source">Official scholarship notice <button className="citation-link" onClick={onShowInsights}>[1]</button></span><p>Tehsildar income certificate</p></div><div><span className="conflict-source">Student blog <button className="citation-link" onClick={onShowInsights}>[2]</button></span><p>ITR copy</p></div></div></div>
          <div className="answer-section"><h2><span className="finding-dot outdated-dot" />Outdated source <span className="section-count">1</span></h2><p className="outdated-line"><span className="outdated-icon">◷</span>The 2023–24 notice has an older income limit and a deadline that has passed. <button className="citation-link" onClick={onShowInsights}>[3]</button></p></div>
          <div className="answer-section next-step-section"><h2>Verify next</h2><ol className="verify-list"><li><span className="rank-number">1</span><div><strong>Confirm renewal conditions</strong><small>Check the official scholarship portal</small></div><span className="ai-label"><i />AI-suggested</span></li><li><span className="rank-number">2</span><div><strong>Verify which income document is accepted</strong><small>Check the current official notice</small></div><span className="ai-label"><i />AI-suggested</span></li><li><span className="rank-number">3</span><div><strong>Confirm the 15 Dec 2026 deadline</strong><small>Check the official notice</small></div><span className="ai-label"><i />AI-suggested</span></li></ol></div>
          <div className="answer-footer"><span><Check size={14} />Quote checks are part of each finding</span><button onClick={onShowInsights}>Explore evidence <ArrowDown size={13} /></button></div>
        </article>}
        <div className="below-fold-hint"><span />You’re all caught up</div>
      </div>
      <div className="composer-dock">
        {linkOpen && <form className="dashboard-link-popover" onSubmit={addLink}><label htmlFor="dashboard-url">Add a source link</label><div><input id="dashboard-url" value={linkValue} onChange={(event) => setLinkValue(event.target.value)} placeholder="https://example.gov.in/page" autoFocus /><button type="submit">Add source</button></div></form>}
        <form className="dashboard-composer" onSubmit={send}>
          {!!sourceNames.length && <div className="dashboard-source-strip">{sourceNames.map((name) => <span className="dashboard-source-chip" key={name}><FileText size={13} /><span>{name}</span><button type="button" aria-label={`Remove ${name}`} onClick={() => setSourceNames((sources) => sources.filter((item) => item !== name))}><X size={12} /></button></span>)}</div>}
          <textarea ref={inputRef} value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={handleKey} rows={2} placeholder="Ask a follow-up or add a source to continue" aria-label="Ask a question" />
          <div className="dashboard-composer-bottom"><div className="composer-tools"><button type="button" className="tool-icon-button" aria-label="Upload files" title="Upload files" onClick={() => fileRef.current?.click()}><Plus size={18} /></button><button type="button" className="tool-text-button" onClick={() => setLinkOpen((open) => !open)}><Link2 size={15} /><span>Add link</span></button><button type="button" className="tool-text-button" onClick={() => setStatus("Paste text is ready to add in the next build step.")}><ClipboardPaste size={15} /><span>Paste text</span></button><button type="button" className="tool-text-button" onClick={() => setStatus("Source suggestions will be available when discovery is connected.")}><Search size={15} /><span>Suggest</span></button></div><input ref={fileRef} type="file" accept=".pdf,.txt,.md,.html" multiple hidden onChange={(event) => { if (event.target.files?.length) { setSourceNames((items) => [...items, ...Array.from(event.target.files!).slice(0, Math.max(0, 8 - items.length)).map((file) => file.name)]); setStatus("Files added to this analysis."); event.target.value = ""; } }} /><button className="dashboard-send-button" type="submit" aria-label="Send question"><span><ArrowUp size={21} strokeWidth={2.4} /></span></button></div>
        </form>
        <div className="composer-status" role="status" aria-live="polite">{status || <><Paperclip size={12} /> Sources stay in this browser during this session</>}</div>
      </div>
    </section>
  );
}
