import type { PrivateItem } from "../types";

export function normalizePrivateItemsForPersist(items: PrivateItem[]): PrivateItem[] {
  return items.map((i) => ({
    ...i,
    name: String(i.name ?? "").trim(),
    username: String(i.username ?? ""),
    secret: String(i.secret ?? ""),
    notes: String(i.notes ?? ""),
    priority: Boolean(i.priority),
  }));
}

/** Same ordering as active to-do rows: priority first, then order. */
export function sortPrivateItemsForDisplay(items: PrivateItem[]): PrivateItem[] {
  return [...items].sort((a, b) => {
    const ap = a.priority ? 1 : 0;
    const bp = b.priority ? 1 : 0;
    if (ap !== bp) return bp - ap;
    return a.order - b.order;
  });
}

export function reindexPrivateOrders(items: PrivateItem[]): PrivateItem[] {
  return items.map((item, idx) => ({ ...item, order: idx }));
}

export function dedupePrivateItemsByName(items: PrivateItem[]): PrivateItem[] {
  const seen = new Set<string>();
  const out: PrivateItem[] = [];
  for (const item of items) {
    const key = item.name.trim().toLowerCase();
    if (!key) {
      out.push(item);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
