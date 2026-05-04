// eslint-disable-next-line @typescript-eslint/no-var-requires
const wordsToNumbers = require("words-to-numbers") as (s: string) => string | number | null;

/**
 * Best-effort: turn spoken price phrases into a numeric string for the price field.
 * Examples: "one hundred fifty pesos" -> "150", "2 dollars and 50 cents" -> "2.50"
 */
export function parsePriceFromSpeech(text: string): string {
  const raw = text.trim();
  if (!raw) return "";

  const lower = raw.toLowerCase();

  const dollarsCents = lower.match(
    /^(.*?)(?:\$|dollar|dollars|usd|peso|pesos)?\s*(\d+(?:\.\d+)?|\b[\w\s-]+\b)\s*(?:dollar|dollars|usd)?\s*(?:and\s*)?(\d+(?:\.\d+)?|\b[\w\s-]+\b)\s*cents?\b/i
  );
  if (dollarsCents) {
    const d = coerceNumber(dollarsCents[2]);
    const c = coerceNumber(dollarsCents[3]);
    if (d != null && c != null) {
      return (d + c / 100).toFixed(2);
    }
  }

  const onlyCents = lower.match(/^(\d+(?:\.\d+)?|\b[\w\s-]+\b)\s*cents?\b/i);
  if (onlyCents) {
    const c = coerceNumber(onlyCents[1]);
    if (c != null) return (c / 100).toFixed(2);
  }

  const stripped = lower
    .replace(/[₱$€£]/g, " ")
    .replace(/\b(peso|pesos|php|dollar|dollars|usd|cent|cents)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const n = coerceNumber(stripped);
  if (n != null) return Number.isInteger(n) ? String(n) : n.toFixed(2);

  return "";
}

function coerceNumber(fragment: string): number | null {
  const f = fragment.trim();
  if (!f) return null;

  const direct = parseFloat(f.replace(/,/g, ""));
  if (Number.isFinite(direct)) return direct;

  try {
    const w = wordsToNumbers(f);
    if (typeof w === "number" && Number.isFinite(w)) return w;
    if (typeof w === "string") {
      const p = parseFloat(w.replace(/,/g, ""));
      if (Number.isFinite(p)) return p;
    }
  } catch {
    /* ignore */
  }

  return null;
}
