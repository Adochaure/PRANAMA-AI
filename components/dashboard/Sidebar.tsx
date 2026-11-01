"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Archive, ChevronDown, FileText, LogOut, Plus, Search, SlidersHorizontal, Trash2, X } from "lucide-react";

export type AnalysisSummary = { id: string; title: string; updated_at: string };

type Props = {
  activeChat: string;
  chats: AnalysisSummary[];
  userEmail: string;
  signingOut: boolean;
  signOutError: string;
  onSelectChat: (chat: AnalysisSummary) => void;
  onDeleteChat: (id: string) => void;
  onNewAnalysis: () => void;
  onSignOut: () => void;
  open: boolean;
  onClose: () => void;
};

export default function Sidebar({
  activeChat,
  chats: allChats,
  userEmail,
  signingOut,
  signOutError,
  onSelectChat,
  onDeleteChat,
  onNewAnalysis,
  onSignOut,
  open,
  onClose,
}: Props) {
  const [search, setSearch] = useState("");
  const chats = allChats.filter((chat) => chat.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <aside className={`dashboard-sidebar ${open ? "sidebar-open" : ""}`}>
      <div className="sidebar-head">
        <Link className="dashboard-brand" href="/" aria-label="Pramana home">
          <Image src="/pramana_logo.webp" alt="" width={224} height={48} priority />
          <span>Pramana</span>
        </Link>
        <button className="sidebar-close" aria-label="Close navigation" onClick={onClose}><X size={18} /></button>
      </div>

      <button className="new-analysis-button" type="button" onClick={onNewAnalysis}>
        <Plus size={17} strokeWidth={1.8} />New analysis
      </button>

      <label className="history-search">
        <Search size={16} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search history"
          aria-label="Search history"
        />
        <kbd>⌘ K</kbd>
      </label>

      <div className="sidebar-section-label">
        <span>Recent analyses ({chats.length})</span>
        <button type="button" aria-label="History options"><SlidersHorizontal size={14} /></button>
      </div>

      <nav className="history-list" aria-label="Recent analyses">
        {chats.map((chat) => (
          <div
            key={chat.id}
            className={`history-item-row ${activeChat === chat.id ? "active" : ""}`}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              borderRadius: "7px",
              margin: "2px 0",
            }}
          >
            <button
              type="button"
              className={`history-item ${activeChat === chat.id ? "active" : ""}`}
              style={{ flex: 1, minWidth: 0, textAlign: "left", border: 0 }}
              onClick={() => onSelectChat(chat)}
            >
              <FileText size={16} strokeWidth={1.7} />
              <span className="history-copy">
                <span>{chat.title}</span>
                <small>{new Date(chat.updated_at).toLocaleDateString()}</small>
              </span>
            </button>
            <button
              type="button"
              className="history-delete-btn"
              title="Delete analysis"
              aria-label={`Delete ${chat.title}`}
              onClick={(e) => {
                e.stopPropagation();
                if (confirm("Delete this analysis from your account?")) {
                  onDeleteChat(chat.id);
                }
              }}
              style={{
                width: "26px",
                height: "26px",
                display: "grid",
                placeItems: "center",
                marginRight: "4px",
                padding: 0,
                border: 0,
                borderRadius: "4px",
                background: "transparent",
                color: "#bac5fb",
                cursor: "pointer",
                opacity: 0.6,
                transition: "opacity 0.15s ease, background 0.15s ease",
              }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        {!chats.length && <p className="no-history">No saved analyses.</p>}
      </nav>

      <div className="sidebar-spacer" />

      <div className="sidebar-plan">
        <div className="plan-mark">P</div>
        <span><strong>Research workspace</strong><small>Synced with Supabase</small></span>
        <ChevronDown size={15} />
      </div>

      <Link className="sidebar-bottom-link" href="/" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <Archive size={16} />Landing page
      </Link>

      <button
        className="account-row"
        type="button"
        onClick={onSignOut}
        title={signOutError || "Sign out"}
        disabled={signingOut}
        aria-label={signingOut ? "Signing out" : "Sign out"}
      >
        <span className="avatar">{userEmail.slice(0, 1).toUpperCase() || "U"}</span>
        <span className="account-copy">
          <strong>{userEmail || "Signed in"}</strong>
          <small role={signOutError ? "status" : undefined}>
            {signOutError || (signingOut ? "Signing out…" : "Sign out now")}
          </small>
        </span>
        {signingOut ? <span className="signout-spinner" aria-hidden="true" /> : <LogOut size={15} aria-hidden="true" />}
      </button>
    </aside>
  );
}
