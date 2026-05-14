import type { GroceryItem, GroceryList } from "../types";
import { generateId } from "./id";
import { DEFAULT_CURRENCY_SYMBOL } from "../constants/currency";
import { normalizeItemsForPersist } from "./items";

export const GROCERY_SHARE_FORMAT_VERSION = 1 as const;
export const GROCERY_SHARE_KIND = "saycart-grocery" as const;

export type GroceryShareFileV1 = {
  formatVersion: typeof GROCERY_SHARE_FORMAT_VERSION;
  kind: typeof GROCERY_SHARE_KIND;
  exportedAt: string;
  list: {
    name: string;
    showItemPrice: boolean;
    currencySymbol: string;
    items: Array<{
      name: string;
      quantity: string;
      unit: string;
      unitOptions: string[];
      price: string;
      priority: boolean;
      order: number;
    }>;
  };
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

export function buildGroceryShareFileFromList(list: GroceryList, exportedAtIso: string): GroceryShareFileV1 {
  const items = [...list.items].sort((a, b) => a.order - b.order);
  return {
    formatVersion: GROCERY_SHARE_FORMAT_VERSION,
    kind: GROCERY_SHARE_KIND,
    exportedAt: exportedAtIso,
    list: {
      name: list.name.trim() || "Groceries",
      showItemPrice: Boolean(list.showItemPrice),
      currencySymbol: String(list.currencySymbol || DEFAULT_CURRENCY_SYMBOL).trim() || DEFAULT_CURRENCY_SYMBOL,
      items: items.map((it, idx) => ({
        name: String(it.name ?? "").trim() || "Item",
        quantity: String(it.quantity ?? ""),
        unit: String(it.unit ?? "").trim(),
        unitOptions: Array.isArray(it.unitOptions) ? it.unitOptions.map((u) => String(u ?? "").trim()).filter(Boolean).slice(0, 12) : [],
        price: String(it.price ?? ""),
        priority: Boolean(it.priority),
        order: idx,
      })),
    },
  };
}

export function parseGrocerySharePayload(raw: unknown): GroceryShareFileV1 | null {
  if (!isRecord(raw)) return null;
  if (raw.formatVersion !== GROCERY_SHARE_FORMAT_VERSION) return null;
  if (raw.kind !== GROCERY_SHARE_KIND) return null;
  if (typeof raw.exportedAt !== "string") return null;
  const list = raw.list;
  if (!isRecord(list)) return null;
  if (typeof list.name !== "string") return null;
  if (!Array.isArray(list.items)) return null;
  const showItemPrice = Boolean(list.showItemPrice);
  const currencySymbol =
    typeof list.currencySymbol === "string" && list.currencySymbol.trim()
      ? list.currencySymbol.trim().slice(0, 12)
      : DEFAULT_CURRENCY_SYMBOL;
  const items: GroceryShareFileV1["list"]["items"] = [];
  for (const row of list.items) {
    if (!isRecord(row)) continue;
    items.push({
      name: String(row.name ?? "").trim() || "Item",
      quantity: String(row.quantity ?? ""),
      unit: String(row.unit ?? "").trim(),
      unitOptions: Array.isArray(row.unitOptions)
        ? row.unitOptions.map((u) => String(u ?? "").trim()).filter(Boolean).slice(0, 12)
        : [],
      price: String(row.price ?? ""),
      priority: Boolean(row.priority),
      order: typeof row.order === "number" && Number.isFinite(row.order) ? row.order : items.length,
    });
  }
  items.sort((a, b) => a.order - b.order);
  return {
    formatVersion: GROCERY_SHARE_FORMAT_VERSION,
    kind: GROCERY_SHARE_KIND,
    exportedAt: raw.exportedAt,
    list: {
      name: list.name.trim() || "Groceries",
      showItemPrice,
      currencySymbol,
      items: items.map((it, idx) => ({ ...it, order: idx })),
    },
  };
}

export function groceryListFromSharePayload(base: GroceryList, parsed: GroceryShareFileV1): GroceryList {
  const now = new Date().toISOString();
  const items: GroceryItem[] = parsed.list.items.map((it, idx) => ({
    id: generateId(),
    name: it.name,
    quantity: it.quantity,
    unit: it.unit,
    unitOptions: [...it.unitOptions],
    price: it.price,
    priority: it.priority,
    checked: false,
    checkPending: false,
    order: idx,
  }));
  return {
    ...base,
    name: parsed.list.name,
    showItemPrice: parsed.list.showItemPrice,
    currencySymbol: parsed.list.currencySymbol,
    items: normalizeItemsForPersist(items),
    updatedAt: now,
    importedFromShare: true,
  };
}

const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;

export function extractShareUuidFromText(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  const m = t.match(UUID_RE);
  return m ? m[0].toLowerCase() : null;
}
