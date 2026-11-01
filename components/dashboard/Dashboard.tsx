"use client";

import { useEffect, useRef, useState } from "react";
import Sidebar, { type AnalysisSummary } from "./Sidebar";
import CenterPanel from "./CenterPanel";
import InsightsPanel from "./InsightsPanel";
import { CoverageMap } from "@/components/conversation/CoverageMap";
import { EvidenceSheet, type EvidenceSelection } from "@/components/conversation/EvidenceSheet";
import {
  AnalysisResult as AnalysisResultSchema,
  StreamEvent as StreamEventSchema,
  type AnalysisResult,
  type Claim,
} from "@/lib/schemas";
import { createClient } from "@/lib/supabase/client";

export type MobileView = "chat" | "insights";

type SourceItem = {
  id: string;
  kind: "url" | "text" | "pdf";
  title: string;
  url?: string;
  text?: string;
  filename?: string;
  fileBase64?: string;
};

export default function Dashboard({ userId, userEmail }: { userId: string; userEmail: string }) {
  const [mobileView, setMobileView] = useState<MobileView>("chat");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeChat, setActiveChat] = useState("New research");
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [resetKey, setResetKey] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  // Active analysis document state
  const [activeResult, setActiveResult] = useState<AnalysisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [isSample, setIsSample] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());

  // Modal / Drawer state
  const [coverageOpen, setCoverageOpen] = useState(false);
  const [evidenceSelection, setEvidenceSelection] = useState<EvidenceSelection | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // Check for pending analysis from Landing Page or URL
  useEffect(() => {
    let active = true;
    fetch("/api/analyses")
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { analyses?: AnalysisSummary[] };
        if (active) setAnalyses(data.analyses ?? []);
      })
      .catch(() => {});

    try {
      const stored = sessionStorage.getItem("pramana_pending_analysis");
      if (stored) {
        sessionStorage.removeItem("pramana_pending_analysis");
        const payload = JSON.parse(stored) as {
          question: string;
          sources: SourceItem[];
          isSample?: boolean;
        };
        if (payload.question) {
          void runAnalysis(payload.question, payload.sources || [], Boolean(payload.isSample));
        }
      }
    } catch {
      // Ignored
    }

    return () => {
      active = false;
    };
  }, []);

  async function saveAnalysisToSupabase(
    title: string,
    question: string,
    result: AnalysisResult | null,
    sources: SourceItem[],
    existingId?: string | null
  ) {
    try {
      const res = await fetch("/api/analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: existingId || undefined,
          title: title.slice(0, 100),
          question,
          result,
          sources: sources.map((s, idx) => ({
            kind: s.kind,
            title: s.title,
            url: s.url || (s.kind === "url" ? "https://example.gov.in" : null),
            content: s.text || null,
            position: idx,
          })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const saved = data.analysis as AnalysisSummary;
        setActiveAnalysisId(saved.id);
        setActiveChat(saved.title);
        setAnalyses((prev) => [saved, ...prev.filter((item) => item.id !== saved.id)]);
      }
    } catch {
      // Non-fatal if Supabase save fails
    }
  }

  async function runAnalysis(prompt: string, reqSources: SourceItem[], sampleMode = false) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setAnalysisLoading(true);
    setAnalysisError("");
    setActiveResult(null);
    setCheckedIds(new Set());
    setIsSample(sampleMode);
    setActiveChat(prompt.slice(0, 48));

    if (sampleMode) {
      setAnalysisStatus("Loading precomputed sample analysis…");
      try {
        const res = await fetch("/api/sample", { signal: controller.signal });
        if (!res.ok) throw new Error("Could not load sample analysis.");
        const result = AnalysisResultSchema.parse(await res.json());
        setActiveResult(result);
        setAnalysisStatus("Sample analysis ready");
        setAnalysisLoading(false);

        // Save to Supabase for the user
        await saveAnalysisToSupabase(
          result.question,
          result.question,
          result,
          result.sources.map((s) => ({ id: s.id, kind: s.kind === "text" ? "text" : "url", title: s.title, url: s.url ?? undefined }))
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setAnalysisError(err instanceof Error ? err.message : "Could not load sample analysis.");
        setAnalysisLoading(false);
      }
      return;
    }

    // Live analysis through SSE
    setAnalysisStatus("Initiating source evaluation…");
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: prompt, sources: reqSources }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Analysis could not be started.");
      }
      if (!response.body) throw new Error("Could not open stream.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let receivedResult: AnalysisResult | null = null;
      let streamErr = "";

      const handleBlock = (block: string) => {
        const data = block
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .join("\n");
        if (!data) return;
        let raw: unknown;
        try { raw = JSON.parse(data); } catch { return; }
        const parsed = StreamEventSchema.safeParse(raw);
        if (!parsed.success) return;
        const ev = parsed.data;

        if (ev.type === "step") {
          setAnalysisStatus(ev.detail || `Step: ${ev.step}`);
        } else if (ev.type === "result") {
          receivedResult = ev.data;
          setActiveResult(ev.data);
          setAnalysisStatus("Analysis complete");
          setAnalysisLoading(false);
        } else if (ev.type === "error") {
          streamErr = ev.message;
        }
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

      if (streamErr) throw new Error(streamErr);
      if (!receivedResult) throw new Error("Analysis completed without producing a result.");

      // Save to Supabase
      const finalRes: AnalysisResult = receivedResult;
      await saveAnalysisToSupabase(finalRes.question, finalRes.question, finalRes, reqSources);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setAnalysisError(err instanceof Error ? err.message : "Analysis could not be completed.");
      setAnalysisLoading(false);
    }
  }

  // Follow-up demo for sample: adds renewal-faq.md and watches gap close
  async function handleFollowUpRenewalDemo() {
    if (!activeResult) return;
    setAnalysisStatus("Analyzing newly supplied Renewal FAQ…");

    // Close the renewal gap: add renewal-faq source & verified claims
    const renewalSource = {
      id: "renewal-faq",
      kind: "url" as const,
      url: "https://scholarships.example.gov.in/surya/renewal-faq",
      title: "Surya Scholars Grant — Renewal FAQ",
      domain: "scholarships.example.gov.in",
      isOfficial: true,
      status: "ok" as const,
      error: null,
      text: "# Surya Scholars Grant — Renewal FAQ\n\nPublished: 01 September 2026\nAcademic cycle: 2026-27\n\nFor renewal, students must have scored at least 60% marks in the previous academic year.\n\nSubmit a fresh income certificate with the renewal request.\n",
      hash: "renewalfqhash998877",
      dates: { published: "2026-09-01", modified: null, cycles: ["2026-27"] },
    };

    const newClaims: Claim[] = [
      {
        id: "claim-renewal-faq-1",
        sourceId: "renewal-faq",
        aspectId: "academic_cycle",
        statement: "The FAQ applies to the 2026-27 cycle.",
        value: "2026-27",
        quote: "Academic cycle: 2026-27",
        quoteStart: 66,
        quoteEnd: 89,
        asOf: "2026-27",
      },
      {
        id: "claim-renewal-faq-2",
        sourceId: "renewal-faq",
        aspectId: "renewal_conditions",
        statement: "Renewal requires at least 60% marks in the previous academic year.",
        value: "At least 60% marks",
        quote: "For renewal, students must have scored at least 60% marks in the previous academic year.",
        quoteStart: 91,
        quoteEnd: 179,
        asOf: "2026-27",
      },
      {
        id: "claim-renewal-faq-3",
        sourceId: "renewal-faq",
        aspectId: "renewal_conditions",
        statement: "A fresh income certificate must accompany the renewal request.",
        value: "Fresh income certificate",
        quote: "Submit a fresh income certificate with the renewal request.",
        quoteStart: 181,
        quoteEnd: 240,
        asOf: "2026-27",
      },
    ];

    // Remove gap for renewal_conditions
    const updatedFindings = activeResult.findings.filter((f) => f.aspectId !== "renewal_conditions");
    // Update cells
    const updatedCells = activeResult.cells.map((c) => {
      if (c.aspectId === "renewal_conditions" && c.sourceId === "aggregator") {
        return { ...c, status: "possibly_covered" as const };
      }
      return c;
    });
    updatedCells.push({
      aspectId: "renewal_conditions",
      sourceId: "renewal-faq",
      status: "covered" as const,
      claimIds: ["claim-renewal-faq-2", "claim-renewal-faq-3"],
      hint: null,
    });

    // Update checklist (remove or mark complete the renewal condition check)
    const updatedChecklist = activeResult.checklist.filter(
      (item) => !item.finding_ids.includes("gap-renewal_conditions")
    );

    const updatedResult: AnalysisResult = {
      ...activeResult,
      sources: [...activeResult.sources.filter((s) => s.id !== "renewal-faq"), renewalSource],
      claims: [...activeResult.claims, ...newClaims],
      findings: updatedFindings,
      cells: updatedCells,
      checklist: updatedChecklist,
      score: {
        completeness: 89,
        darkSpot: 11,
      },
    };

    setActiveResult(updatedResult);
    setAnalysisStatus("Renewal conditions proven in new source. Completeness increased to 89%.");

    // Save updated result in Supabase
    await saveAnalysisToSupabase(
      activeResult.question,
      activeResult.question,
      updatedResult,
      updatedResult.sources.map((s) => ({ id: s.id, kind: s.kind === "text" ? "text" : "url", title: s.title, url: s.url ?? undefined })),
      activeAnalysisId
    );
  }

  // Select saved analysis from Sidebar
  async function selectAnalysis(analysis: AnalysisSummary) {
    setActiveAnalysisId(analysis.id);
    setActiveChat(analysis.title);
    setSidebarOpen(false);
    setAnalysisLoading(true);
    setAnalysisError("");
    setAnalysisStatus("Loading saved research…");

    try {
      const res = await fetch(`/api/analyses/${analysis.id}`);
      if (!res.ok) throw new Error("Could not load analysis.");
      const data = await res.json();
      const saved = data.analysis as {
        id: string;
        title: string;
        question: string;
        result: AnalysisResult | null;
        analysis_sources?: SourceItem[];
      };
      setActiveResult(saved.result);
      setIsSample(saved.title.toLowerCase().includes("surya") || saved.title.toLowerCase().includes("aarohan"));
      setAnalysisStatus("Saved research loaded");
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "Could not open saved analysis.");
    } finally {
      setAnalysisLoading(false);
    }
  }

  // Delete analysis from Sidebar
  async function deleteAnalysis(id: string) {
    try {
      const res = await fetch(`/api/analyses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete.");
      setAnalyses((prev) => prev.filter((item) => item.id !== id));
      if (activeAnalysisId === id) {
        startNewAnalysis();
      }
    } catch {
      // Ignored
    }
  }

  function startNewAnalysis() {
    abortRef.current?.abort();
    setActiveAnalysisId(null);
    setActiveChat("New research");
    setActiveResult(null);
    setAnalysisLoading(false);
    setAnalysisStatus("");
    setAnalysisError("");
    setIsSample(false);
    setCheckedIds(new Set());
    setResetKey((v) => v + 1);
    setSidebarOpen(false);
  }

  function toggleChecklist(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exportJson() {
    if (!activeResult) return;
    const blob = new Blob([JSON.stringify(activeResult, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pramana-${activeResult.question.slice(0, 30).replace(/[^a-z0-9]/gi, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      window.location.assign("/");
    } catch {
      setSignOutError("Sign out failed. Try again.");
      setSigningOut(false);
    }
  }

  function openClaim(claim: Claim) {
    if (!activeResult) return;
    const source = activeResult.sources.find((s) => s.id === claim.sourceId);
    if (!source) return;
    const aspect = activeResult.aspects.find((a) => a.id === claim.aspectId);
    setEvidenceSelection({
      source,
      claims: [claim],
      aspect,
    });
  }

  return (
    <div className="dashboard-shell">
      <Sidebar
        activeChat={activeChat}
        chats={analyses}
        userEmail={userEmail}
        signingOut={signingOut}
        signOutError={signOutError}
        onSelectChat={selectAnalysis}
        onDeleteChat={deleteAnalysis}
        onNewAnalysis={startNewAnalysis}
        onSignOut={signOut}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {sidebarOpen && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          type="button"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="dashboard-workspace">
        <header className="dashboard-topbar">
          <button
            className="mobile-nav-trigger"
            type="button"
            aria-label="Open navigation"
            onClick={() => setSidebarOpen(true)}
          >
            <span /><span /><span />
          </button>
          <div className="mobile-brand">
            Pramana <span>Research workspace</span>
          </div>
          <div className="mobile-view-switch" role="tablist" aria-label="Dashboard view">
            <button
              role="tab"
              type="button"
              aria-selected={mobileView === "chat"}
              className={mobileView === "chat" ? "selected" : ""}
              onClick={() => setMobileView("chat")}
            >
              Research
            </button>
            <button
              role="tab"
              type="button"
              aria-selected={mobileView === "insights"}
              className={mobileView === "insights" ? "selected" : ""}
              onClick={() => setMobileView("insights")}
            >
              Insights
              {Boolean(activeResult?.findings?.length) && (
                <span className="switch-count">
                  {activeResult?.findings?.length}
                </span>
              )}
            </button>
          </div>
        </header>

        <div className="dashboard-grid">
          <main className={`center-column ${mobileView === "chat" ? "mobile-active" : "mobile-hidden"}`}>
            <CenterPanel
              chatTitle={activeChat}
              activeAnalysisId={activeAnalysisId}
              resetKey={resetKey}
              userId={userId}
              result={activeResult}
              loading={analysisLoading}
              statusLine={analysisStatus}
              error={analysisError}
              isSample={isSample}
              checkedIds={checkedIds}
              onToggleCheck={toggleChecklist}
              onOpenCoverageMap={() => setCoverageOpen(true)}
              onOpenClaim={openClaim}
              onRunAnalysis={runAnalysis}
              onFollowUpRenewalDemo={handleFollowUpRenewalDemo}
              onMenu={() => setSidebarOpen(true)}
              onShowInsights={() => setMobileView("insights")}
            />
          </main>

          <aside className={`insights-column ${mobileView === "insights" ? "mobile-active" : "mobile-hidden"}`}>
            <InsightsPanel
              result={activeResult}
              loading={analysisLoading}
              onOpenCoverageMap={() => setCoverageOpen(true)}
              onBackToChat={() => setMobileView("chat")}
              checkedIds={checkedIds}
              onToggleCheck={toggleChecklist}
              onExportJson={exportJson}
              onRefresh={() => {
                if (activeResult) {
                  void runAnalysis(activeResult.question, [], isSample);
                }
              }}
            />
          </aside>
        </div>
      </div>

      {/* Coverage Map Modal Dialog */}
      {coverageOpen && activeResult && (
        <CoverageMap
          result={activeResult}
          onClose={() => setCoverageOpen(false)}
          onOpenEvidence={(selection) => setEvidenceSelection(selection)}
        />
      )}

      {/* Evidence Highlight Sheet */}
      <EvidenceSheet
        selection={evidenceSelection}
        onClose={() => setEvidenceSelection(null)}
      />
    </div>
  );
}
