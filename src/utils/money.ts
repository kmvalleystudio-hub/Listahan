import { DEFAULT_CURRENCY_SYMBOL } from "../constants/currency";

export function parsePriceInput(raw: string): number {
  const s = raw.replace(/[^\d.-]/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export function formatMoney(amount: number, symbol: string = DEFAULT_CURRENCY_SYMBOL): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `${symbol}${safe.toFixed(2)}`;
}

/** Uses the leading numeric portion of quantity (e.g. "4", "2 kg", "1.5 dozen") for line totals. */
export function parseQuantityAsMultiplier(raw: string): number {
  const t = raw.trim();
  if (!t) return 1;
  const m = t.match(/^[\d.,]+/);
  if (!m) return 1;
  const n = parseFloat(m[0].replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return 1;
  return n;
}

export function lineTotal(priceRaw: string, qtyRaw: string): number {
  return parsePriceInput(priceRaw) * parseQuantityAsMultiplier(qtyRaw);
}

export function totalFromItems(items: { price: string; quantity: string }[]): number {
  return items.reduce((sum, i) => sum + lineTotal(i.price, i.quantity), 0);
}

/**
 * Step the leading numeric part of a quantity string (e.g. "2" → "3", "2 kg" → "3 kg").
 * Minimum leading number is 1. Empty field: increment → "1"; decrement → "".
 */
export function adjustQuantityString(raw: string, delta: number): string {
  const t = raw.trim();
  if (!t) {
    if (delta > 0) return "1";
    return "";
  }
  const m = t.match(/^([\d.,]+)(.*)$/);
  if (!m) {
    if (delta > 0) return "1";
    return t;
  }
  let n = parseFloat(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) n = 1;
  n += delta;
  if (n < 1) n = 1;
  const tail = m[2] ?? "";
  const head = Number.isInteger(n) ? String(Math.round(n)) : String(n);
  return head + tail;
}

export function canDecrementQuantity(raw: string): boolean {
  const prev = raw.trim();
  return adjustQuantityString(raw, -1) !== prev;
}
