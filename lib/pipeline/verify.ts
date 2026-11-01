import type { Aspect, Claim, ExtractedClaim, Source } from "../schemas";

type IndexedText = { normalized: string; starts: number[]; ends: number[] };

export function normalizeIndexed(input: string): IndexedText {
  let normalized = "";
  const starts: number[] = [];
  const ends: number[] = [];
  let previousWhitespace = false;
  for (let index = 0; index < input.length;) {
    const character = String.fromCodePoint(input.codePointAt(index)!);
    const end = index + character.length;
    const folded = character.normalize("NFKC")
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2010-\u2015\u2212]/g, "-")
      .toLowerCase();
    for (const unit of folded) {
      if (/\s/u.test(unit)) {
        if (!normalized) continue;
        if (previousWhitespace) {
          ends[ends.length - 1] = end;
        } else {
          normalized += " ";
          starts.push(index);
          ends.push(end);
          previousWhitespace = true;
        }
        continue;
      }
      normalized += unit;
      for (let offset = 0; offset < unit.length; offset++) {
        starts.push(index);
        ends.push(end);
      }
      previousWhitespace = false;
    }
    index = end;
  }
  if (normalized.endsWith(" ")) {
    normalized = normalized.slice(0, -1);
    starts.pop();
    ends.pop();
  }
  return { normalized, starts, ends };
}

function isKnownAspect(aspectId: string, aspects: Aspect[]) {
  return aspects.some((aspect) => aspect.id === aspectId);
}

export function verifyClaims(
  rawBySource: Map<string, ExtractedClaim[]>,
  sources: Source[],
  aspects: Aspect[],
  cachedClaims: Claim[] = [],
) {
  const sourcesById = new Map(sources.map((source) => [source.id, source]));
  const result: Claim[] = [];
  let discardedClaims = 0;
  const existingCacheIds = new Set<string>();
  for (const source of sources) {
    if (source.status !== "ok" && source.status !== "truncated") continue;
    const sourceIndex = normalizeIndexed(source.text);
    const cachedForSource = cachedClaims.filter((claim) => claim.sourceId === source.id);
    for (const claim of cachedForSource) {
      if (!isKnownAspect(claim.aspectId, aspects)) {
        discardedClaims++;
        continue;
      }
      const normalizedQuote = normalizeIndexed(claim.quote).normalized;
      const start = sourceIndex.normalized.indexOf(normalizedQuote);
      if (!normalizedQuote || start < 0) {
        discardedClaims++;
        continue;
      }
      const end = start + normalizedQuote.length;
      const verified = {
        ...claim,
        quoteStart: sourceIndex.starts[start],
        quoteEnd: sourceIndex.ends[end - 1],
        quote: source.text.slice(sourceIndex.starts[start], sourceIndex.ends[end - 1]),
      };
      existingCacheIds.add(`${claim.sourceId}:${claim.aspectId}:${claim.quote}`);
      result.push(verified);
    }
  }

  for (const [sourceId, extracted] of rawBySource) {
    const source = sourcesById.get(sourceId);
    if (!source || source.status !== "ok" && source.status !== "truncated") {
      discardedClaims += extracted.length;
      continue;
    }
    const sourceIndex = normalizeIndexed(source.text);
    for (const [index, claim] of extracted.entries()) {
      if (!isKnownAspect(claim.aspect_id, aspects)) {
        discardedClaims++;
        continue;
      }
      const normalizedQuote = normalizeIndexed(claim.quote).normalized;
      const start = sourceIndex.normalized.indexOf(normalizedQuote);
      if (!normalizedQuote || normalizedQuote.length < 10 || start < 0) {
        discardedClaims++;
        continue;
      }
      const end = start + normalizedQuote.length;
      const quoteStart = sourceIndex.starts[start];
      const quoteEnd = sourceIndex.ends[end - 1];
      result.push({
        id: `claim-${sourceId}-${index + 1}`,
        sourceId,
        aspectId: claim.aspect_id,
        statement: claim.statement,
        value: claim.value,
        quote: source.text.slice(quoteStart, quoteEnd),
        quoteStart,
        quoteEnd,
        asOf: claim.as_of,
      });
    }
  }

  const unique: Claim[] = [];
  const seen = new Set<string>();
  for (const claim of result) {
    const key = `${claim.sourceId}:${claim.aspectId}:${claim.quote}`;
    if (seen.has(key) || existingCacheIds.has(key) && claim.id.startsWith("claim-")) continue;
    seen.add(key);
    unique.push(claim);
  }
  return { claims: unique, discardedClaims };
}
