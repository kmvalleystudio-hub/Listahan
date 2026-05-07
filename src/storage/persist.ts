import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_CURRENCY_SYMBOL } from "../constants/currency";
import type { GroceryItem, GroceryList, HistoryEntry } from "../types";
import { normalizeItemsForPersist } from "../utils/items";

const LISTS_KEY = "@saycart/lists_v1";
const HISTORY_KEY = "@saycart/history_v1";

export type PersistShape = {
  lists: GroceryList[];
  history: HistoryEntry[];
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

function sanitizeHistoryEntry(entry: HistoryEntry): HistoryEntry {
  return {
    ...entry,
    items: normalizeItemsForPersist(entry.items.map(sanitizeItem)),
    showItemPrice: Boolean(entry.showItemPrice),
    currencySymbol: pickCurrencySymbol(entry.currencySymbol),
  };
}

export async function loadPersisted(): Promise<PersistShape> {
  const [listsJson, historyJson] = await Promise.all([
    AsyncStorage.getItem(LISTS_KEY),
    AsyncStorage.getItem(HISTORY_KEY),
  ]);

  const lists: GroceryList[] = listsJson ? JSON.parse(listsJson) : [];
  const history: HistoryEntry[] = historyJson ? JSON.parse(historyJson) : [];

  return {
    lists: Array.isArray(lists) ? lists.map(sanitizeList) : [],
    history: Array.isArray(history) ? history.map(sanitizeHistoryEntry) : [],
  };
}

export async function savePersisted(data: PersistShape): Promise<void> {
  const lists = data.lists.map(sanitizeList);
  const history = data.history.map(sanitizeHistoryEntry);
  await Promise.all([
    AsyncStorage.setItem(LISTS_KEY, JSON.stringify(lists)),
    AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history)),
  ]);
}
