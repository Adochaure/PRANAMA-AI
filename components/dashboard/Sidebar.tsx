"use client";

import Image from "next/image";
import { useState } from "react";
import { Archive, ChevronDown, CircleHelp, FileText, LogOut, Plus, Search, Settings2, SlidersHorizontal, X } from "lucide-react";

export type AnalysisSummary = { id: string; title: string; updated_at: string };
type Props = { activeChat: string; chats: AnalysisSummary[]; userEmail: string; signingOut: boolean; signOutError: string; onSelectChat: (chat: AnalysisSummary) => void; onNewAnalysis: () => void; onSignOut: () => void; open: boolean; onClose: () => void };

export default function Sidebar({ activeChat, chats: allChats, userEmail, signingOut, signOutError, onSelectChat, onNewAnalysis, onSignOut, open, onClose }: Props) {
  const [search, setSearch] = useState("");
  const chats = allChats.filter((chat) => chat.title.toLowerCase().includes(search.toLowerCase()));
  return (
    <aside className={`dashboard-sidebar ${open ? "sidebar-open" : ""}`}>
      <div className="sidebar-head">
        <a className="dashboard-brand" href="#workspace" aria-label="Pramana home">
          <Image src="/pramana_logo.webp" alt="" width={224} height={48} priority />
          <span>Pramana</span>
        </a>
        <button className="sidebar-close" aria-label="Close navigation" onClick={onClose}><X size={18} /></button>
      </div>
      <button className="new-analysis-button" onClick={onNewAnalysis}><Plus size={17} strokeWidth={1.8} />New analysis</button>
      <label className="history-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search history" aria-label="Search history" /><kbd>⌘ K</kbd></label>
      <div className="sidebar-section-label"><span>Recent</span><button aria-label="History options"><SlidersHorizontal size={14} /></button></div>
      <nav className="history-list" aria-label="Recent analyses">
        {chats.map((chat) => <button key={chat.id} className={`history-item ${activeChat === chat.id ? "active" : ""}`} onClick={() => onSelectChat(chat)}>
          <FileText size={16} strokeWidth={1.7} /><span className="history-copy"><span>{chat.title}</span><small>{new Date(chat.updated_at).toLocaleDateString()}</small></span>
        </button>)}
        {!chats.length && <p className="no-history">No matching analyses.</p>}
      </nav>
      <button className="all-history"><Archive size={15} />View all history</button>
      <div className="sidebar-spacer" />
      <div className="sidebar-plan"><div className="plan-mark">P</div><span><strong>Personal workspace</strong><small>Synced with Supabase</small></span><ChevronDown size={15} /></div>
      <button className="sidebar-bottom-link"><Settings2 size={16} />Settings</button>
      <button className="sidebar-bottom-link"><CircleHelp size={16} />Help center</button>
      <button className="account-row" onClick={onSignOut} title={signOutError || "Sign out"} disabled={signingOut} aria-label={signingOut ? "Signing out" : "Sign out"}>
        <span className="avatar">{userEmail.slice(0, 1).toUpperCase() || "U"}</span>
        <span className="account-copy"><strong>{userEmail || "Signed in"}</strong><small role={signOutError ? "status" : undefined}>{signOutError || (signingOut ? "Signing out…" : "Sign out now")}</small></span>
        {signingOut ? <span className="signout-spinner" aria-hidden="true" /> : <LogOut size={15} aria-hidden="true" />}
      </button>
    </aside>
  );
}
