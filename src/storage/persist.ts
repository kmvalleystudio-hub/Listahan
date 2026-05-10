import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_CURRENCY_SYMBOL } from "../constants/currency";
import type { GroceryItem, GroceryList, HistoryEntry, TodoHistoryEntry, TodoItem, TodoList } from "../types";
import { normalizeItemsForPersist } from "../utils/items";
import { normalizeTodoItemsForPersist } from "../utils/todoItems";

const LISTS_KEY = "@saycart/lists_v1";
const HISTORY_KEY = "@saycart/history_v1";
const TODO_LISTS_KEY = "@saycart/todo_lists_v1";
const TODO_HISTORY_KEY = "@saycart/todo_history_v1";

export type PersistShape = {
  lists: GroceryList[];
  history: HistoryEntry[];
  todoLists: TodoList[];
  todoHistory: TodoHistoryEntry[];
};

function sanitizeItem(item: GroceryItem): GroceryItem {
  const unitOptions = Array.isArray(item.unitOptions)
    ? item.unitOptions
        .map((u) => String(u ?? "").trim())
        .filter(Boolean)
        .slice(0, 12)
    : [];
  return {
    ...item,
    name: item.name ?? "",
    quantity: item.quantity ?? "",
    unit: String(item.unit ?? "").trim(),
    unitOptions,
    price: item.price ?? "",
    priority: Boolean(item.priority),
    checkPending: false,
  };
}

function sanitizeTodoItem(item: TodoItem): TodoItem {
  return {
    ...item,
    name: item.name ?? "",
    priority: Boolean(item.priority),
    checkPending: false,
  };
}

function pickCurrencySymbol(raw: unknown): string {
  if (typeof raw === "string" && raw.trim()) return raw.trim().slice(0, 12);
  return DEFAULT_CURRENCY_SYMBOL;
}

function sanitizeList(list: GroceryList): GroceryList {
  return {
    ...list,
    items: normalizeItemsForPersist(list.items.map(sanitizeItem)),
    showItemPrice: Boolean(list.showItemPrice),
    currencySymbol: pickCurrencySymbol(list.currencySymbol),
    pinned: Boolean(list.pinned),
  };
}

function sanitizeTodoList(list: TodoList): TodoList {
  return {
    ...list,
    items: normalizeTodoItemsForPersist(list.items.map(sanitizeTodoItem)),
    pinned: Boolean(list.pinned),
  };
}

function sanitizeHistoryEntry(entry: HistoryEntry): HistoryEntry {
  return {
    ...entry,
    items: normalizeItemsForPersist(entry.items.map(sanitizeItem)),
    showItemPrice: Boolean(entry.showItemPrice),
    currencySymbol: pickCurrencySymbol(entry.currencySymbol),
  };
}

function sanitizeTodoHistoryEntry(entry: TodoHistoryEntry): TodoHistoryEntry {
  return {
    ...entry,
    items: normalizeTodoItemsForPersist(entry.items.map(sanitizeTodoItem)),
  };
}

export async function loadPersisted(): Promise<PersistShape> {
  const [listsJson, historyJson, todoListsJson, todoHistJson] = await Promise.all([
    AsyncStorage.getItem(LISTS_KEY),
    AsyncStorage.getItem(HISTORY_KEY),
    AsyncStorage.getItem(TODO_LISTS_KEY),
    AsyncStorage.getItem(TODO_HISTORY_KEY),
  ]);

  const lists: GroceryList[] = listsJson ? JSON.parse(listsJson) : [];
  const history: HistoryEntry[] = historyJson ? JSON.parse(historyJson) : [];
  const todoLists: TodoList[] = todoListsJson ? JSON.parse(todoListsJson) : [];
  const todoHistory: TodoHistoryEntry[] = todoHistJson ? JSON.parse(todoHistJson) : [];

  return {
    lists: Array.isArray(lists) ? lists.map(sanitizeList) : [],
    history: Array.isArray(history) ? history.map(sanitizeHistoryEntry) : [],
    todoLists: Array.isArray(todoLists) ? todoLists.map(sanitizeTodoList) : [],
    todoHistory: Array.isArray(todoHistory) ? todoHistory.map(sanitizeTodoHistoryEntry) : [],
  };
}

export async function savePersisted(data: PersistShape): Promise<void> {
  const lists = data.lists.map(sanitizeList);
  const history = data.history.map(sanitizeHistoryEntry);
  const todoLists = data.todoLists.map(sanitizeTodoList);
  const todoHistory = data.todoHistory.map(sanitizeTodoHistoryEntry);
  await Promise.all([
    AsyncStorage.setItem(LISTS_KEY, JSON.stringify(lists)),
    AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history)),
    AsyncStorage.setItem(TODO_LISTS_KEY, JSON.stringify(todoLists)),
    AsyncStorage.setItem(TODO_HISTORY_KEY, JSON.stringify(todoHistory)),
  ]);
}
