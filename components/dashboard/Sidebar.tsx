"use client";

import Image from "next/image";
import { useState } from "react";
import { Archive, ChevronDown, CircleHelp, FileText, Plus, Search, Settings2, SlidersHorizontal, X } from "lucide-react";

const initialChats = [
  { title: "Aarohan Merit Scholarship", time: "Just now", active: true },
  { title: "National entrance eligibility", time: "Yesterday" },
  { title: "State housing support", time: "Oct 28" },
  { title: "University fee waiver", time: "Oct 25" },
];

type Props = { activeChat: string; onSelectChat: (chat: string) => void; open: boolean; onClose: () => void };

export default function Sidebar({ activeChat, onSelectChat, open, onClose }: Props) {
  const [search, setSearch] = useState("");
  const chats = initialChats.filter((chat) => chat.title.toLowerCase().includes(search.toLowerCase()));
  return (
    <aside className={`dashboard-sidebar ${open ? "sidebar-open" : ""}`}>
      <div className="sidebar-head">
        <a className="dashboard-brand" href="#workspace" aria-label="Pramana home">
          <Image src="/pramana_logo.webp" alt="" width={224} height={48} priority />
          <span>Pramana</span>
        </a>
        <button className="sidebar-close" aria-label="Close navigation" onClick={onClose}><X size={18} /></button>
      </div>
      <button className="new-analysis-button" onClick={() => onSelectChat("New analysis")}><Plus size={17} strokeWidth={1.8} />New analysis</button>
      <label className="history-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search history" aria-label="Search history" /><kbd>⌘ K</kbd></label>
      <div className="sidebar-section-label"><span>Recent</span><button aria-label="History options"><SlidersHorizontal size={14} /></button></div>
      <nav className="history-list" aria-label="Recent analyses">
        {chats.map((chat) => <button key={chat.title} className={`history-item ${activeChat === chat.title ? "active" : ""}`} onClick={() => onSelectChat(chat.title)}>
          <FileText size={16} strokeWidth={1.7} /><span className="history-copy"><span>{chat.title}</span><small>{chat.time}</small></span>
        </button>)}
        {!chats.length && <p className="no-history">No matching analyses.</p>}
      </nav>
      <button className="all-history"><Archive size={15} />View all history</button>
      <div className="sidebar-spacer" />
      <div className="sidebar-plan"><div className="plan-mark">P</div><span><strong>Personal workspace</strong><small>Local data only</small></span><ChevronDown size={15} /></div>
      <button className="sidebar-bottom-link"><Settings2 size={16} />Settings</button>
      <button className="sidebar-bottom-link"><CircleHelp size={16} />Help center</button>
      <button className="account-row"><span className="avatar">A</span><span className="account-copy"><strong>Aditya</strong><small>Free workspace</small></span><ChevronDown size={15} /></button>
    </aside>
  );
}
