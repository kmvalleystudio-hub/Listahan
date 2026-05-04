import type { GroceryItem } from "../types";

export function normalizeItemsForPersist(items: GroceryItem[]): GroceryItem[] {
  return items.map((i) => ({
    ...i,
    checkPending: false,
  }));
}

export function splitActiveAndCompleted(items: GroceryItem[]): {
  active: GroceryItem[];
  completed: GroceryItem[];
} {
  const active = items.filter((i) => !i.checked || i.checkPending);
  const completed = items.filter((i) => i.checked && !i.checkPending);
  active.sort((a, b) => a.order - b.order);
  completed.sort((a, b) => a.order - b.order);
  return { active, completed };
}

export function allItemsCommittedDone(items: GroceryItem[]): boolean {
  if (items.length === 0) return false;
  return items.every((i) => i.checked && !i.checkPending);
}

export function reindexOrders(items: GroceryItem[]): GroceryItem[] {
  return items.map((item, idx) => ({ ...item, order: idx }));
}
