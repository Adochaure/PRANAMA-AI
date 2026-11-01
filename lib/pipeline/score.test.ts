import assert from "node:assert/strict";
import test from "node:test";
import { Aspect, Cell, Claim, Finding, Source } from "../schemas";
import { calculateScore } from "./score";

test("an unresolved source conflict reduces completeness to the conflict weight", () => {
  const aspect = Aspect.parse({
    id: "supporting_documents",
    label: "Supporting documents",
    question: "Which document is required?",
    description: "Required proof of income.",
    importance: 5,
    keywords: ["certificate", "income tax return"],
  });
  const sources = [
    Source.parse({ id: "official", kind: "text", url: null, title: "Official", domain: null, isOfficial: true, status: "ok", error: null, text: "Tehsildar certificate required.", hash: "a", dates: { published: null, modified: null, cycles: [] } }),
    Source.parse({ id: "blog", kind: "text", url: null, title: "Blog", domain: null, isOfficial: false, status: "ok", error: null, text: "Tax return required.", hash: "b", dates: { published: null, modified: null, cycles: [] } }),
  ];
  const claims = [
    Claim.parse({ id: "a", sourceId: "official", aspectId: aspect.id, statement: "Certificate needed.", value: "Certificate", quote: "Tehsildar certificate required.", quoteStart: 0, quoteEnd: 30, asOf: null }),
    Claim.parse({ id: "b", sourceId: "blog", aspectId: aspect.id, statement: "Tax return needed.", value: "Tax return", quote: "Tax return required.", quoteStart: 0, quoteEnd: 21, asOf: null }),
  ];
  const cells = sources.map((source) => Cell.parse({ aspectId: aspect.id, sourceId: source.id, status: "covered", claimIds: [source.id === "official" ? "a" : "b"], hint: null }));
  const conflict = Finding.parse({ id: "conflict", type: "conflict", aspectId: aspect.id, title: "Conflict", explanation: "Sources disagree.", severity: "high", evidence: [], label: "sourced" });
  const score = calculateScore({ aspects: [aspect], sources, claims, cells, findings: [conflict] });

  assert.deepEqual(score, { completeness: 40, darkSpot: 60 });
});
