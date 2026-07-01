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
import { entityActivityMs, isSyncDeleted, pickSyncItemWinner, pickSyncWinner } from "./syncTimestamps";
import type { QuickNote } from "./quickNotesStorage";
import type { SavedReminder } from "./remindersStorage";

function mergeEntityArrays<T extends { id: string; updatedAt?: string; deletedAt?: string }>(
  local: T[],
  remote: T[],
  pick: (a: T, b: T) => T = pickSyncWinner
): T[] {
  const map = new Map<string, T>();

  const ingest = (row: T) => {
    const prev = map.get(row.id);
    if (!prev) {
      map.set(row.id, row);
      return;
    }
    map.set(row.id, pick(prev, row));
  };

  for (const row of local) ingest(row);
  for (const row of remote) ingest(row);

  return [...map.values()].filter((row) => !isSyncDeleted(row));
}

function mergeGroceryItems(localItems: GroceryItem[], remoteItems: GroceryItem[]): GroceryItem[] {
  return mergeEntityArrays(localItems, remoteItems, pickSyncItemWinner);
}

function mergeGroceryList(local: GroceryList, remote: GroceryList): GroceryList {
  const winner = pickSyncWinner(local, remote);
  const listUpdatedAt = winner.updatedAt ?? nowFallback();
  return {
    ...winner,
    items: mergeGroceryItems(local.items, remote.items),
    showItemPrice: entityActivityMs(remote) >= entityActivityMs(local) ? remote.showItemPrice : local.showItemPrice,
    currencySymbol:
      entityActivityMs(remote) >= entityActivityMs(local) ? remote.currencySymbol : local.currencySymbol,
    importedFromShare: winner.importedFromShare ?? local.importedFromShare ?? remote.importedFromShare,
  };
}

function nowFallback(): string {
  return new Date().toISOString();
}

function mergeGroceryLists(local: GroceryList[], remote: GroceryList[]): GroceryList[] {
  const byId = new Map<string, { local?: GroceryList; remote?: GroceryList }>();
  for (const l of local) byId.set(l.id, { ...(byId.get(l.id) ?? {}), local: l });
  for (const l of remote) byId.set(l.id, { ...(byId.get(l.id) ?? {}), remote: l });

  const out: GroceryList[] = [];
  for (const { local: l, remote: r } of byId.values()) {
    if (l && r) out.push(mergeGroceryList(l, r));
    else if (l && !isSyncDeleted(l)) out.push(l);
    else if (r && !isSyncDeleted(r)) out.push(r);
  }
  return out;
}

function mergeHistory<T extends HistoryEntry | TodoHistoryEntry>(
  local: T[],
  remote: T[]
): T[] {
  return mergeEntityArrays(local, remote);
}

function mergeTodoList(local: TodoList, remote: TodoList): TodoList {
  const winner = pickSyncWinner(local, remote);
  const listUpdatedAt = winner.updatedAt ?? nowFallback();
  return {
    ...winner,
    items: mergeEntityArrays(local.items, remote.items, pickSyncItemWinner) as TodoItem[],
    pinned: entityActivityMs(remote) >= entityActivityMs(local) ? remote.pinned : local.pinned,
  };
}

function mergeTodoLists(local: TodoList[], remote: TodoList[]): TodoList[] {
  const byId = new Map<string, { local?: TodoList; remote?: TodoList }>();
  for (const l of local) byId.set(l.id, { ...(byId.get(l.id) ?? {}), local: l });
  for (const l of remote) byId.set(l.id, { ...(byId.get(l.id) ?? {}), remote: l });

  const out: TodoList[] = [];
  for (const { local: l, remote: r } of byId.values()) {
    if (l && r) out.push(mergeTodoList(l, r));
    else if (l && !isSyncDeleted(l)) out.push(l);
    else if (r && !isSyncDeleted(r)) out.push(r);
  }
  return out;
}

function mergePrivateList(local: PrivateList, remote: PrivateList): PrivateList {
  const winner = pickSyncWinner(local, remote);
  return {
    ...winner,
    items: mergeEntityArrays(local.items, remote.items, pickSyncItemWinner) as PrivateItem[],
    pinned: entityActivityMs(remote) >= entityActivityMs(local) ? remote.pinned : local.pinned,
  };
}

function mergePrivateLists(local: PrivateList[], remote: PrivateList[]): PrivateList[] {
  const byId = new Map<string, { local?: PrivateList; remote?: PrivateList }>();
  for (const l of local) byId.set(l.id, { ...(byId.get(l.id) ?? {}), local: l });
  for (const l of remote) byId.set(l.id, { ...(byId.get(l.id) ?? {}), remote: l });

  const out: PrivateList[] = [];
  for (const { local: l, remote: r } of byId.values()) {
    if (l && r) out.push(mergePrivateList(l, r));
    else if (l && !isSyncDeleted(l)) out.push(l);
    else if (r && !isSyncDeleted(r)) out.push(r);
  }
  return out;
}

export function mergeGroceryPayload(
  local: { lists: GroceryList[]; history: HistoryEntry[] },
  remote: { lists: GroceryList[]; history: HistoryEntry[] }
): { lists: GroceryList[]; history: HistoryEntry[] } {
  return {
    lists: mergeGroceryLists(local.lists, remote.lists),
    history: mergeHistory(local.history, remote.history),
  };
}

export function mergeTodoPayload(
  local: { lists: TodoList[]; history: TodoHistoryEntry[] },
  remote: { lists: TodoList[]; history: TodoHistoryEntry[] }
): { lists: TodoList[]; history: TodoHistoryEntry[] } {
  return {
    lists: mergeTodoLists(local.lists, remote.lists),
    history: mergeHistory(local.history, remote.history),
  };
}

export function mergeVaultPayload(
  local: { privateLists: PrivateList[] },
  remote: { privateLists: PrivateList[] }
): { privateLists: PrivateList[] } {
  return { privateLists: mergePrivateLists(local.privateLists, remote.privateLists) };
}

export function mergeNotesPayload(local: { notes: QuickNote[] }, remote: { notes: QuickNote[] }): {
  notes: QuickNote[];
} {
  const merged = mergeEntityArrays(local.notes, remote.notes);
  return { notes: merged };
}

export function mergeRemindersPayload(
  local: { reminders: SavedReminder[] },
  remote: { reminders: SavedReminder[] }
): { reminders: SavedReminder[] } {
  return { reminders: mergeEntityArrays(local.reminders, remote.reminders) };
}
