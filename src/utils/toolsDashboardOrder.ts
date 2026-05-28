import AsyncStorage from "@react-native-async-storage/async-storage";
import { TOOLS_CATALOG, type ToolId } from "../constants/toolsCatalog";

const STORAGE_KEY = "@saycart/tools_dashboard_order_v1";

const DEFAULT_ORDER: ToolId[] = TOOLS_CATALOG.map((t) => t.id);

let memoryOrder: ToolId[] | null = null;
let memoryOrderHydrated = false;

function isToolId(x: unknown): x is ToolId {
  return typeof x === "string" && (DEFAULT_ORDER as string[]).includes(x);
}

/** Merge stored order with catalog: keep known ids, append any new tools, drop unknown. */
export function normalizeToolOrder(stored: unknown): ToolId[] {
  if (!Array.isArray(stored)) return [...DEFAULT_ORDER];
  const known = new Set(DEFAULT_ORDER);
  const seen = new Set<string>();
  const out: ToolId[] = [];
  for (const x of stored) {
    if (!isToolId(x) || !known.has(x) || seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  for (const id of DEFAULT_ORDER) {
    if (!seen.has(id)) out.push(id);
  }
  return out;
}

export function toolOrderIdsEqual(a: readonly ToolId[], b: readonly ToolId[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((id, i) => id === b[i]);
}

/** Best-known order for first paint (memory cache only — may be default before hydration). */
export function getCachedToolOrder(): ToolId[] {
  if (memoryOrderHydrated && memoryOrder) return [...memoryOrder];
  return [...DEFAULT_ORDER];
}

export async function loadToolOrder(): Promise<ToolId[]> {
  if (memoryOrderHydrated && memoryOrder) return [...memoryOrder];
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const next = !raw ? [...DEFAULT_ORDER] : normalizeToolOrder(JSON.parse(raw) as unknown);
    memoryOrder = next;
    memoryOrderHydrated = true;
    return [...next];
  } catch {
    memoryOrder = [...DEFAULT_ORDER];
    memoryOrderHydrated = true;
    return [...DEFAULT_ORDER];
  }
}

export async function saveToolOrder(ids: ToolId[]): Promise<void> {
  const next = normalizeToolOrder(ids);
  memoryOrder = next;
  memoryOrderHydrated = true;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export async function resetToolOrderToDefault(): Promise<void> {
  memoryOrder = [...DEFAULT_ORDER];
  memoryOrderHydrated = true;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...DEFAULT_ORDER]));
}
