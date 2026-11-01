import assert from "node:assert/strict";
import test from "node:test";
import { extractMain } from "./extractMain";

test("HTML extraction keeps the main article and source publication metadata", () => {
  const parsed = extractMain(`<!doctype html>
    <html><head>
      <meta property="og:title" content="Official grant notice">
      <meta property="article:published_time" content="2026-06-10T09:00:00Z">
    </head><body>
      <nav>Navigation boilerplate</nav>
      <main><h1>Surya grant</h1><p>Applications close on 15 December 2026.</p><p>Submit an income certificate.</p></main>
      <footer>Footer boilerplate</footer>
    </body></html>`);

  assert.equal(parsed.title, "Official grant notice");
  assert.match(parsed.text, /Applications close on 15 December 2026/);
  assert.doesNotMatch(parsed.text, /Navigation boilerplate|Footer boilerplate/);
  assert.equal(parsed.published, "2026-06-10T09:00:00Z");
});
