export const MAX_PDF_PAGES = 100;

export async function extractPdf(buffer: Buffer) {
  // pdf-parse loads pdfjs-dist, which expects browser canvas globals such as
  // DOMMatrix. Keep that package out of the route's startup import graph so
  // text and URL analyses can run in serverless runtimes without those globals.
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer, isEvalSupported: false, useWorkerFetch: false });
  try {
    const info = await parser.getInfo();
    if (info.total > MAX_PDF_PAGES) {
      throw new Error(`This PDF has ${info.total} pages. The maximum supported is ${MAX_PDF_PAGES}.`);
    }
    const extracted = await parser.getText({ first: MAX_PDF_PAGES });
    const dates = info.getDateNode();
    const title = typeof info.info?.Title === "string" && info.info.Title.trim() ? info.info.Title.trim() : "Uploaded PDF";
    return {
      title,
      text: extracted.text,
      published: dates.CreationDate ?? dates.XmpCreateDate ?? dates.XapCreateDate ?? null,
      modified: dates.ModDate ?? dates.XmpModifyDate ?? dates.XapModifyDate ?? null,
    };
  } finally {
    await parser.destroy();
  }
}
