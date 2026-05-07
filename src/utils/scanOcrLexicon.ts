import { getRegistryVocabularyTokens } from "./productRegistry";

/** Common grocery / list words — avoids flagging everything OCR already got right. */
const COMMON_GROCERY_WORDS = new Set(
  [
    "a",
    "an",
    "the",
    "and",
    "or",
    "of",
    "for",
    "with",
    "extra",
    "big",
    "small",
    "medium",
    "large",
    "family",
    "pack",
    "pcs",
    "pc",
    "bottle",
    "can",
    "box",
    "bag",
    "green",
    "red",
    "white",
    "blue",
    "yellow",
    "fresh",
    "frozen",
    "cooked",
    "raw",
    "sweet",
    "sour",
    "spicy",
    "milk",
    "water",
    "juice",
    "rice",
    "bread",
    "egg",
    "eggs",
    "fish",
    "meat",
    "chicken",
    "pork",
    "beef",
    "ham",
    "soap",
    "shampoo",
    "diaper",
    "diapers",
    "baby",
    "carrots",
    "carrot",
    "lemon",
    "apple",
    "banana",
    "onion",
    "garlic",
    "salt",
    "sugar",
    "oil",
    "coffee",
    "tea",
    "chocolate",
    "candy",
    "snack",
    "noodles",
    "pasta",
    "pancit",
    "canton",
    "tocino",
    "longganisa",
    "evaporated",
    "evaporada",
    "condensed",
    "cream",
    "cheese",
    "butter",
    "yogurt",
    "notebook",
    "notebooks",
    "paper",
    "pen",
    "pencil",
    "dove",
    "sunsilk",
    "eq",
    "in",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "11",
    "12",
    "3in1",
    "gms",
    "gm",
    "ml",
    "l",
    "kg",
    "g",
    "mg",
    "oz",
    "lb",
  ].map((w) => w.toLowerCase())
);

/** Frequent OCR confusions on handwritten lists (lowercase key). */
const OCR_TYPOS: Record<string, string> = {
  sunall: "small",
  smail: "small",
  cantow: "canton",
  cantonw: "canton",
  parcit: "pancit",
  exta: "extra",
  torino: "tocino",
  saap: "soap",
  soop: "soap",
  notebours: "notebooks",
  notebouks: "notebooks",
  notebookks: "notebooks",
  corked: "cooked",
  eqdiaper: "EQ Diaper",
  // letter O misread as zero in "10"
  lo: "10",
};

let registryTokensCache: Set<string> | null = null;
function registryTokens(): Set<string> {
  if (!registryTokensCache) registryTokensCache = getRegistryVocabularyTokens();
  return registryTokensCache;
}

function alphaKey(raw: string): string {
  return raw.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function isNumericLike(raw: string): boolean {
  return /^[0-9]+$/.test(raw) || /^[0-9]+(?:\.[0-9]+)?$/.test(raw);
}

function isUnitLike(raw: string): boolean {
  return /^(?:\d+(?:\.\d+)?)(?:ml|l|g|kg|mg|gms?|oz|lb|lbs|pcs?|pc)$/i.test(raw);
}

export function isTrustedOcrWord(raw: string): boolean {
  const t = raw.toLowerCase();
  if (!t) return true;
  if (isNumericLike(t)) return true;
  if (isUnitLike(t)) return true;
  if (COMMON_GROCERY_WORDS.has(t)) return true;
  if (registryTokens().has(t)) return true;
  const ak = alphaKey(raw);
  if (ak && COMMON_GROCERY_WORDS.has(ak)) return true;
  if (ak && registryTokens().has(ak)) return true;
  return false;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return dp[b.length];
}

function uniqueStrings(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

/**
 * Suggestions for a single OCR word token (not whole lines).
 * First entry is the best guess when present.
 */
export function suggestOcrWordCorrections(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const lower = trimmed.toLowerCase();
  const ak = alphaKey(trimmed);

  const typo =
    OCR_TYPOS[lower] ?? (ak && ak !== lower ? OCR_TYPOS[ak] : undefined);
  if (typo) {
    return [typo.includes(" ") ? typo : titleCaseWord(typo)];
  }

  // "1o" / "lo" style: short tokens that are almost "10"
  if (/^[1il][o0]$/.test(lower)) {
    return ["10"];
  }

  const candidates = new Set<string>();
  for (const w of COMMON_GROCERY_WORDS) {
    if (w.length >= 3) candidates.add(w);
  }
  for (const w of registryTokens()) {
    if (w.length >= 3) candidates.add(w);
  }

  const scored: { w: string; d: number }[] = [];
  const q = lower;
  if (q.length < 2) return [];

  for (const c of candidates) {
    if (c === q) continue;
    const maxLen = Math.max(q.length, c.length);
    if (maxLen === 0) continue;
    const d = levenshtein(q, c);
    const maxDist = q.length <= 4 ? 1 : q.length <= 7 ? 2 : 3;
    if (d <= maxDist && d > 0) {
      scored.push({ w: c, d });
    }
  }
  scored.sort((a, b) => a.d - b.d || a.w.localeCompare(b.w));

  const fuzzy = scored.slice(0, 6).map((s) => titleCaseWord(s.w));
  return uniqueStrings(fuzzy).slice(0, 5);
}

function titleCaseWord(w: string): string {
  if (!w) return w;
  if (w.length === 1) return w.toUpperCase();
  return w[0].toUpperCase() + w.slice(1).toLowerCase();
}

export type ScanTextToken =
  | { type: "word"; text: string; start: number; end: number }
  | { type: "sep"; text: string; start: number; end: number };

/** Split into word vs non-word spans; indices are for slicing the original string. */
export function tokenizeScanText(input: string): ScanTextToken[] {
  const tokens: ScanTextToken[] = [];
  const re = /[A-Za-z0-9']+|[^A-Za-z0-9']+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    const text = m[0];
    const start = m.index;
    const end = start + text.length;
    const isWord = /^[A-Za-z0-9']+$/.test(text) && /[A-Za-z0-9]/.test(text);
    tokens.push(isWord ? { type: "word", text, start, end } : { type: "sep", text, start, end });
  }
  return tokens;
}

export function shouldFlagOcrWord(raw: string): boolean {
  if (isTrustedOcrWord(raw)) return false;
  const sug = suggestOcrWordCorrections(raw);
  if (sug.length > 0) return true;
  return raw.length >= 4 && /[A-Za-z]/.test(raw);
}

export function replaceScanTextRange(text: string, start: number, end: number, insert: string): string {
  return `${text.slice(0, start)}${insert}${text.slice(end)}`;
}
