"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, ClipboardPaste, FileText, Link2, List, Plus, Search, X } from "lucide-react";

type Source = { id: string; kind: "url" | "file" | "text"; name: string; file?: File };
const MAX_SOURCES = 8;
const ACCEPTED = ".pdf,.txt,.md,.html";
const DEMO_QUESTION = "What should I verify before applying for the Aarohan Merit Scholarship?";

function sourceName(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return url; }
}

function normalizeUrl(raw: string) {
  const value = raw.trim();
  if (!value) return "";
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function extractUrls(value: string) {
  return value.match(/(?:https?:\/\/|www\.)[^\s<>]+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s<>]*)?/gi) ?? [];
}

export default function LandingPage() {
  const [question, setQuestion] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [status, setStatus] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteValue, setPasteValue] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function resizeQuestion() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const maxHeight = window.matchMedia("(max-width: 760px)").matches ? 320 : 220;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }

  useEffect(() => { requestAnimationFrame(resizeQuestion); }, [question]);

  function addSource(source: Source) {
    if (sources.length >= MAX_SOURCES) { setStatus("You can add up to 8 sources."); return false; }
    setSources((current) => [...current, source]); setStatus(""); return true;
  }

  function addFiles(files: FileList | File[]) {
    const incoming = Array.from(files).filter((file) => /\.(pdf|txt|md|html)$/i.test(file.name));
    const room = MAX_SOURCES - sources.length;
    const accepted = incoming.slice(0, room);
    setSources((current) => [...current, ...accepted.map((file) => ({ id: crypto.randomUUID(), kind: "file" as const, name: file.name, file }))]);
    setStatus(incoming.length > room ? "You can add up to 8 sources." : incoming.length < files.length ? "Choose a PDF, text, Markdown or HTML file." : "");
  }

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (question.trim().length < 5) { setStatus("Add a question with at least 5 characters."); textareaRef.current?.focus(); return; }
    if (!sources.length) { setStatus("You haven't added sources yet. Choose Suggest sources to find pages to start from."); return; }
    setStatus("Your question and sources are ready for analysis.");
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); }
  }

  function onQuestionChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const input = event.target.value;
    const found = extractUrls(input);
    if (!found.length) { setQuestion(input); return; }
    const available = Math.max(0, MAX_SOURCES - sources.length);
    const picked = found.slice(0, available);
    const remaining = found.slice(available);
    let text = input;
    for (const url of picked) text = text.replace(url, "");
    if (picked.length) setSources((current) => [...current, ...picked.map((url) => ({ id: crypto.randomUUID(), kind: "url" as const, name: sourceName(normalizeUrl(url)) }))]);
    setQuestion(remaining.length ? text.trim() : text.replace(/\s{2,}/g, " ").trim());
    setStatus(remaining.length ? "You can add up to 8 sources." : "");
  }

  function submitLink(event: FormEvent) {
    event.preventDefault();
    const url = normalizeUrl(linkValue);
    try {
      const parsed = new URL(url);
      if (!/^https?:$/.test(parsed.protocol)) throw new Error();
      if (addSource({ id: crypto.randomUUID(), kind: "url", name: parsed.hostname.replace(/^www\./, "") })) { setLinkValue(""); setLinkOpen(false); setStatus("Source added."); }
    } catch { setStatus("Enter a valid web address, such as example.gov.in."); }
  }

  function submitPaste(event: FormEvent) {
    event.preventDefault();
    const content = pasteValue.trim();
    if (!content) { setStatus("Paste the source text before adding it."); return; }
    if (addSource({ id: crypto.randomUUID(), kind: "text", name: pasteTitle.trim() || content.slice(0, 42) })) { setPasteValue(""); setPasteTitle(""); setPasteOpen(false); setStatus("Source added."); }
  }

  function loadSample() {
    setQuestion(DEMO_QUESTION);
    setSources([
      { id: crypto.randomUUID(), kind: "url", name: "scholarships.example.gov.in" },
      { id: crypto.randomUUID(), kind: "url", name: "studyhub.example.com" },
      { id: crypto.randomUUID(), kind: "file", name: "Aarohan notice 2023-24.pdf" },
      { id: crypto.randomUUID(), kind: "url", name: "aggregator.example.com" },
    ]);
    setStatus("Sample question and sources added."); textareaRef.current?.focus();
  }

  const menu = <>
    <a href="#how-it-works" onClick={() => setMobileOpen(false)}>How it works</a>
    <button type="button" onClick={() => { loadSample(); setMobileOpen(false); }}>Sample</button>
    <a className="github-link" href="https://github.com" target="_blank" rel="noreferrer" onClick={() => setMobileOpen(false)}><svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8 .7a7.3 7.3 0 0 0-2.3 14.2c.36.07.5-.16.5-.35v-1.27c-2.03.44-2.46-.86-2.46-.86-.33-.84-.81-1.06-.81-1.06-.66-.45.05-.44.05-.44.73.05 1.11.75 1.11.75.65 1.1 1.7.78 2.12.6.06-.47.25-.78.46-.96-1.62-.18-3.33-.81-3.33-3.6 0-.8.29-1.45.75-1.96-.08-.18-.33-.93.07-1.94 0 0 .61-.2 2 .75a6.9 6.9 0 0 1 3.64 0c1.39-.94 2-.75 2-.75.4 1.01.15 1.76.07 1.94.47.51.75 1.16.75 1.96 0 2.8-1.71 3.42-3.34 3.6.26.22.49.66.49 1.33v1.96c0 .2.13.42.5.35A7.3 7.3 0 0 0 8 .7Z" /></svg><span>GitHub</span></a>
  </>;

  return <>
    <header className="topbar">
      <a className="brand" href="#top" aria-label="Pramana home"><Image src="/pramana_logo.webp" alt="" width={224} height={48} priority className="border rounded-sm" /><span>Pramana</span></a>
      <nav className="desktop-nav" aria-label="Main navigation">{menu}</nav>
      <button className="mobile-menu-button" aria-label="Open navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen((open) => !open)}>{mobileOpen ? <X size={19} /> : <List size={19} />}</button>
      {mobileOpen && <nav className="mobile-nav" aria-label="Mobile navigation">{menu}</nav>}
    </header>
    <main id="top">
      <section className="hero" aria-labelledby="hero-title">
        <span className="hero-pillar hero-pillar-left" aria-hidden="true" /><span className="hero-pillar hero-pillar-right" aria-hidden="true" /><span className="hero-pillar hero-pillar-center" aria-hidden="true" />
        <h1 id="hero-title">What do you want to be <span className="hero-title-accent">sure about?</span></h1>
        <p className="subtitle">Add your sources and Pramana shows what&apos;s missing, what conflicts, and what&apos;s outdated.</p>
        <div className="composer-wrap">
          <form className="composer" onSubmit={submit}>
            <div className={`source-strip ${sources.length ? "has-items" : ""}`} aria-label="Attached sources">{sources.map((source) => <div className="source-chip" key={source.id} title={source.name}>{source.kind === "url" ? <Link2 size={15} /> : source.kind === "text" ? <ClipboardPaste size={15} /> : <FileText size={15} />}<span>{source.name}</span><button type="button" aria-label={`Remove ${source.name}`} onClick={() => setSources((all) => all.filter((item) => item.id !== source.id))}><X size={14} /></button></div>)}</div>
            {linkOpen && <form className="mobile-link-popover" onSubmit={submitLink}><label htmlFor="mobile-source-url">Source URL</label><div className="link-entry"><input id="mobile-source-url" type="url" placeholder="https://example.gov.in/page" value={linkValue} onChange={(event) => setLinkValue(event.target.value)} autoFocus /><button type="submit">Add source</button></div></form>}
            <textarea ref={textareaRef} value={question} onChange={(event) => { onQuestionChange(event); requestAnimationFrame(resizeQuestion); }} onKeyDown={onKeyDown} rows={1} placeholder="Ask a question, then add the sources you're relying on" aria-label="Your question" />
            <div className="composer-footer"><div className="composer-actions"><button type="button" className="add-button upload-trigger" aria-label="Upload source files" title="Upload source files" onClick={() => fileRef.current?.click()}><Plus size={20} /></button><button type="button" className="add-button mobile-source-action" aria-label="Add a link" title="Add a link" onClick={() => { setLinkOpen((open) => !open); setPasteOpen(false); }}><Link2 size={18} /></button><button type="button" className="add-button mobile-source-action" aria-label="Suggest sources" title="Suggest sources" onClick={() => setStatus(question.trim().length < 5 ? "Add a question first, then suggest pages to check." : "Source suggestions will be available when analysis is connected.")}><Search size={18} /></button></div>
              <input ref={fileRef} className="file-input" type="file" multiple accept={ACCEPTED} onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = ""; }} />
              <button className="send-button" type="submit" aria-label="Send question" title="Send question"><span className="send-arrow"><ArrowUp size={24} strokeWidth={2.4} /></span></button>
            </div>
          </form>
          <div className="status" role="status" aria-live="polite">{status}</div>
          <div className="option-row">
            <div className="popover-anchor"><button className="text-action" type="button" onClick={() => { setLinkOpen((open) => !open); setPasteOpen(false); }}><Link2 size={17} />Add link</button>{linkOpen && <form className="link-popover" onSubmit={submitLink}><label htmlFor="source-url">Source URL</label><div className="link-entry"><input id="source-url" ref={linkRef} type="url" placeholder="https://example.gov.in/page" value={linkValue} onChange={(event) => setLinkValue(event.target.value)} autoFocus /><button type="submit">Add source</button></div></form>}</div>
            <button className="text-action" type="button" onClick={() => fileRef.current?.click()}><FileText size={17} />Upload files</button><button className="text-action" type="button" onClick={() => { setPasteOpen(true); setLinkOpen(false); }}><ClipboardPaste size={17} />Paste text</button><button className="text-action" type="button" onClick={() => setStatus(question.trim().length < 5 ? "Add a question first, then suggest pages to check." : "Source suggestions will be available when analysis is connected.")}><Search size={17} />Suggest sources</button>
          </div>
          <div className="examples"><button className="sample-capsule" type="button" onClick={loadSample}>Try the sample scholarship</button><button className="example-capsule" type="button" onClick={() => { setQuestion("What should I verify on this admission page?"); textareaRef.current?.focus(); }}>Check an admission page</button><button className="example-capsule" type="button" onClick={() => { setQuestion("What should I verify before applying for this government scheme?"); textareaRef.current?.focus(); }}>Review a government scheme</button></div>
          <p className="note">Findings are potential gaps based on your sources, not guaranteed facts.</p>
        </div>
      </section>
      <section className="how" id="how-it-works" aria-labelledby="how-title"><h2 id="how-title">How it works</h2><div className="how-step"><span>1</span><p><strong>Ask.</strong> Type the question you need answered and add the pages or files you&apos;re relying on.</p></div><div className="how-step"><span>2</span><p><strong>Compare.</strong> Pramana works out what a complete answer needs, then checks each source against it, quote by quote.</p></div><div className="how-step"><span>3</span><p><strong>Verify.</strong> See what&apos;s missing, where sources disagree, what&apos;s outdated, and what to confirm next.</p></div></section>
    </main>
    <footer><span>Built for the Shinchan Online Hackathon 2026.</span><a href="https://github.com" target="_blank" rel="noreferrer">GitHub</a></footer>
    {pasteOpen && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPasteOpen(false); }}><form className="paste-dialog" role="dialog" aria-modal="true" aria-labelledby="paste-title" onSubmit={submitPaste}><button className="dialog-close" type="button" aria-label="Close" onClick={() => setPasteOpen(false)}><X size={18} /></button><h2 id="paste-title">Paste source text</h2><label htmlFor="paste-name">Title <span>(optional)</span></label><input id="paste-name" value={pasteTitle} onChange={(event) => setPasteTitle(event.target.value)} placeholder="Name this source" /><label htmlFor="paste-content">Source text</label><textarea id="paste-content" value={pasteValue} onChange={(event) => setPasteValue(event.target.value)} placeholder="Paste the text you want Pramana to check" autoFocus /><button className="primary-action" type="submit">Add source</button></form></div>}
  </>;
}
