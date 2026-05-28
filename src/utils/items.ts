import type { GroceryItem } from "../types";
import { isSyncDeleted } from "./syncTimestamps";
import { nowIso } from "./syncTimestamps";

export function touchGroceryItem(item: GroceryItem): GroceryItem {
  return { ...item, updatedAt: nowIso() };
}

export function normalizeItemsForPersist(items: GroceryItem[]): GroceryItem[] {
  return items.map((i) => ({
    ...i,
    checkPending: false,
    updatedAt: i.updatedAt ?? nowIso(),
  }));
}

export function splitActiveAndCompleted(items: GroceryItem[]): {
  active: GroceryItem[];
  completed: GroceryItem[];
} {
  const visible = items.filter((i) => !isSyncDeleted(i));
  const active = visible.filter((i) => !i.checked || i.checkPending);
  const completed = visible.filter((i) => i.checked && !i.checkPending);
  active.sort((a, b) => {
    const ap = a.priority ? 1 : 0;
    const bp = b.priority ? 1 : 0;
    if (ap !== bp) return bp - ap; // priority first
    return a.order - b.order;
  });
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
