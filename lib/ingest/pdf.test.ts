import assert from "node:assert/strict";
import test from "node:test";
import { ingestOne } from "./index";

function createSinglePagePdf(text: string) {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
  ];
  let document = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(document, "latin1"));
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const crossReferenceOffset = Buffer.byteLength(document, "latin1");
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) document += `${String(offset).padStart(10, "0")} 00000 n \n`;
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${crossReferenceOffset}\n%%EOF`;
  return Buffer.from(document, "latin1");
}

test("PDF ingestion extracts text, hashes content, and marks a readable PDF", async () => {
  const pdf = createSinglePagePdf("Surya grant deadline is 15 December 2026");
  const source = await ingestOne({ id: "sample-pdf", kind: "pdf", fileBase64: pdf.toString("base64"), filename: "grant.pdf" }, 1, new Date("2026-11-01T00:00:00.000Z"));

  assert.equal(source.status, "ok");
  assert.equal(source.kind, "pdf");
  assert.match(source.text, /15 December 2026/);
  assert.equal(source.title, "grant.pdf");
  assert.equal(source.hash.length, 64);
});
