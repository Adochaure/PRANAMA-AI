import * as chrono from "chrono-node";

function isoDate(value: string | Date | null | undefined, referenceDate: Date) {
  if (!value) return null;
  const isDate = value instanceof Date;
  const direct = isDate ? value : new Date(value);
  const parsed = Number.isNaN(direct.getTime()) && !isDate ? chrono.parseDate(value, referenceDate) : direct;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : null;
}

function labeledDate(text: string, labels: string[], referenceDate: Date) {
  for (const label of labels) {
    const expression = new RegExp(`(?:${label})\\s*[:\\-]?\\s*((?:\\d{4}[-/]\\d{1,2}[-/]\\d{1,2})|(?:\\d{1,2}[ ./-][A-Za-z]{3,9}[, ]+\\d{4})|(?:[A-Za-z]{3,9}\\s+\\d{1,2},?\\s+\\d{4}))`, "i");
    const match = text.match(expression);
    if (match?.[1]) {
      const result = isoDate(match[1], referenceDate);
      if (result) return result;
    }
  }
  return null;
}

export function normalizeCycle(year: string, endYear: string) {
  const start = Number(year);
  const end = Number(endYear.length === 2 ? `${year.slice(0, 2)}${endYear}` : endYear);
  if (!Number.isInteger(start) || !Number.isInteger(end) || end < start || end > start + 1) return null;
  return `${start}-${String(end).slice(-2)}`;
}

export function extractDates(input: {
  text: string;
  published?: string | Date | null;
  modified?: string | Date | null;
  referenceDate?: Date;
}) {
  const referenceDate = input.referenceDate ?? new Date();
  const published = isoDate(input.published, referenceDate)
    ?? labeledDate(input.text, ["published", "posted", "issued", "dated"], referenceDate);
  const modified = isoDate(input.modified, referenceDate)
    ?? labeledDate(input.text, ["last updated", "modified", "updated"], referenceDate);
  const cycles = new Set<string>();
  for (const match of input.text.matchAll(/\b(20\d{2})\s*[-–/]\s*(\d{2,4})\b/g)) {
    const cycle = normalizeCycle(match[1], match[2]);
    if (cycle) cycles.add(cycle);
  }
  return { published, modified, cycles: [...cycles] };
}

export function parseDeadline(value: string, referenceDate: Date) {
  const parsed = chrono.strict.parseDate(value, referenceDate) ?? chrono.parseDate(value, referenceDate);
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
}
