import AsyncStorage from "@react-native-async-storage/async-storage";
import { TOOLS_CATALOG, type ToolId } from "../constants/toolsCatalog";

const STORAGE_KEY = "@saycart/tools_dashboard_order_v1";

const DEFAULT_ORDER: ToolId[] = TOOLS_CATALOG.map((t) => t.id);

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

export async function loadToolOrder(): Promise<ToolId[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_ORDER];
    return normalizeToolOrder(JSON.parse(raw) as unknown);
  } catch {
    return [...DEFAULT_ORDER];
  }
}

export async function saveToolOrder(ids: ToolId[]): Promise<void> {
  const next = normalizeToolOrder(ids);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
