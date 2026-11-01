import { ChecklistOutput, type Aspect, type ChecklistItem, type Finding } from "../schemas";
import { MODELS } from "../models";
import { buildChecklistPrompt, CHECKLIST_SYSTEM } from "../prompts";
import { callJson } from "../llm";

export async function makeChecklist(question: string, findings: Finding[], aspects: Aspect[]): Promise<ChecklistItem[]> {
  if (!findings.length) return [];
  const output = await callJson({
    model: MODELS.smart,
    effort: "medium",
    system: CHECKLIST_SYSTEM,
    user: buildChecklistPrompt(question, findings, aspects),
    schema: ChecklistOutput,
    name: "verification_checklist",
  });
  const knownFindings = new Set(findings.map((finding) => finding.id));
  const importanceByFinding = new Map(findings.map((finding) => [finding.id, aspects.find((aspect) => aspect.id === finding.aspectId)?.importance ?? 1]));
  return output.items
    .map((item, index) => ({ ...item, finding_ids: [...new Set(item.finding_ids)].filter((id) => knownFindings.has(id)), index }))
    .filter((item) => item.finding_ids.length > 0)
    .sort((a, b) => b.impact * b.uncertainty - a.impact * a.uncertainty
      || Math.max(...b.finding_ids.map((id) => importanceByFinding.get(id) ?? 1)) - Math.max(...a.finding_ids.map((id) => importanceByFinding.get(id) ?? 1))
      || a.index - b.index)
    .slice(0, 12)
    .map((item, index) => ({
      finding_ids: item.finding_ids,
      action: item.action,
      reason: item.reason,
      where_to_verify: item.where_to_verify,
      impact: item.impact,
      uncertainty: item.uncertainty,
      id: `check-${index + 1}`,
      rank: index + 1,
      label: "ai_suggested",
    }));
}
