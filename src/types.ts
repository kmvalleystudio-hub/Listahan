export type GroceryItem = {
  id: string;
  name: string;
  quantity: string;
  price: string;
  checked: boolean;
  /** True during the 2s undo window after tapping CHECK; not persisted. */
  checkPending?: boolean;
  order: number;
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
  /** Pinned lists appear at the top of the home screen. */
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
