import type { TodoItem } from "../types";

export function normalizeTodoItemsForPersist(items: TodoItem[]): TodoItem[] {
  return items.map((i) => ({
    ...i,
    checkPending: false,
  }));
}

export function splitTodoActiveAndCompleted(items: TodoItem[]): {
  active: TodoItem[];
  completed: TodoItem[];
} {
  const active = items.filter((i) => !i.checked || i.checkPending);
  const completed = items.filter((i) => i.checked && !i.checkPending);
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
