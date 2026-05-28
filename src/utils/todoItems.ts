import type { TodoItem } from "../types";
import { isSyncDeleted, nowIso } from "./syncTimestamps";

export function touchTodoItem(item: TodoItem): TodoItem {
  return { ...item, updatedAt: nowIso() };
}

export function normalizeTodoItemsForPersist(items: TodoItem[]): TodoItem[] {
  return items.map((i) => ({
    ...i,
    checkPending: false,
    updatedAt: i.updatedAt ?? nowIso(),
  }));
}

export function splitTodoActiveAndCompleted(items: TodoItem[]): {
  active: TodoItem[];
  completed: TodoItem[];
} {
  const visible = items.filter((i) => !isSyncDeleted(i));
  const active = visible.filter((i) => !i.checked || i.checkPending);
  const completed = visible.filter((i) => i.checked && !i.checkPending);
  active.sort((a, b) => {
    const ap = a.priority ? 1 : 0;
    const bp = b.priority ? 1 : 0;
    if (ap !== bp) return bp - ap;
    return a.order - b.order;
  });
  completed.sort((a, b) => a.order - b.order);
  return { active, completed };
}

export function allTodosCommittedDone(items: TodoItem[]): boolean {
  if (items.length === 0) return false;
  return items.every((i) => i.checked && !i.checkPending);
}

export function reindexTodoOrders(items: TodoItem[]): TodoItem[] {
  return items.map((item, idx) => ({ ...item, order: idx }));
}
