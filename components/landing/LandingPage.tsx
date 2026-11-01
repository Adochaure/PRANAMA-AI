"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, ChevronDown, ClipboardPaste, FileText, LayoutDashboard, Link2, List, LogOut, Plus, Search, X } from "lucide-react";
import { AnalysisConversation } from "@/components/conversation/AnalysisConversation";
import { AnalysisResult as AnalysisResultSchema, StreamEvent as StreamEventSchema, type AnalysisResult, type StreamEvent } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/client";

type LocalSource = { id: string; kind: "url" | "file" | "text"; name: string; url?: string; text?: string; file?: File };
type RequestSource = { id: string; kind: "url" | "pdf" | "text"; title: string; url?: string; text?: string; filename?: string; fileBase64?: string };
const MAX_SOURCES = 8;
const MAX_FILE_BYTES = 1_800_000;
const ACCEPTED = ".pdf,.txt,.md,.html";
const DEMO_QUESTION = "What are the eligibility and application requirements for the Surya Scholars Grant?";
const SAMPLE_SOURCES = [
  { id: "sample-official", kind: "url" as const, name: "Surya Scholars Grant — Official Notice" },
  { id: "sample-blog", kind: "url" as const, name: "How to apply for the Surya Scholars Grant" },
  { id: "sample-old", kind: "url" as const, name: "Surya Scholars Grant — Archived Notice" },
  { id: "sample-aggregator", kind: "url" as const, name: "Surya Scholars Grant summary" },
];

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

async function makeRequestSources(sources: LocalSource[]): Promise<RequestSource[]> {
  return Promise.all(sources.map(async (source) => {
    if (source.kind === "url") return { id: source.id, kind: "url", url: source.url, title: source.name };
    if (source.kind === "text") return { id: source.id, kind: "text", text: source.text, title: source.name };
    const file = source.file;
    if (!file) throw new Error(`The file ${source.name} is no longer available. Add it again.`);
    if (file.size > MAX_FILE_BYTES) throw new Error(`${source.name} is larger than 1.8 MB. Choose a smaller file.`);
    if (/\.pdf$/i.test(file.name)) return { id: source.id, kind: "pdf", filename: file.name, title: file.name, fileBase64: await fileAsBase64(file) };
    let text = await file.text();
    if (/\.html?$/i.test(file.name)) {
      const document = new DOMParser().parseFromString(text, "text/html");
      text = document.body.innerText || document.body.textContent || "";
    }
    if (!text.trim()) throw new Error(`${source.name} has no readable text.`);
    return { id: source.id, kind: "text", text, title: file.name };
  }));
}

function eventMessage(event: StreamEvent, callbacks: {
  onResult: (result: AnalysisResult) => void;
  onStatus: (status: string) => void;
  onError: (message: string) => void;
}) {
  if (event.type === "step") {
    const labels: Record<Extract<StreamEvent, { type: "step" }>['step'], string> = {
      ingest: "Reading sources",
      aspects: "Working out what a complete answer needs",
      claims: "Checking the claims against source quotes",
      verify: "Verifying evidence and coverage",
      analyze: "Finding gaps, conflicts, and outdated information",
      checklist: "Preparing the verification checklist",
    };
    callbacks.onStatus(event.detail || labels[event.step]);
  } else if (event.type === "result") {
    callbacks.onResult(event.data);
  } else if (event.type === "error") {
    callbacks.onError(event.message);
  } else if (event.type === "source" && ["failed", "blocked", "empty"].includes(event.status)) {
    callbacks.onStatus("A source could not be read. I’m checking the remaining sources.");
  }
}

