import { load } from "cheerio";

export type HtmlExtraction = { title: string; text: string; published: string | null; modified: string | null };

function firstContent($: ReturnType<typeof load>, selectors: string[]) {
  for (const selector of selectors) {
    const value = $(selector).first().attr("content") ?? $(selector).first().attr("datetime");
    if (value?.trim()) return value.trim();
  }
  return null;
}

export function extractMain(html: string): HtmlExtraction {
  const $ = load(html, {}, false);
  const title = firstContent($, ["meta[property='og:title']", "meta[name='twitter:title']"])
    ?? $("title").first().text().trim()
    ?? $("h1").first().text().trim()
    ?? "Untitled source";
  $("script, style, noscript, svg, canvas, nav, footer, header, aside, form, button, iframe, [aria-hidden='true']").remove();
  const root = $("main, article, [role='main']").first().length ? $("main, article, [role='main']").first() : $("body");
  const blocks = root.find("h1, h2, h3, h4, p, li, tr, blockquote").toArray()
    .map((element) => $(element).text().replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const text = (blocks.length ? blocks.join("\n") : root.text()).replace(/[\t\u00a0 ]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  const published = firstContent($, [
    "meta[property='article:published_time']",
    "meta[name='datePublished']",
    "meta[itemprop='datePublished']",
    "time[pubdate]",
  ]);
  const modified = firstContent($, [
    "meta[property='article:modified_time']",
    "meta[name='dateModified']",
    "meta[itemprop='dateModified']",
    "meta[name='last-modified']",
  ]);
  return { title: title || $("h1").first().text().trim() || "Untitled source", text, published, modified };
}
