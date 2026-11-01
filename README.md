# Pramana

Pramana compares user-provided sources, checks quoted claims against their source text, and reports gaps, outdated information, and disagreements.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

Set `GROQ_API_KEY` in `.env.local` for live analysis. Copy `.env.example` as a reference; keep API secrets server-side.

## Analysis API

`POST /api/analyze` accepts JSON and responds with server-sent events. Every event is JSON in a `data:` line. Progress events use `type: "step"`; per-source results use `type: "source"`; the final `type: "result"` contains a complete `AnalysisResult`.

```json
{
  "question": "What are the eligibility requirements?",
  "sources": [
    { "id": "official", "kind": "url", "url": "https://public.example.org/notice" },
    { "id": "notes", "kind": "text", "title": "My notes", "text": "Paste source text here." }
  ]
}
```

PDFs can be sent as a public PDF URL with `kind: "pdf"`, or as uploaded base64 data in `fileBase64` with an optional `filename`. Limits are 8 sources, 30,000 extracted characters per source, 2 MB per fetched source or uploaded PDF, and 100 pages per PDF. Link fetching rejects private and reserved IPs, revalidates each redirect, follows robots.txt, and accepts HTML, plain text, or PDF.

`GET /api/sample` returns the precomputed fictional grant analysis without calling Groq. Regenerate it after changing the fixtures with `npm run sample:write`. All sample documents are invented and are not real application guidance.

Run Stage 3 deterministic checks with `npm run test:stage3`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
