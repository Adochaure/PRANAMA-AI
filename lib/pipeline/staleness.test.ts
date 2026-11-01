import assert from "node:assert/strict";
import test from "node:test";
import { Aspect, Claim, Source } from "../schemas";
import { analyzeStaleness } from "./staleness";

test("staleness separates an older cycle and flags dates older than twelve months", () => {
  const aspects = [Aspect.parse({
    id: "application_deadline",
    label: "Application deadline",
    question: "When is the deadline?",
    description: "The last date to apply.",
    importance: 5,
    keywords: ["deadline", "last date"],
  })];
  const oldSource = Source.parse({
    id: "archive",
    kind: "text",
    url: null,
    title: "Archived notice",
    domain: null,
    isOfficial: true,
    status: "ok",
    error: null,
    text: "Academic cycle: 2023-24. Deadline was 10 November 2023.",
    hash: "old",
    dates: { published: "2023-05-02", modified: null, cycles: ["2023-24"] },
  });
  const currentSource = Source.parse({
    ...oldSource,
    id: "current",
    title: "Current notice",
    text: "Academic cycle: 2026-27.",
    hash: "current",
    dates: { published: "2026-06-10", modified: null, cycles: ["2026-27"] },
  });
  const claim = Claim.parse({
    id: "old-deadline",
    sourceId: "archive",
    aspectId: "application_deadline",
    statement: "The old deadline was 10 November 2023.",
    value: "10 November 2023",
    quote: "Deadline was 10 November 2023.",
    quoteStart: 30,
    quoteEnd: 60,
    asOf: "2023-24",
  });

  const result = analyzeStaleness(aspects, [oldSource, currentSource], [claim], new Date("2026-11-01T12:00:00.000Z"));
  assert.ok(result.outdatedSourceIds.has("archive"));
  assert.ok(result.outdatedClaimIds.has("old-deadline"));
  assert.ok(result.findings.some((finding) => finding.id === "outdated-archive"));
  assert.ok(result.findings.some((finding) => finding.id === "outdated-deadline-old-deadline"));
  assert.ok(result.warnings.some((warning) => warning.includes("12 months")));
});
