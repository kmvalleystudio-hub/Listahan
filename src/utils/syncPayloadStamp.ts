import type {
  GroceryItem,
  GroceryList,
  HistoryEntry,
  PrivateItem,
  PrivateList,
  TodoHistoryEntry,
  TodoItem,
  TodoList,
} from "../types";
import { nowIso } from "./syncTimestamps";
import type { QuickNote } from "./quickNotesStorage";
import type { SavedReminder } from "./remindersStorage";

/** Keep per-item updatedAt only when the item was actually edited (no list-level inflation). */
function stampGroceryItems(items: GroceryItem[]): GroceryItem[] {
  return items.map((i) => ({ ...i }));
}

function stampGroceryList(list: GroceryList): GroceryList {
  const updatedAt = list.updatedAt ?? nowIso();
  return {
    ...list,
    updatedAt,
    items: stampGroceryItems(list.items),
  };
}

function stampTodoItems(items: TodoItem[]): TodoItem[] {
  return items.map((i) => ({ ...i }));
}

function stampTodoList(list: TodoList): TodoList {
  const updatedAt = list.updatedAt ?? nowIso();
  return {
    ...list,
    updatedAt,
    items: stampTodoItems(list.items),
  };
}

function stampPrivateItems(items: PrivateItem[]): PrivateItem[] {
  return items.map((i) => ({ ...i }));
}

function stampPrivateList(list: PrivateList): PrivateList {
  const updatedAt = list.updatedAt ?? nowIso();
  return {
    ...list,
    updatedAt,
    items: stampPrivateItems(list.items),
  };
}

/** Include tombstoned rows so deletes propagate; active-only rows get stamped updatedAt. */
export function stampGroceryPayload(payload: { lists: GroceryList[]; history: HistoryEntry[] }): {
  lists: GroceryList[];
  history: HistoryEntry[];
} {
  return {
    lists: payload.lists.map(stampGroceryList),
    history: payload.history.map((h) => {
      const updatedAt = h.updatedAt ?? nowIso();
      return { ...h, updatedAt, items: stampGroceryItems(h.items) };
    }),
  };
}

export function stampTodoPayload(payload: { lists: TodoList[]; history: TodoHistoryEntry[] }): {
  lists: TodoList[];
  history: TodoHistoryEntry[];
} {
  return {
    lists: payload.lists.map(stampTodoList),
    history: payload.history.map((h) => {
      const updatedAt = h.updatedAt ?? nowIso();
      return { ...h, updatedAt, items: stampTodoItems(h.items) };
    }),
  };
}

export function stampVaultPayload(payload: { privateLists: PrivateList[] }): {
  privateLists: PrivateList[];
} {
  return { privateLists: payload.privateLists.map(stampPrivateList) };
}

export function stampNotesPayload(payload: { notes: QuickNote[] }): { notes: QuickNote[] } {
  return {
    notes: payload.notes.map((n) => ({
      ...n,
      updatedAt: n.updatedAt ?? nowIso(),
    })),
  };
}

export function stampRemindersPayload(payload: { reminders: SavedReminder[] }): {
  reminders: SavedReminder[];
} {
  return {
    reminders: payload.reminders.map((r) => ({
      ...r,
      updatedAt: r.updatedAt ?? nowIso(),
    })),
  };
}
