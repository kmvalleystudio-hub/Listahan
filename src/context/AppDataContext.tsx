import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { DEFAULT_CURRENCY_SYMBOL } from "../constants/currency";
import type {
  GroceryItem,
  GroceryList,
  HistoryEntry,
  TodoHistoryEntry,
  TodoItem,
  TodoList,
} from "../types";
import { generateId } from "../utils/id";
import { loadPersisted, savePersisted } from "../storage/persist";
import { reindexOrders } from "../utils/items";
import { reindexTodoOrders } from "../utils/todoItems";

type AppDataContextValue = {
  lists: GroceryList[];
  history: HistoryEntry[];
  todoLists: TodoList[];
  todoHistory: TodoHistoryEntry[];
  loading: boolean;
  refresh: () => Promise<void>;
  upsertList: (list: GroceryList) => Promise<void>;
  removeList: (id: string) => Promise<void>;
  createList: (name: string) => Promise<GroceryList>;
  appendHistory: (entry: HistoryEntry) => Promise<void>;
  archiveCompletedList: (entry: HistoryEntry) => Promise<void>;
  createListFromHistory: (historyId: string, name: string) => Promise<GroceryList | null>;

  upsertTodoList: (list: TodoList) => Promise<void>;
  removeTodoList: (id: string) => Promise<void>;
  createTodoList: (name: string) => Promise<TodoList>;
  archiveTodoCompletedList: (entry: TodoHistoryEntry) => Promise<void>;
  createTodoListFromHistory: (historyId: string, name: string) => Promise<TodoList | null>;
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
      unit: String(it.unit ?? "").trim(),
      unitOptions: Array.isArray(it.unitOptions) ? [...it.unitOptions] : [],
      order: idx,
    }))
  );
}

function cloneTodoItemsForNewList(items: TodoItem[]): TodoItem[] {
  return reindexTodoOrders(
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
  const [todoLists, setTodoLists] = useState<TodoList[]>([]);
  const [todoHistory, setTodoHistory] = useState<TodoHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await loadPersisted();
    setLists(data.lists);
    setHistory(data.history);
    setTodoLists(data.todoLists);
    setTodoHistory(data.todoHistory);
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
          setTodoLists(data.todoLists);
          setTodoHistory(data.todoHistory);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(
    async (
      nextLists: GroceryList[],
      nextHistory: HistoryEntry[],
      nextTodoLists: TodoList[],
      nextTodoHistory: TodoHistoryEntry[]
    ) => {
      setLists(nextLists);
      setHistory(nextHistory);
      setTodoLists(nextTodoLists);
      setTodoHistory(nextTodoHistory);
      await savePersisted({
        lists: nextLists,
        history: nextHistory,
        todoLists: nextTodoLists,
        todoHistory: nextTodoHistory,
      });
    },
    []
  );

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
      await persist(next, history, todoLists, todoHistory);
    },
    [lists, history, todoLists, todoHistory, persist]
  );

  const removeList = useCallback(
    async (id: string) => {
      const next = lists.filter((l) => l.id !== id);
      await persist(next, history, todoLists, todoHistory);
    },
    [lists, history, todoLists, todoHistory, persist]
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
      await persist([...lists, list], history, todoLists, todoHistory);
      return list;
    },
    [lists, history, todoLists, todoHistory, persist]
  );

  const appendHistory = useCallback(
    async (entry: HistoryEntry) => {
      const nextHistory = [entry, ...history];
      await persist(lists, nextHistory, todoLists, todoHistory);
    },
    [lists, history, todoLists, todoHistory, persist]
  );

  const archiveCompletedList = useCallback(
    async (entry: HistoryEntry) => {
      const data = await loadPersisted();
      const sid = entry.sourceListId;
      const nextLists = sid ? data.lists.filter((l) => l.id !== sid) : data.lists;
      const nextHistory = [entry, ...data.history];
      await persist(nextLists, nextHistory, data.todoLists, data.todoHistory);
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
      await persist([...data.lists, list], data.history, data.todoLists, data.todoHistory);
      return list;
    },
    [persist]
  );

  const upsertTodoList = useCallback(
    async (list: TodoList) => {
      const normalized: TodoList = {
        ...list,
        updatedAt: nowIso(),
      };
      const idx = todoLists.findIndex((l) => l.id === normalized.id);
      const next =
        idx === -1
          ? [...todoLists, { ...normalized, createdAt: normalized.createdAt || nowIso() }]
          : todoLists.map((l, i) => (i === idx ? normalized : l));
      await persist(lists, history, next, todoHistory);
    },
    [lists, history, todoLists, todoHistory, persist]
  );

  const removeTodoList = useCallback(
    async (id: string) => {
      const next = todoLists.filter((l) => l.id !== id);
      await persist(lists, history, next, todoHistory);
    },
    [lists, history, todoLists, todoHistory, persist]
  );

  const createTodoList = useCallback(
    async (name: string) => {
      const ts = nowIso();
      const list: TodoList = {
        id: generateId(),
        name: name.trim() || "Tasks",
        createdAt: ts,
        updatedAt: ts,
        items: [],
        pinned: false,
      };
      await persist(lists, history, [...todoLists, list], todoHistory);
      return list;
    },
    [lists, history, todoLists, todoHistory, persist]
  );

  const archiveTodoCompletedList = useCallback(
    async (entry: TodoHistoryEntry) => {
      const data = await loadPersisted();
      const sid = entry.sourceListId;
      const nextTodo = sid ? data.todoLists.filter((l) => l.id !== sid) : data.todoLists;
      const nextHist = [entry, ...data.todoHistory];
      await persist(data.lists, data.history, nextTodo, nextHist);
    },
    [persist]
  );

  const createTodoListFromHistory = useCallback(
    async (historyId: string, name: string) => {
      const data = await loadPersisted();
      const h = data.todoHistory.find((x) => x.id === historyId);
      if (!h) return null;
      const ts = nowIso();
      const list: TodoList = {
        id: generateId(),
        name: name.trim() || `Copy of ${h.name}`,
        createdAt: ts,
        updatedAt: ts,
        items: cloneTodoItemsForNewList(h.items),
        pinned: false,
      };
      await persist(data.lists, data.history, [...data.todoLists, list], data.todoHistory);
      return list;
    },
    [persist]
  );

  const value = useMemo(
    () => ({
      lists,
      history,
      todoLists,
      todoHistory,
      loading,
      refresh,
      upsertList,
      removeList,
      createList,
      appendHistory,
      archiveCompletedList,
      createListFromHistory,
      upsertTodoList,
      removeTodoList,
      createTodoList,
      archiveTodoCompletedList,
      createTodoListFromHistory,
    }),
    [
      lists,
      history,
      todoLists,
      todoHistory,
      loading,
      refresh,
      upsertList,
      removeList,
      createList,
      appendHistory,
      archiveCompletedList,
      createListFromHistory,
      upsertTodoList,
      removeTodoList,
      createTodoList,
      archiveTodoCompletedList,
      createTodoListFromHistory,
    ]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}
