"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import CenterPanel from "./CenterPanel";
import InsightsPanel from "./InsightsPanel";

export type MobileView = "chat" | "insights";

export default function Dashboard() {
  const [mobileView, setMobileView] = useState<MobileView>("chat");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeChat, setActiveChat] = useState("Aarohan Merit Scholarship");

  return (
    <div className="dashboard-shell">
      <Sidebar
        activeChat={activeChat}
        onSelectChat={(chat) => { setActiveChat(chat); setSidebarOpen(false); }}
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
            <CenterPanel chatTitle={activeChat} onMenu={() => setSidebarOpen(true)} onShowInsights={() => setMobileView("insights")} />
          </main>
          <aside className={`insights-column ${mobileView === "insights" ? "mobile-active" : "mobile-hidden"}`}>
            <InsightsPanel onBackToChat={() => setMobileView("chat")} />
          </aside>
        </div>
      </div>
    </div>
  );
}