export default function LandingPage() {
  const [question, setQuestion] = useState("");
  const [sources, setSources] = useState<LocalSource[]>([]);
  const [status, setStatus] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteValue, setPasteValue] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileLabel, setProfileLabel] = useState<string | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutMessage, setSignOutMessage] = useState("");
  const [conversation, setConversation] = useState(false);
  const [submittedQuestion, setSubmittedQuestion] = useState("");
  const [submittedSources, setSubmittedSources] = useState<Array<Pick<LocalSource, "id" | "kind" | "name">>>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [isSample, setIsSample] = useState(false);
  const [retryAvailable, setRetryAvailable] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerDockRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const retryInputRef = useRef<{ question: string; sources: LocalSource[] } | null>(null);

  function resizeQuestion() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const maxHeight = window.matchMedia("(max-width: 760px)").matches ? 320 : 220;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }

  useEffect(() => { requestAnimationFrame(resizeQuestion); }, [question, conversation]);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (active) setProfileLabel(session?.user.email || (session?.user.user_metadata?.full_name as string | undefined) || null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setProfileLabel(session?.user.email || (session?.user.user_metadata?.full_name as string | undefined) || null);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
      abortRef.current?.abort();
    };
  }, []);

  async function signOutFromLanding() {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutMessage("");
    try {
      const { error } = await createClient().auth.signOut();
      if (error) throw error;
      setProfileLabel(null);
      setProfileMenuOpen(false);
      setMobileOpen(false);
    } catch {
      setSignOutMessage("Sign out failed. Try again.");
    } finally {
      setSigningOut(false);
    }
  }

  function addSource(source: LocalSource) {
    if (sources.length >= MAX_SOURCES) { setStatus("You can add up to 8 sources."); return false; }
    setSources((current) => [...current, source]);
    setStatus("");
    return true;
  }

  function addFiles(files: FileList | File[]) {
    const allFiles = Array.from(files);
    const incoming = allFiles.filter((file) => /\.(pdf|txt|md|html?)$/i.test(file.name));
    const room = Math.max(0, MAX_SOURCES - sources.length);
    const accepted = incoming.slice(0, room);
    setSources((current) => [...current, ...accepted.map((file) => ({ id: crypto.randomUUID(), kind: "file" as const, name: file.name, file }))]);
    if (incoming.length > room) setStatus("You can add up to 8 sources.");
    else if (incoming.length < allFiles.length) setStatus("Choose a PDF, text, Markdown or HTML file.");
    else if (accepted.length) setStatus("Source added.");
  }

  async function runLiveAnalysis(prompt: string, sourceSnapshot: LocalSource[]) {
    retryInputRef.current = { question: prompt, sources: sourceSnapshot };
    setRetryAvailable(true);
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setConversation(true);
    setSubmittedQuestion(prompt);
    setSubmittedSources(sourceSnapshot.map(({ id, kind, name }) => ({ id, kind, name })));
    setAnalysisResult(null);
    setAnalysisError("");
    setAnalysisStatus("Preparing your sources");
    setAnalysisLoading(true);
    setIsSample(false);
    setQuestion("");
    setSources([]);
    setStatus("");
    try {
      const requestSources = await makeRequestSources(sourceSnapshot);
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: prompt, sources: requestSources }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? "Analysis could not be started. Please try again.");
      }
      if (!response.body) throw new Error("The analysis stream could not be opened.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let receivedResult = false;
      let streamError = "";
      const handleBlock = (block: string) => {
        const data = block.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
        if (!data) return;
        let raw: unknown;
        try { raw = JSON.parse(data); } catch { return; }
        const parsed = StreamEventSchema.safeParse(raw);
        if (!parsed.success) return;
        const event = parsed.data;
        eventMessage(event, {
          onResult: (result) => { receivedResult = true; setAnalysisResult(result); setAnalysisStatus("Analysis complete"); setAnalysisLoading(false); },
          onStatus: setAnalysisStatus,
          onError: (message) => { streamError = message; },
        });
      };
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() ?? "";
        blocks.forEach(handleBlock);
        if (done) break;
      }
      if (buffer.trim()) handleBlock(buffer);
      if (streamError) throw new Error(streamError);
      if (!receivedResult) throw new Error("The analysis ended before a result was ready. Please try again.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setAnalysisError(error instanceof Error ? error.message : "Analysis could not be completed.");
      setAnalysisLoading(false);
    }
  }

  async function runSample() {
    if (analysisLoading) return;
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setConversation(true);
    setSubmittedQuestion(DEMO_QUESTION);
    setSubmittedSources(SAMPLE_SOURCES);
    setAnalysisResult(null);
    setAnalysisError("");
    setAnalysisStatus("Loading the prepared sample analysis");
    setAnalysisLoading(true);
    setIsSample(true);
    retryInputRef.current = null;
    setRetryAvailable(false);
    setQuestion("");
    setSources([]);
    setStatus("");
    try {
      const response = await fetch("/api/sample", { signal: controller.signal });
      if (!response.ok) throw new Error("The sample analysis could not be loaded.");
      const result = AnalysisResultSchema.parse(await response.json());
      setAnalysisResult(result);
      setSubmittedQuestion(result.question);
      setSubmittedSources(result.sources.map((source) => ({ id: source.id, kind: source.kind === "text" ? "text" : source.kind === "url" ? "url" : "file", name: source.title })));
      setAnalysisStatus("Sample analysis ready");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setAnalysisError(error instanceof Error ? error.message : "The sample analysis could not be loaded.");
    } finally {
      if (!controller.signal.aborted) setAnalysisLoading(false);
    }
  }

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const prompt = question.trim();
    if (prompt.length < 5) { setStatus("Add a question with at least 5 characters."); textareaRef.current?.focus(); return; }
    if (!sources.length) { setStatus("Add at least one source before starting the analysis."); return; }
    if (analysisLoading) return;
    void runLiveAnalysis(prompt, sources);
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
    for (const rawUrl of picked) {
      const url = rawUrl.replace(/[),.;!?]+$/, "");
      text = text.replace(rawUrl, "");
      const normalized = normalizeUrl(url);
      setSources((current) => current.some((source) => source.kind === "url" && source.url === normalized) ? current : [...current, { id: crypto.randomUUID(), kind: "url", name: sourceName(normalized), url: normalized }]);
    }
    setQuestion(remaining.length ? text.trim() : text.replace(/\s{2,}/g, " ").trim());
    setStatus(remaining.length ? "You can add up to 8 sources." : "");
  }

  function addLink() {
    const url = normalizeUrl(linkValue);
    try {
      const parsed = new URL(url);
      if (!/^https?:$/.test(parsed.protocol)) throw new Error();
      if (addSource({ id: crypto.randomUUID(), kind: "url", name: parsed.hostname.replace(/^www\./, ""), url: parsed.href })) {
        setLinkValue(""); setLinkOpen(false); setStatus("Source added.");
      }
    } catch { setStatus("Enter a valid web address, such as example.gov.in."); }
  }

  function submitLink(event: FormEvent) {
    event.preventDefault();
    addLink();
  }

  function submitPaste(event: FormEvent) {
    event.preventDefault();
    const content = pasteValue.trim();
    if (!content) { setStatus("Paste the source text before adding it."); return; }
    if (addSource({ id: crypto.randomUUID(), kind: "text", name: pasteTitle.trim() || content.slice(0, 42), text: content })) {
      setPasteValue(""); setPasteTitle(""); setPasteOpen(false); setStatus("Source added.");
    }
  }

  function startNewAnalysis() {
    abortRef.current?.abort();
    setConversation(false);
    setQuestion(""); setSources([]); setSubmittedQuestion(""); setSubmittedSources([]);
    setAnalysisResult(null); setAnalysisLoading(false); setAnalysisStatus(""); setAnalysisError("");
    setIsSample(false); retryInputRef.current = null; setRetryAvailable(false); setStatus(""); setLinkOpen(false); setPasteOpen(false); setMobileOpen(false);
  }

  function retryLastAnalysis() {
    const input = retryInputRef.current;
    if (input) void runLiveAnalysis(input.question, input.sources);
  }

  function openAddSource() {
    composerDockRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    setLinkOpen(true);
    setPasteOpen(false);
    window.setTimeout(() => {
      const mobile = window.matchMedia("(max-width: 760px)").matches;
      document.getElementById(mobile ? (conversation ? "conversation-source-url" : "mobile-source-url") : "source-url")?.focus();
    }, 100);
  }

  function showSourceSuggestionMessage() {
    setStatus("Automatic source discovery is not connected yet. Add an official URL or upload a source to continue.");
    composerDockRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  const menu = <>
    {conversation ? <button type="button" onClick={() => { startNewAnalysis(); setMobileOpen(false); }}>New analysis</button> : <>
      <a href="#how-it-works" onClick={() => setMobileOpen(false)}>How it works</a>
      <button type="button" onClick={() => { void runSample(); setMobileOpen(false); }}>Sample</button>
    </>}
    {profileLabel ? (
      <div className="nav-account">
        <button className="nav-profile-trigger" type="button" title={profileLabel} aria-label={`Account menu for ${profileLabel}`} aria-expanded={profileMenuOpen} onClick={() => { setProfileMenuOpen((open) => !open); setSignOutMessage(""); }}>
          <span className="nav-profile-avatar">{profileLabel.trim().charAt(0).toUpperCase() || "U"}</span><ChevronDown size={14} aria-hidden="true" />
        </button>
        {profileMenuOpen && <div className="nav-account-menu" role="menu">
          <span className="nav-account-email" title={profileLabel}>{profileLabel}</span>
          <a href="/dashboard" role="menuitem" onClick={() => { setProfileMenuOpen(false); setMobileOpen(false); }}><LayoutDashboard size={15} />Dashboard</a>
          <button type="button" role="menuitem" onClick={signOutFromLanding} disabled={signingOut}><LogOut size={15} />{signingOut ? "Signing out…" : "Sign out"}</button>
          {signOutMessage && <span className="nav-account-error" role="status">{signOutMessage}</span>}
        </div>}
      </div>
    ) : <a className="nav-signin-button" href="/login" onClick={() => setMobileOpen(false)}><span>Sign in</span></a>}
    <a className="github-link" href="https://github.com/Adochaure/PRANAMA-AI" target="_blank" rel="noreferrer" onClick={() => setMobileOpen(false)}><svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8 .7a7.3 7.3 0 0 0-2.3 14.2c.36.07.5-.16.5-.35v-1.27c-2.03.44-2.46-.86-2.46-.86-.33-.84-.81-1.06-.81-1.06-.66-.45.05-.44.05-.44.73.05 1.11.75 1.11.75.65 1.1 1.7.78 2.12.6.06-.47.25-.78.46-.96-1.62-.18-3.33-.81-3.33-3.6 0-.8.29-1.45.75-1.96-.08-.18-.33-.93.07-1.94 0 0 .61-.2 2 .75a6.9 6.9 0 0 1 3.64 0c1.39-.94 2-.75 2-.75.4 1.01.15 1.76.07 1.94.47.51.75 1.16.75 1.96 0 2.8-1.71 3.42-3.34 3.6.26.22.49.66.49 1.33v1.96c0 .2.13.42.5.35A7.3 7.3 0 0 0 8 .7Z" /></svg><span>GitHub</span></a>
  </>;

  return <>
    <header className="topbar">
      <a className="brand" href="#top" aria-label="Pramana home"><Image src="/pramana_logo.webp" alt="" width={224} height={48} priority className="border rounded-sm" /><span>Pramana</span></a>
      <nav className="desktop-nav" aria-label="Main navigation">{menu}</nav>
      <button className="mobile-menu-button" aria-label="Open navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen((open) => !open)}>{mobileOpen ? <X size={19} /> : <List size={19} />}</button>
      {mobileOpen && <nav className="mobile-nav" aria-label="Mobile navigation">{menu}</nav>}
    </header>
    <main id="top" className={conversation ? "landing-conversation" : "landing-home"}>
      {!conversation ? <>
        <section className="hero" aria-labelledby="hero-title">
          <span className="hero-pillar hero-pillar-left" aria-hidden="true" /><span className="hero-pillar hero-pillar-right" aria-hidden="true" /><span className="hero-pillar hero-pillar-center" aria-hidden="true" />
          <div className="hero-wordmark" aria-hidden="true">प्रMANA</div>
          <h1 id="hero-title">What do you want to be <span className="hero-title-accent">sure about?</span></h1>
          <p className="subtitle">Add your sources and Pramana shows what&apos;s missing, what conflicts, and what&apos;s outdated.</p>
          <div className="composer-wrap">
            <form className="composer" onSubmit={submit}>
              <div className={`source-strip ${sources.length ? "has-items" : ""}`} aria-label="Attached sources">{sources.map((source) => <div className="source-chip" key={source.id} title={source.name}><span aria-hidden="true">{source.kind === "url" ? <Link2 size={15} /> : source.kind === "text" ? <ClipboardPaste size={15} /> : <FileText size={15} />}</span><span>{source.name}</span><button type="button" aria-label={`Remove ${source.name}`} onClick={() => setSources((all) => all.filter((item) => item.id !== source.id))}><X size={14} /></button></div>)}</div>
              {linkOpen && <div className="mobile-link-popover"><label htmlFor="mobile-source-url">Source URL</label><div className="link-entry"><input id="mobile-source-url" type="url" placeholder="https://example.gov.in/page" value={linkValue} onChange={(event) => setLinkValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addLink(); } }} /><button type="button" onClick={addLink}>Add source</button></div></div>}
              <textarea ref={textareaRef} value={question} onChange={(event) => { onQuestionChange(event); requestAnimationFrame(resizeQuestion); }} onKeyDown={onKeyDown} rows={1} placeholder="Ask a question, then add the sources you're relying on" aria-label="Your question" />
              <div className="composer-footer"><div className="composer-actions"><button type="button" className="add-button upload-trigger" aria-label="Upload source files" title="Upload source files" onClick={() => fileRef.current?.click()}><Plus size={20} /></button><button type="button" className="add-button mobile-source-action" aria-label="Add a link" title="Add a link" onClick={() => { setLinkOpen((open) => !open); setPasteOpen(false); }}><Link2 size={18} /></button><button type="button" className="add-button mobile-source-action" aria-label="Paste source text" title="Paste source text" onClick={() => { setPasteOpen(true); setLinkOpen(false); }}><ClipboardPaste size={18} /></button></div>
                <input ref={fileRef} className="file-input" type="file" multiple accept={ACCEPTED} onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = ""; }} />
                <button className="send-button" type="submit" aria-label="Send question" title="Send question" disabled={analysisLoading}><span className="send-arrow"><ArrowUp size={24} strokeWidth={2.4} /></span></button>
              </div>
            </form>
            <div className="status" role="status" aria-live="polite">{status}</div>
            <div className="option-row">
              <div className="popover-anchor"><button className="text-action" type="button" onClick={() => { setLinkOpen((open) => !open); setPasteOpen(false); }}><Link2 size={17} />Add link</button>{linkOpen && <form className="link-popover" onSubmit={submitLink}><label htmlFor="source-url">Source URL</label><div className="link-entry"><input id="source-url" type="url" placeholder="https://example.gov.in/page" value={linkValue} onChange={(event) => setLinkValue(event.target.value)} /><button type="submit">Add source</button></div></form>}</div>
              <button className="text-action" type="button" onClick={() => fileRef.current?.click()}><FileText size={17} />Upload files</button><button className="text-action" type="button" onClick={() => { setPasteOpen(true); setLinkOpen(false); }}><ClipboardPaste size={17} />Paste text</button><button className="text-action" type="button" onClick={showSourceSuggestionMessage}><Search size={17} />Suggest sources</button>
            </div>
            <div className="examples"><button className="sample-capsule" type="button" onClick={() => void runSample()}>Try the sample scholarship</button><button className="example-capsule" type="button" onClick={() => { setQuestion("What should I verify on this admission page?"); textareaRef.current?.focus(); }}>Check an admission page</button><button className="example-capsule" type="button" onClick={() => { setQuestion("What should I verify before applying for this government scheme?"); textareaRef.current?.focus(); }}>Review a government scheme</button></div>
            <p className="note">Findings are potential gaps based on your sources, not guaranteed facts.</p>
          </div>
        </section>
        <section className="how" id="how-it-works" aria-labelledby="how-title"><h2 id="how-title">How it works</h2><div className="how-step"><span>1</span><p><strong>Ask.</strong> Type the question you need answered and add the pages or files you&apos;re relying on.</p></div><div className="how-step"><span>2</span><p><strong>Compare.</strong> Pramana works out what a complete answer needs, then checks each source against it, quote by quote.</p></div><div className="how-step"><span>3</span><p><strong>Verify.</strong> See what&apos;s missing, where sources disagree, what&apos;s outdated, and what to confirm next.</p></div></section>
      </> : <>
        <AnalysisConversation question={submittedQuestion} sources={submittedSources} result={analysisResult} loading={analysisLoading} statusLine={analysisStatus} error={analysisError} isSample={isSample} canRetry={retryAvailable} onRetry={retryLastAnalysis} onAddSource={openAddSource} onSuggestSources={showSourceSuggestionMessage} />
        <div className="landing-chat-dock" ref={composerDockRef}>
          <div className="landing-chat-dock-inner">
            <form className="composer" onSubmit={submit}>
              <div className={`source-strip ${sources.length ? "has-items" : ""}`} aria-label="Sources for the next analysis">{sources.map((source) => <div className="source-chip" key={source.id} title={source.name}><span aria-hidden="true">{source.kind === "url" ? <Link2 size={15} /> : source.kind === "text" ? <ClipboardPaste size={15} /> : <FileText size={15} />}</span><span>{source.name}</span><button type="button" aria-label={`Remove ${source.name}`} onClick={() => setSources((all) => all.filter((item) => item.id !== source.id))}><X size={14} /></button></div>)}</div>
              {linkOpen && <div className="mobile-link-popover"><label htmlFor="conversation-source-url">Source URL</label><div className="link-entry"><input id="conversation-source-url" type="url" placeholder="https://example.gov.in/page" value={linkValue} onChange={(event) => setLinkValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addLink(); } }} /><button type="button" onClick={addLink}>Add source</button></div></div>}
              <textarea ref={textareaRef} value={question} onChange={(event) => { setQuestion(event.target.value); requestAnimationFrame(resizeQuestion); }} onKeyDown={onKeyDown} rows={1} placeholder="Ask a follow-up or start a new check with sources" aria-label="Your follow-up question" />
              <div className="composer-footer"><div className="composer-actions"><button type="button" className="add-button upload-trigger" aria-label="Upload source files" title="Upload source files" onClick={() => fileRef.current?.click()}><Plus size={20} /></button><button type="button" className="add-button mobile-source-action" aria-label="Add a link" title="Add a link" onClick={() => { setLinkOpen((open) => !open); setPasteOpen(false); }}><Link2 size={18} /></button><button type="button" className="add-button mobile-source-action" aria-label="Paste source text" title="Paste source text" onClick={() => { setPasteOpen(true); setLinkOpen(false); }}><ClipboardPaste size={18} /></button></div>
                <input ref={fileRef} className="file-input" type="file" multiple accept={ACCEPTED} onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = ""; }} />
                <button className="send-button" type="submit" aria-label="Send question" title="Send question" disabled={analysisLoading}><span className="send-arrow"><ArrowUp size={24} strokeWidth={2.4} /></span></button>
              </div>
            </form>
            <div className="status" role="status" aria-live="polite">{status}</div>
            <div id="conversation-source-tools" className="option-row conversation-source-tools">
              <div className="popover-anchor"><button className="text-action" type="button" onClick={() => { setLinkOpen((open) => !open); setPasteOpen(false); }}><Link2 size={17} />Add link</button>{linkOpen && <form className="link-popover" onSubmit={submitLink}><label htmlFor="source-url">Source URL</label><div className="link-entry"><input id="source-url" type="url" placeholder="https://example.gov.in/page" value={linkValue} onChange={(event) => setLinkValue(event.target.value)} /><button type="submit">Add source</button></div></form>}</div>
              <button className="text-action" type="button" onClick={() => fileRef.current?.click()}><FileText size={17} />Upload files</button><button className="text-action" type="button" onClick={() => { setPasteOpen(true); setLinkOpen(false); }}><ClipboardPaste size={17} />Paste text</button>
            </div>
          </div>
        </div>
      </>}
    </main>
    {!conversation && <footer><span>Built for the Shinchan Online Hackathon 2026.</span><a href="https://github.com/Adochaure/PRANAMA-AI" target="_blank" rel="noreferrer">GitHub</a></footer>}
    {pasteOpen && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPasteOpen(false); }}><form className="paste-dialog" role="dialog" aria-modal="true" aria-labelledby="paste-title" onSubmit={submitPaste}><button className="dialog-close" type="button" aria-label="Close" onClick={() => setPasteOpen(false)}><X size={18} /></button><h2 id="paste-title">Paste source text</h2><label htmlFor="paste-name">Title <span>(optional)</span></label><input id="paste-name" value={pasteTitle} onChange={(event) => setPasteTitle(event.target.value)} placeholder="Name this source" /><label htmlFor="paste-content">Source text</label><textarea id="paste-content" value={pasteValue} onChange={(event) => setPasteValue(event.target.value)} placeholder="Paste the text you want Pramana to check" autoFocus /><button className="primary-action" type="submit">Add source</button></form></div>}
  </>;
}
