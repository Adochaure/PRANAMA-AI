import assert from "node:assert/strict";
import test from "node:test";
import { Aspect, Source } from "../schemas";
import { verifyClaims } from "./verify";

test("quote verification maps normalized punctuation back to the exact source span", () => {
  const source = Source.parse({
    id: "official",
    kind: "text",
    url: null,
    title: "Official notice",
    domain: null,
    isOfficial: true,
    status: "ok",
    error: null,
    text: "The notice says “Submit your fresh income certificate by 15 December 2026.”",
    hash: "sample",
    dates: { published: null, modified: null, cycles: [] },
  });
  const aspect = Aspect.parse({
    id: "documents",
    label: "Documents",
    question: "Which document is needed?",
    description: "Required application documents.",
    importance: 5,
    keywords: ["certificate", "submit"],
  });
  const verification = verifyClaims(new Map([["official", [
    { aspect_id: "documents", statement: "Submit an income certificate.", value: "Fresh income certificate", quote: "submit your fresh income certificate by 15 December 2026.", as_of: null },
    { aspect_id: "documents", statement: "A forged claim.", value: "False claim", quote: "This sentence does not appear in the source.", as_of: null },
  ]]]), [source], [aspect]);

  assert.equal(verification.discardedClaims, 1);
  assert.equal(verification.claims.length, 1);
  assert.equal(source.text.slice(verification.claims[0].quoteStart, verification.claims[0].quoteEnd), verification.claims[0].quote);
  assert.equal(verification.claims[0].quote, "Submit your fresh income certificate by 15 December 2026.");
});
