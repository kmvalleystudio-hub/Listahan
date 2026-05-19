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
  PrivateList,
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

  privateLists: PrivateList[];
  upsertPrivateList: (list: PrivateList) => Promise<void>;
  removePrivateList: (id: string) => Promise<void>;
  createPrivateList: (name: string) => Promise<PrivateList>;
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
    items.map((it, idx) => {
      const { completedAt: _omitCompleted, ...rest } = it;
      return {
        ...rest,
        id: generateId(),
        checked: false,
        checkPending: false,
        priority: Boolean(it.priority),
        order: idx,
      };
    })
  );
}

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [lists, setLists] = useState<GroceryList[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [todoLists, setTodoLists] = useState<TodoList[]>([]);
  const [todoHistory, setTodoHistory] = useState<TodoHistoryEntry[]>([]);
  const [privateLists, setPrivateLists] = useState<PrivateList[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await loadPersisted();
    setLists(data.lists);
    setHistory(data.history);
    setTodoLists(data.todoLists);
    setTodoHistory(data.todoHistory);
    setPrivateLists(data.privateLists ?? []);
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
          setPrivateLists(data.privateLists ?? []);
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
      nextTodoHistory: TodoHistoryEntry[],
      nextPrivateLists: PrivateList[]
    ) => {
      await savePersisted({
        lists: nextLists,
        history: nextHistory,
        todoLists: nextTodoLists,
        todoHistory: nextTodoHistory,
        privateLists: nextPrivateLists,
      });
      setLists(nextLists);
      setHistory(nextHistory);
      setTodoLists(nextTodoLists);
      setTodoHistory(nextTodoHistory);
      setPrivateLists(nextPrivateLists);
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
      await persist(next, history, todoLists, todoHistory, privateLists);
    },
    [lists, history, todoLists, todoHistory, privateLists, persist]
  );

  const removeList = useCallback(
    async (id: string) => {
      const next = lists.filter((l) => l.id !== id);
      await persist(next, history, todoLists, todoHistory, privateLists);
    },
    [lists, history, todoLists, todoHistory, privateLists, persist]
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
      await persist([...lists, list], history, todoLists, todoHistory, privateLists);
      return list;
    },
    [lists, history, todoLists, todoHistory, privateLists, persist]
  );

  const appendHistory = useCallback(
    async (entry: HistoryEntry) => {
      const nextHistory = [entry, ...history];
      await persist(lists, nextHistory, todoLists, todoHistory, privateLists);
    },
    [lists, history, todoLists, todoHistory, privateLists, persist]
  );

  const archiveCompletedList = useCallback(
    async (entry: HistoryEntry) => {
      const data = await loadPersisted();
      const sid = entry.sourceListId;
      const nextLists = sid ? data.lists.filter((l) => l.id !== sid) : data.lists;
      const nextHistory = [entry, ...data.history];
      await persist(nextLists, nextHistory, data.todoLists, data.todoHistory, data.privateLists ?? []);
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
      await persist([...data.lists, list], data.history, data.todoLists, data.todoHistory, data.privateLists ?? []);
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
      await persist(lists, history, next, todoHistory, privateLists);
    },
    [lists, history, todoLists, todoHistory, privateLists, persist]
  );

  const removeTodoList = useCallback(
    async (id: string) => {
      const next = todoLists.filter((l) => l.id !== id);
      await persist(lists, history, next, todoHistory, privateLists);
    },
    [lists, history, todoLists, todoHistory, privateLists, persist]
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
      await persist(lists, history, [...todoLists, list], todoHistory, privateLists);
      return list;
    },
    [lists, history, todoLists, todoHistory, privateLists, persist]
  );

  const archiveTodoCompletedList = useCallback(
    async (entry: TodoHistoryEntry) => {
      const data = await loadPersisted();
      const sid = entry.sourceListId;
      const nextTodo = sid ? data.todoLists.filter((l) => l.id !== sid) : data.todoLists;
      const nextHist = [entry, ...data.todoHistory];
      await persist(data.lists, data.history, nextTodo, nextHist, data.privateLists ?? []);
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
      await persist(data.lists, data.history, [...data.todoLists, list], data.todoHistory, data.privateLists ?? []);
      return list;
    },
    [persist]
  );

  const upsertPrivateList = useCallback(
    async (list: PrivateList) => {
      const normalized: PrivateList = { ...list, updatedAt: nowIso() };
      const idx = privateLists.findIndex((l) => l.id === normalized.id);
      const next =
        idx === -1
          ? [...privateLists, { ...normalized, createdAt: normalized.createdAt || nowIso() }]
          : privateLists.map((l, i) => (i === idx ? normalized : l));
      await persist(lists, history, todoLists, todoHistory, next);
    },
    [lists, history, todoLists, todoHistory, privateLists, persist]
  );

  const removePrivateList = useCallback(
    async (id: string) => {
      const next = privateLists.filter((l) => l.id !== id);
      await persist(lists, history, todoLists, todoHistory, next);
    },
    [lists, history, todoLists, todoHistory, privateLists, persist]
  );

  const createPrivateList = useCallback(
    async (name: string) => {
      const ts = nowIso();
      const list: PrivateList = {
        id: generateId(),
        name: name.trim() || "Untitled sheet",
        createdAt: ts,
        updatedAt: ts,
        items: [],
        pinned: false,
      };
      await persist(lists, history, todoLists, todoHistory, [...privateLists, list]);
      return list;
    },
    [lists, history, todoLists, todoHistory, privateLists, persist]
  );

  const value = useMemo(
    () => ({
      lists,
      history,
      todoLists,
      todoHistory,
      privateLists,
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
      upsertPrivateList,
      removePrivateList,
      createPrivateList,
    }),
    [
      lists,
      history,
      todoLists,
      todoHistory,
      privateLists,
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
      upsertPrivateList,
      removePrivateList,
      createPrivateList,
    ]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}
