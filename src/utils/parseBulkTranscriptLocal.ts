// eslint-disable-next-line @typescript-eslint/no-require-imports
const wordsToNumbers = require("words-to-numbers") as (s: string) => string | number | null;

import { extractUnitFromText, lookupCanonicalItemName, lookupUnitsForItem } from "./productRegistry";

export type ParsedBulkItem = {
  name: string;
  quantity: string;
  unit: string;
  unitOptions: string[];
  price: string;
};

/**
 * Each chunk should be: **quantity first**, then the item name.
 * Separate items with the word **AND**. Example:
 * `one bear brand and two eggs and one coffee`
 */
function splitItemChunks(transcript: string): string[] {
  return transcript
    .split(/\s+\band\b\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Reliable on React Native where `words-to-numbers` may not handle lone words like "one". */
const SPOKEN_QTY_WORD: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
};

function coerceIntWord(fragment: string): number | null {
  const f = fragment.trim().toLowerCase().replace(/[.,]+$/g, "");
  if (!f) return null;
  const spoken = SPOKEN_QTY_WORD[f];
  if (spoken != null && spoken > 0) return spoken;
  const d = parseInt(f, 10);
  if (Number.isFinite(d) && d > 0) return d;
  try {
    const w = wordsToNumbers(f);
    if (typeof w === "number" && Number.isFinite(w) && w > 0) return Math.round(w);
    if (typeof w === "string") {
      const p = parseInt(w, 10);
      if (Number.isFinite(p) && p > 0) return p;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * "bear brand 1 pancit 2" → repeated (name, trailing digit qty) pairs (legacy / typo helper).
 */
function parseNameQtyChain(s: string): { name: string; qty: string }[] {
  const out: { name: string; qty: string }[] = [];
  let rest = s.trim();
  while (rest) {
    const m = rest.match(/^(.+?)\s+(\d+)(?:\s*(?:pcs?|pieces?|pc))?(?:\s+(.*))?$/i);
    if (!m) break;
    const name = m[1].trim();
    const qty = m[2];
    const tail = (m[3] ?? "").trim();
    if (name) out.push({ name, qty });
    rest = tail;
  }
  if (rest && out.length === 0) {
    out.push({ name: rest, qty: "1" });
    return out;
  }
  if (rest) {
    out.push({ name: rest, qty: "1" });
  }
  return out;
}

/** Quantity first: "3 milk", "2x bread", "4 pieces eggs", "one bear brand", "twenty four bottles" (first tokens = number). */
function parseLeadingQty(rest: string): { qty: string; name: string } | null {
  const t = rest.trim();
  let m = t.match(/^(\d+)\s*x\s+(.+)$/i);
  if (m) return { qty: m[1], name: m[2].trim() };
  m = t.match(/^(\d+)\s*(?:pcs?|pieces?|pc)\s+(.+)$/i);
  if (m) return { qty: m[1], name: m[2].trim() };
  m = t.match(/^(\d+)\s+(.+)$/);
  if (m && m[2].trim()) return { qty: m[1], name: m[2].trim() };

  const words = t.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const firstNorm = words[0].toLowerCase().replace(/[.,]+$/g, "");
    const firstQty = SPOKEN_QTY_WORD[firstNorm];
    if (firstQty != null && firstQty > 0) {
      const name = words.slice(1).join(" ").trim();
      if (name) return { qty: String(firstQty), name };
    }
  }
  if (words.length >= 2) {
    for (let n = 1; n <= Math.min(4, words.length - 1); n++) {
      const head = words.slice(0, n).join(" ");
      const num = coerceIntWord(head);
      if (num != null && num > 0 && num <= 9999) {
        const name = words.slice(n).join(" ").trim();
        if (name) return { qty: String(num), name };
      }
    }
  }
  return null;
}

function parseOneChunk(chunk: string): ParsedBulkItem[] {
  const seg = chunk.trim();
  if (!seg) return [];

  const lead = parseLeadingQty(seg);
  if (lead && lead.name) {
    const unitParsed = extractUnitFromText(lead.name);
    const cleanName = unitParsed.cleanedName || lead.name;
    const options = lookupUnitsForItem(cleanName);
    return [
      {
        name: cleanName,
        quantity: lead.qty,
        unit: unitParsed.unit,
        unitOptions: options,
        price: "",
      },
    ];
  }

  const chained = parseNameQtyChain(seg);
  return chained.map((c) => ({
    ...(() => {
      const unitParsed = extractUnitFromText(c.name);
      const cleanName = unitParsed.cleanedName || c.name;
      return {
        name: cleanName,
        unit: unitParsed.unit,
        unitOptions: lookupUnitsForItem(cleanName),
      };
    })(),
    quantity: c.qty,
    price: "",
  }));
}

/**
 * Turn speech into rows: split on **AND**, then **quantity-first** in each chunk.
 * Spoken prices in bulk are not parsed; `price` stays empty.
 */
export function parseBulkTranscriptLocal(transcript: string): ParsedBulkItem[] {
  const trimmed = transcript.trim();
  if (!trimmed) return [];

  const chunks = splitItemChunks(trimmed);
  const source = chunks.length > 0 ? chunks : [trimmed];

  const rows: ParsedBulkItem[] = [];
  for (const chunk of source) {
    rows.push(...parseOneChunk(chunk));
  }

  return rows
    .map((r) => {
      const normalizedName = lookupCanonicalItemName(
        r.name.replace(/^[-–—]+\s*/, "").replace(/\s+/g, " ").trim()
      );
      return {
        name: normalizedName,
        quantity: r.quantity.trim() || "1",
        unit: r.unit.trim(),
        unitOptions: lookupUnitsForItem(normalizedName),
        price: r.price,
      };
    })
    .filter((r) => r.name.length > 0);
}
