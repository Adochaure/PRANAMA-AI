import { fetchPublicUrl } from "./fetchUrl";

type Rule = { allow: boolean; pattern: string; specificity: number };

export function isAllowedByRobots(robotsText: string, userAgent: string, pathAndQuery: string) {
  const groups: Array<{ agents: string[]; rules: Rule[] }> = [];
  let current: { agents: string[]; rules: Rule[] } | null = null;
  for (const rawLine of robotsText.split(/\r?\n/)) {
    const line = rawLine.split("#", 1)[0].trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (field === "user-agent") {
      if (!current || current.rules.length) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      continue;
    }
    if ((field === "allow" || field === "disallow") && current && value) {
      current.rules.push({ allow: field === "allow", pattern: value, specificity: value.replace(/[\*$]/g, "").length });
    }
  }

  const agentName = userAgent.split("/")[0].toLowerCase();
  const specificGroups = groups.filter((group) => group.agents.some((agent) => agent !== "*" && agentName.includes(agent)));
  const selected = specificGroups.length
    ? specificGroups.flatMap((group) => group.rules)
    : groups.filter((group) => group.agents.includes("*")).flatMap((group) => group.rules);
  const matching = selected.filter((rule) => {
    const anchored = rule.pattern.endsWith("$");
    const pattern = anchored ? rule.pattern.slice(0, -1) : rule.pattern;
    const expression = new RegExp(`^${pattern.split("*").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*")}${anchored ? "$" : ""}`);
    return expression.test(pathAndQuery);
  }).sort((a, b) => b.specificity - a.specificity || Number(b.allow) - Number(a.allow));
  return matching[0]?.allow ?? true;
}

export async function checkRobots(url: URL) {
  const robotsUrl = new URL("/robots.txt", url.origin);
  try {
    const response = await fetchPublicUrl(robotsUrl, { maxBytes: 256 * 1024, maxRedirects: 3 });
    if (response.status === 404 || response.status === 410) return { allowed: true, reason: null };
    if (response.status === 401 || response.status === 403) return { allowed: false, reason: "The site does not allow PramanaBot to read its robots.txt rules." };
    if (response.status < 200 || response.status >= 300) return { allowed: true, reason: null };
    const rules = response.body.toString("utf8");
    if (!isAllowedByRobots(rules, "PramanaBot/1.0", `${url.pathname}${url.search}`)) {
      return { allowed: false, reason: "This site disallows automated reading of this page in robots.txt. Paste the source text instead." };
    }
    return { allowed: true, reason: null };
  } catch {
    return { allowed: true, reason: null };
  }
}
