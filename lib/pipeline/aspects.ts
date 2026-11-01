import { AspectsOutput, type Aspect } from "../schemas";
import { ASPECTS_SYSTEM, buildAspectsPrompt } from "../prompts";
import { MODELS } from "../models";
import { callJson } from "../llm";

export async function makeAspects(question: string, today: string, locked?: Aspect[]) {
  if (locked?.length) return AspectsOutput.parse({ aspects: locked }).aspects;
  const output = await callJson({
    model: MODELS.smart,
    effort: "medium",
    system: ASPECTS_SYSTEM,
    user: buildAspectsPrompt(question, today),
    schema: AspectsOutput,
    name: "analysis_aspects",
  });
  return output.aspects;
}
