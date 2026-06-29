import type { TodoItem, TodoList } from "../types";
import { generateId } from "./id";
import { normalizeTodoItemsForPersist, reindexTodoOrders } from "./todoItems";

export const TODO_SHARE_FORMAT_VERSION = 1 as const;
export const TODO_SHARE_KIND = "saycart-todo" as const;

export type TodoShareFileV1 = {
  formatVersion: typeof TODO_SHARE_FORMAT_VERSION;
  kind: typeof TODO_SHARE_KIND;
  exportedAt: string;
  list: {
    name: string;
    items: Array<{ name: string; priority: boolean; order: number }>;
  };
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

export function buildTodoShareFileFromList(list: TodoList, exportedAtIso: string): TodoShareFileV1 {
  const items = [...list.items].sort((a, b) => a.order - b.order);
  return {
    formatVersion: TODO_SHARE_FORMAT_VERSION,
    kind: TODO_SHARE_KIND,
    exportedAt: exportedAtIso,
    list: {
      name: list.name.trim() || "To-dos",
      items: items.map((it, idx) => ({
        name: String(it.name ?? "").trim() || "Task",
        priority: Boolean(it.priority),
        order: idx,
      })),
    },
  };
}

export function parseTodoSharePayload(raw: unknown): TodoShareFileV1 | null {
  if (!isRecord(raw)) return null;
  if (raw.formatVersion !== TODO_SHARE_FORMAT_VERSION) return null;
  if (raw.kind !== TODO_SHARE_KIND) return null;
  if (typeof raw.exportedAt !== "string") return null;
  const list = raw.list;
  if (!isRecord(list)) return null;
  if (typeof list.name !== "string") return null;
  if (!Array.isArray(list.items)) return null;
  const items: TodoShareFileV1["list"]["items"] = [];
  for (const row of list.items) {
    if (!isRecord(row)) continue;
    items.push({
      name: String(row.name ?? "").trim() || "Task",
      priority: Boolean(row.priority),
      order: typeof row.order === "number" && Number.isFinite(row.order) ? row.order : items.length,
    });
  }
  items.sort((a, b) => a.order - b.order);
  return {
    formatVersion: TODO_SHARE_FORMAT_VERSION,
    kind: TODO_SHARE_KIND,
    exportedAt: raw.exportedAt,
    list: {
      name: list.name.trim() || "To-dos",
      items: items.map((it, idx) => ({ ...it, order: idx })),
    },
  };
}

export function todoListFromSharePayload(base: TodoList, parsed: TodoShareFileV1): TodoList {
  const now = new Date().toISOString();
  const items: TodoItem[] = parsed.list.items.map((it, idx) => ({
    id: generateId(),
    name: it.name,
    priority: it.priority,
    checked: false,
    checkPending: false,
    order: idx,
  }));
  return {
    ...base,
    name: parsed.list.name,
    items: normalizeTodoItemsForPersist(items),
    updatedAt: now,
    importedFromShare: true,
  };
}

function dedupeTodoItemsByName(items: TodoItem[]): TodoItem[] {
  const seen = new Set<string>();
  const out: TodoItem[] = [];
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

/** Append shared tasks onto an existing list (skips duplicate names already on the list). */
export function mergeTodoShareIntoList(list: TodoList, parsed: TodoShareFileV1): TodoList {
  const now = new Date().toISOString();
  let order = list.items.length;
  const imported: TodoItem[] = parsed.list.items.map((it) => ({
    id: generateId(),
    name: it.name,
    priority: it.priority,
    checked: false,
    checkPending: false,
    order: order++,
    updatedAt: now,
  }));
  const items = reindexTodoOrders(dedupeTodoItemsByName([...list.items, ...imported]));
  return {
    ...list,
    items: normalizeTodoItemsForPersist(items),
    updatedAt: now,
  };
}
