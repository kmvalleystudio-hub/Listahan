import { toTitleCaseWords } from "./textFormat";

/** Strip common list prefixes: bullets, numbers, checkbox markers. */
function stripListPrefix(line: string): string {
  let s = line.trim();
  // [ ] [x] ☐ etc.
  s = s.replace(/^\[[\sxX._-]*\]\s*/, "");
  // 1. 2) (1) -
  s = s.replace(/^[([]?\d+[.)]\s*/, "");
  s = s.replace(/^[-–—*•·▪▸]+\s*/, "");
  return s.trim();
}

/**
 * One task per non-empty line (after stripping list markers).
 * OCR text is split on blank lines; each line becomes a single task name.
 */
export function parseScannedTodoListLocal(text: string): string[] {
  const cleaned = text.replace(/\r/g, "\n").trim();
  if (!cleaned) return [];

  const lines = cleaned
    .split(/\n+/)
    .map((l) => stripListPrefix(l))
    .filter(Boolean);

  const out: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const name = toTitleCaseWords(line.trim());
    if (!name.trim()) continue;
    const key = name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name.trim());
  }
  return out;
}
