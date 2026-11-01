import { createHash } from "node:crypto";
import { extractDates } from "./extractDates";
import { extractMain } from "./extractMain";
import { fetchPublicUrl } from "./fetchUrl";
import { extractPdf } from "./pdf";
import { checkRobots } from "./robots";
import { UrlSecurityError } from "./ssrf";
import type { AnalyzeRequest, Source } from "../schemas";

export const MAX_SOURCE_CHARS = 30_000;
const MAX_LOCAL_PDF_BYTES = 2 * 1024 * 1024;

function officialDomain(domain: string | null) {
  return Boolean(domain && /(?:^|\.)(?:gov\.in|nic\.in|ac\.in|edu|gov)$/i.test(domain));
}

function sourceHash(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

function normalizeText(text: string) {
  return text.replace(/\r\n?/g, "\n").replace(/[\t\u00a0 ]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function base64Buffer(value: string) {
  const base64 = value.replace(/^data:application\/pdf;base64,/i, "").replace(/\s/g, "");
  if (!base64 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) {
    throw new Error("The PDF upload is not valid base64 data.");
  }
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("The uploaded file is not a PDF.");
  if (buffer.length > MAX_LOCAL_PDF_BYTES) throw new Error("PDF uploads must be 2 MB or smaller.");
  return buffer;
}

type ParsedSource = { title?: string; text: string; published?: string | Date | null; modified?: string | Date | null; kind?: "text" | "pdf" | "url" };

async function parseRemoteSource(input: AnalyzeRequest["sources"][number]): Promise<ParsedSource & { url: string; domain: string }> {
  if (!input.url) throw new Error("Add a public URL or paste the source text instead.");
  const initialUrl = new URL(input.url);
  const robots = await checkRobots(initialUrl);
  if (!robots.allowed) throw new SourceBlockedError(robots.reason ?? "This source is blocked by robots.txt. Paste the source text instead.");

  const response = await fetchPublicUrl(initialUrl);
  if (response.status === 401 || response.status === 403) throw new SourceBlockedError("The site denied access to this source. Paste the source text instead.");
  if (response.status < 200 || response.status >= 300) throw new Error(`The source returned HTTP ${response.status}. Paste the source text instead.`);
  const contentType = String(response.headers["content-type"] ?? "").split(";", 1)[0].trim().toLowerCase();
  const firstBytes = response.body.subarray(0, 8).toString("latin1");
  const isPdf = contentType === "application/pdf" || firstBytes.startsWith("%PDF-");
  const domain = response.url.hostname.replace(/^\[|\]$/g, "");

  if (input.kind === "pdf" && !isPdf) throw new Error("That link did not return a PDF. Add a direct PDF link or paste the source text instead.");
  if (isPdf) {
    const parsed = await extractPdf(response.body);
    return { ...parsed, kind: "pdf", url: response.url.toString(), domain };
  }
  if (contentType === "text/plain") {
    return { title: input.title, text: response.body.toString("utf8"), kind: "url", url: response.url.toString(), domain };
  }
  if (contentType === "text/html" || contentType === "application/xhtml+xml" || contentType === "" && /<(?:!doctype|html|head|body)\b/i.test(response.body.subarray(0, 1024).toString("utf8"))) {
    const parsed = extractMain(response.body.toString("utf8"));
    return { ...parsed, kind: "url", url: response.url.toString(), domain };
  }
  throw new Error("This source type is not supported. Add an HTML page, PDF, or plain-text URL.");
}

class SourceBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceBlockedError";
  }
}

async function parseInput(input: AnalyzeRequest["sources"][number]): Promise<ParsedSource & { url: string | null; domain: string | null }> {
  if (input.kind === "text") {
    return { title: input.title ?? "Pasted text", text: input.text ?? "", kind: "text", url: null, domain: null };
  }
  if (input.kind === "pdf" && input.fileBase64) {
    const parsed = await extractPdf(base64Buffer(input.fileBase64));
    return { ...parsed, title: input.title ?? input.filename ?? parsed.title, kind: "pdf", url: null, domain: null };
  }
  return parseRemoteSource(input);
}

function failedSource(input: AnalyzeRequest["sources"][number], error: unknown, ordinal: number): Source {
  const message = error instanceof Error ? error.message : "The source could not be read.";
  const blocked = error instanceof UrlSecurityError || error instanceof SourceBlockedError;
  const emptyText = "";
  const domain = input.url ? (() => { try { return new URL(input.url).hostname; } catch { return null; } })() : null;
  return {
    id: input.id,
    kind: input.kind,
    url: input.url ?? null,
    title: input.title ?? input.filename ?? `Source ${ordinal}`,
    domain,
    isOfficial: input.isOfficial ?? officialDomain(domain),
    status: blocked ? "blocked" : "failed",
    error: message,
    text: emptyText,
    hash: sourceHash(emptyText),
    dates: { published: null, modified: null, cycles: [] },
  };
}

export async function ingestOne(input: AnalyzeRequest["sources"][number], ordinal = 1, referenceDate = new Date()): Promise<Source> {
  try {
    const parsed = await parseInput(input);
    const cleaned = normalizeText(parsed.text);
    const text = cleaned.slice(0, MAX_SOURCE_CHARS);
    const dates = extractDates({ text, published: parsed.published, modified: parsed.modified, referenceDate });
    const domain = parsed.domain ?? null;
    const status = !text ? "empty" : cleaned.length > MAX_SOURCE_CHARS ? "truncated" : "ok";
    return {
      id: input.id,
      kind: parsed.kind ?? input.kind,
      url: parsed.url ?? input.url ?? null,
      title: input.title ?? parsed.title ?? `Source ${ordinal}`,
      domain,
      isOfficial: input.isOfficial ?? officialDomain(domain),
      status,
      error: status === "empty" ? "No readable text was found in this source. Paste the source text instead." : status === "truncated" ? `Only the first ${MAX_SOURCE_CHARS.toLocaleString()} characters were analyzed.` : null,
      text,
      hash: sourceHash(text),
      dates,
    };
  } catch (error) {
    return failedSource(input, error, ordinal);
  }
}

export async function ingestSources(
  inputs: AnalyzeRequest["sources"],
  onSource?: (source: Source) => void | Promise<void>,
  referenceDate = new Date(),
) {
  const output = new Array<Source>(inputs.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(4, inputs.length) }, async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= inputs.length) return;
      const source = await ingestOne(inputs[index], index + 1, referenceDate);
      output[index] = source;
      await onSource?.(source);
    }
  });
  await Promise.all(workers);
  return output;
}
