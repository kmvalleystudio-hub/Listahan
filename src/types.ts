export type GroceryItem = {
  id: string;
  name: string;
  quantity: string;
  /** Selected unit/size for this item (e.g. 500ml, 1kg, pack). */
  unit?: string;
  /** Item-specific selectable units (used by Add/Edit dropdown). */
  unitOptions?: string[];
  price: string;
  /** When true, item is prioritized and floats to top. */
  priority?: boolean;
  checked: boolean;
  /** True during the 2s undo window after tapping CHECK; not persisted. */
  checkPending?: boolean;
  order: number;
  /** Last edit time for sync merge (ISO). */
  updatedAt?: string;
  /** Set when deleted while synced — tombstone for last-write-wins. */
  deletedAt?: string;
};

export type GroceryList = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  items: GroceryItem[];
  /** When true, list detail shows price column and total; persisted per list. */
  showItemPrice: boolean;
  /** Display symbol for all prices in this list (e.g. ₱, $). */
  currencySymbol: string;
  /** True when this list was created from a cloud share import (distinct from same-named local lists). */
  importedFromShare?: boolean;
  /** Tombstone when list removed during sync. */
  deletedAt?: string;
  pinned?: boolean;
};

export type HistoryEntry = {
  id: string;
  sourceListId?: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  items: GroceryItem[];
  showItemPrice: boolean;
  currencySymbol: string;
};

export type TodoItem = {
  id: string;
  name: string;
  priority?: boolean;
  checked: boolean;
  checkPending?: boolean;
  /** ISO time when the user committed this check (after undo window). Shown in completed-list preview. */
  completedAt?: string;
  order: number;
  updatedAt?: string;
  deletedAt?: string;
};

export type TodoList = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  items: TodoItem[];
  pinned?: boolean;
  /** True when this list was created from a cloud share import. */
  importedFromShare?: boolean;
  deletedAt?: string;
};

export type TodoHistoryEntry = {
  id: string;
  sourceListId?: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  items: TodoItem[];
};

/** Private vault entry — no “checked” state; optional secret + notes (e.g. passwords). */
export type PrivateItem = {
  id: string;
  /** Label, e.g. site or account name */
  name: string;
  /** Login or email (plain text; optional) */
  username?: string;
  /** Sensitive value (stored locally; use secure field in UI) */
  secret?: string;
  /** Optional extra context (not masked) */
  notes?: string;
  priority?: boolean;
  order: number;
  updatedAt?: string;
  deletedAt?: string;
};

export type PrivateList = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  items: PrivateItem[];
  pinned?: boolean;
  deletedAt?: string;
};
