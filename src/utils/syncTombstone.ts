import type { GroceryItem, GroceryList, PrivateItem, PrivateList, TodoItem, TodoList } from "../types";
import { nowIso } from "./syncTimestamps";

const ts = () => nowIso();

export function tombstoneGroceryItems(items: GroceryItem[], ids: Set<string>): GroceryItem[] {
  const removed = new Set(ids);
  const kept: GroceryItem[] = [];
  for (const item of items) {
    if (!removed.has(item.id)) {
      kept.push(item);
      continue;
    }
    kept.push({ ...item, deletedAt: ts(), updatedAt: ts() });
  }
  return kept;
}

export function tombstoneTodoItems(items: TodoItem[], ids: Set<string>): TodoItem[] {
  const removed = new Set(ids);
  const kept: TodoItem[] = [];
  for (const item of items) {
    if (!removed.has(item.id)) {
      kept.push(item);
      continue;
    }
    kept.push({ ...item, deletedAt: ts(), updatedAt: ts() });
  }
  return kept;
}

export function tombstonePrivateItems(items: PrivateItem[], ids: Set<string>): PrivateItem[] {
  const removed = new Set(ids);
  const kept: PrivateItem[] = [];
  for (const item of items) {
    if (!removed.has(item.id)) {
      kept.push(item);
      continue;
    }
    kept.push({ ...item, deletedAt: ts(), updatedAt: ts() });
  }
  return kept;
}

export function tombstoneGroceryList(list: GroceryList): GroceryList {
  const at = ts();
  return { ...list, deletedAt: at, updatedAt: at };
}

export function tombstoneTodoList(list: TodoList): TodoList {
  const at = ts();
  return { ...list, deletedAt: at, updatedAt: at };
}

export function tombstonePrivateList(list: PrivateList): PrivateList {
  const at = ts();
  return { ...list, deletedAt: at, updatedAt: at };
}

export function visibleGroceryLists(lists: GroceryList[]): GroceryList[] {
  return lists.filter((l) => !l.deletedAt);
}

export function visibleTodoLists(lists: TodoList[]): TodoList[] {
  return lists.filter((l) => !l.deletedAt);
}

export function visiblePrivateLists(lists: PrivateList[]): PrivateList[] {
  return lists.filter((l) => !l.deletedAt);
}
