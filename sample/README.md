# Fictional analysis sample

Every source in this folder is invented for local development. The Surya Scholars Grant and its notices are fictional and must not be used as real application guidance.

Run the deterministic fixture with `npm run sample:mock`, or use Groq with `npm run sample` after setting `GROQ_API_KEY` in `.env.local`. Add `--include-renewal` to include the held-back renewal FAQ and verify that the renewal gap closes.

`npm run sample:write` regenerates the static `precomputed-result.json` served by `GET /api/sample`.
