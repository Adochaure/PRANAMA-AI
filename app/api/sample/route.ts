import { readFile } from "node:fs/promises";
import path from "node:path";
import { AnalysisResult } from "@/lib/schemas";

export async function GET() {
  const file = await readFile(path.join(process.cwd(), "sample", "precomputed-result.json"), "utf8");
  const result = AnalysisResult.parse(JSON.parse(file));
  return Response.json(result, {
    headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" },
  });
}
