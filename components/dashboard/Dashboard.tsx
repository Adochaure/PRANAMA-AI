"use client";

import { useEffect, useState } from "react";
import Sidebar, { type AnalysisSummary } from "./Sidebar";
import CenterPanel from "./CenterPanel";
import InsightsPanel from "./InsightsPanel";
import { createClient } from "@/lib/supabase/client";

export type MobileView = "chat" | "insights";

export default function Dashboard({ userId, userEmail }: { userId: string; userEmail: string }) {
  const [mobileView, setMobileView] = useState<MobileView>("chat");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeChat, setActiveChat] = useState("Aarohan Merit Scholarship");
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [resetKey, setResetKey] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  useEffect(() => {
    fetch("/api/analyses").then(async (response) => {
      if (!response.ok) return;
      const data = await response.json() as { analyses?: AnalysisSummary[] };
      setAnalyses(data.analyses ?? []);
    }).catch(() => undefined);
  }, []);

  function selectAnalysis(analysis: AnalysisSummary) {
    setActiveAnalysisId(analysis.id);
    setActiveChat(analysis.title);
    setSidebarOpen(false);
  }

  function startNewAnalysis() {
    setActiveAnalysisId(null);
    setActiveChat("New analysis");
    setResetKey((value) => value + 1);
    setSidebarOpen(false);
  }

  function handleSaved(analysis: AnalysisSummary) {
    setActiveAnalysisId(analysis.id);
    setActiveChat(analysis.title);
    setAnalyses((current) => [analysis, ...current.filter((item) => item.id !== analysis.id)]);
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

  return (
    <div className="dashboard-shell">
      <Sidebar
        activeChat={activeChat}
        chats={analyses}
        userEmail={userEmail}
        signingOut={signingOut}
        signOutError={signOutError}
        onSelectChat={selectAnalysis}
        onNewAnalysis={startNewAnalysis}
        onSignOut={signOut}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      {sidebarOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
      <div className="dashboard-workspace">
        <header className="dashboard-topbar">
          <button className="mobile-nav-trigger" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><span /><span /><span /></button>
          <div className="mobile-brand">Pramana <span>Research workspace</span></div>
          <div className="mobile-view-switch" role="tablist" aria-label="Dashboard view">
            <button role="tab" aria-selected={mobileView === "chat"} className={mobileView === "chat" ? "selected" : ""} onClick={() => setMobileView("chat")}>Chat</button>
            <button role="tab" aria-selected={mobileView === "insights"} className={mobileView === "insights" ? "selected" : ""} onClick={() => setMobileView("insights")}>Insights <span className="switch-count">4</span></button>
          </div>
        </header>
        <div className="dashboard-grid">
          <main className={`center-column ${mobileView === "chat" ? "mobile-active" : "mobile-hidden"}`}>
            <CenterPanel chatTitle={activeChat} activeAnalysisId={activeAnalysisId} resetKey={resetKey} userId={userId} onSaved={handleSaved} onMenu={() => setSidebarOpen(true)} onShowInsights={() => setMobileView("insights")} />
          </main>
          <aside className={`insights-column ${mobileView === "insights" ? "mobile-active" : "mobile-hidden"}`}>
            <InsightsPanel onBackToChat={() => setMobileView("chat")} />
          </aside>
        </div>
      </div>
    </div>
  );
}
