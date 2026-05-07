import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { DEFAULT_CURRENCY_SYMBOL } from "../constants/currency";
import type { GroceryList, HistoryEntry, GroceryItem } from "../types";
import { generateId } from "../utils/id";
import { loadPersisted, savePersisted } from "../storage/persist";
import { reindexOrders } from "../utils/items";

type AppDataContextValue = {
  lists: GroceryList[];
  history: HistoryEntry[];
  loading: boolean;
  refresh: () => Promise<void>;
  upsertList: (list: GroceryList) => Promise<void>;
  removeList: (id: string) => Promise<void>;
  createList: (name: string) => Promise<GroceryList>;
  appendHistory: (entry: HistoryEntry) => Promise<void>;
  /** Removes the source list from active lists and prepends entry to history (disk-consistent). */
  archiveCompletedList: (entry: HistoryEntry) => Promise<void>;
  createListFromHistory: (historyId: string, name: string) => Promise<GroceryList | null>;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

function nowIso(): string {
  return new Date().toISOString();
}

function cloneItemsForNewList(items: GroceryItem[]): GroceryItem[] {
  return reindexOrders(
    items.map((it, idx) => ({
      ...it,
      id: generateId(),
      checked: false,
      checkPending: false,
      priority: Boolean(it.priority),
      order: idx,
    }))
  );
}

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [lists, setLists] = useState<GroceryList[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await loadPersisted();
    setLists(data.lists);
    setHistory(data.history);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await loadPersisted();
        if (!cancelled) {
          setLists(data.lists);
          setHistory(data.history);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(async (nextLists: GroceryList[], nextHistory: HistoryEntry[]) => {
    setLists(nextLists);
    setHistory(nextHistory);
    await savePersisted({ lists: nextLists, history: nextHistory });
  }, []);

  const upsertList = useCallback(
    async (list: GroceryList) => {
      const normalized: GroceryList = {
        ...list,
        updatedAt: nowIso(),
      };
      const idx = lists.findIndex((l) => l.id === normalized.id);
      const next =
        idx === -1
          ? [...lists, { ...normalized, createdAt: normalized.createdAt || nowIso() }]
          : lists.map((l, i) => (i === idx ? normalized : l));
      await persist(next, history);
    },
    [lists, history, persist]
  );

  const removeList = useCallback(
    async (id: string) => {
      const next = lists.filter((l) => l.id !== id);
      await persist(next, history);
    },
    [lists, history, persist]
  );

  const createList = useCallback(
    async (name: string) => {
      const ts = nowIso();
      const list: GroceryList = {
        id: generateId(),
        name: name.trim() || "Groceries",
        createdAt: ts,
        updatedAt: ts,
        items: [],
        showItemPrice: false,
        currencySymbol: DEFAULT_CURRENCY_SYMBOL,
        pinned: false,
      };
      await persist([...lists, list], history);
      return list;
    },
    [lists, history, persist]
  );

  const appendHistory = useCallback(
    async (entry: HistoryEntry) => {
      const nextHistory = [entry, ...history];
      await persist(lists, nextHistory);
    },
    [lists, history, persist]
  );

  const archiveCompletedList = useCallback(
    async (entry: HistoryEntry) => {
      const data = await loadPersisted();
      const sid = entry.sourceListId;
      const nextLists = sid ? data.lists.filter((l) => l.id !== sid) : data.lists;
      const nextHistory = [entry, ...data.history];
      await persist(nextLists, nextHistory);
    },
    [persist]
  );

  const createListFromHistory = useCallback(
    async (historyId: string, name: string) => {
      const data = await loadPersisted();
      const h = data.history.find((x) => x.id === historyId);
      if (!h) return null;
      const ts = nowIso();
      const list: GroceryList = {
        id: generateId(),
        name: name.trim() || `Copy of ${h.name}`,
        createdAt: ts,
        updatedAt: ts,
        items: cloneItemsForNewList(h.items),
        showItemPrice: Boolean(h.showItemPrice),
        currencySymbol:
          typeof h.currencySymbol === "string" && h.currencySymbol.trim()
            ? h.currencySymbol.trim().slice(0, 12)
            : DEFAULT_CURRENCY_SYMBOL,
        pinned: false,
      };
      await persist([...data.lists, list], data.history);
      return list;
    },
    [persist]
  );

  const value = useMemo(
    () => ({
      lists,
      history,
      loading,
      refresh,
      upsertList,
      removeList,
      createList,
      appendHistory,
      archiveCompletedList,
      createListFromHistory,
    }),
    [
      lists,
      history,
      loading,
      refresh,
      upsertList,
      removeList,
      createList,
      appendHistory,
      archiveCompletedList,
      createListFromHistory,
    ]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}
