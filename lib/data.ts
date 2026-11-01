import type { SuggestedSource } from "./schemas";

export const SAMPLE_SUGGESTED_SOURCES: SuggestedSource[] = [
  {
    url: "https://scholarships.example.gov.in/surya/renewal-faq",
    title: "Surya Scholars Grant — Renewal FAQ and Guidelines",
    snippet: "Official guidelines on academic performance (minimum 60% marks) and required renewal documents.",
    domain: "scholarships.example.gov.in",
    officialGuess: true,
    label: "ai_suggested",
  },
  {
    url: "https://highereducation.example.gov.in/schemes/merit-grants",
    title: "State Department of Higher Education — Merit Grant Matrix",
    snippet: "Directory of state-funded merit grants, eligible student categories, and certified application routes.",
    domain: "highereducation.example.gov.in",
    officialGuess: true,
    label: "ai_suggested",
  },
  {
    url: "https://student-advisory.example.org/grants/surya-checklist",
    title: "Student Advisory Council: 2026 Surya Grant Verification Guide",
    snippet: "Step-by-step checklist of documents required by Tehsildar offices and the scholarship cell.",
    domain: "student-advisory.example.org",
    officialGuess: false,
    label: "ai_suggested",
  },
  {
    url: "https://edupost.example.com/analysis/surya-grant-discrepancies",
    title: "Understanding Document Requirements for 2026-27 Merit Grants",
    snippet: "Analysis of differences between university tax declarations and state revenue department certificates.",
    domain: "edupost.example.com",
    officialGuess: false,
    label: "ai_suggested",
  },
  {
    url: "https://scholarships.example.gov.in/helpdesk/faq",
    title: "Central Scholarships Helpdesk — Frequently Asked Questions",
    snippet: "Contact channels, helpline hours, and dispute resolution for academic grant applicants.",
    domain: "scholarships.example.gov.in",
    officialGuess: true,
    label: "ai_suggested",
  },
];

