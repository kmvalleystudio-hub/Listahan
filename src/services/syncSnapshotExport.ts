import type { SyncToolId, SyncToolsConfig } from "../constants/syncTools";
import { SYNC_TOOL_IDS } from "../constants/syncTools";
import { loadPersisted, type PersistShape } from "../storage/persist";
import {
  stampGroceryPayload,
  stampNotesPayload,
  stampRemindersPayload,
  stampTodoPayload,
  stampVaultPayload,
} from "../utils/syncPayloadStamp";
import { loadQuickNotesAll } from "../utils/quickNotesStorage";
import { loadRemindersRaw } from "../utils/remindersStorage";

export type SyncToolPayload = unknown;

/** In-memory grocery/todo/vault rows for sync export (avoids stale AsyncStorage reads). */
export type SyncExportSource = PersistShape;

export async function exportSyncToolPayload(
  tool: SyncToolId,
  vaultSyncAllowed: boolean,
  source?: SyncExportSource | null
): Promise<SyncToolPayload | null> {
  if (tool === "vault" && !vaultSyncAllowed) return null;

  const persisted = source ?? (await loadPersisted());

  switch (tool) {
    case "grocery":
      return stampGroceryPayload({ lists: persisted.lists, history: persisted.history });
    case "todo":
      return stampTodoPayload({ lists: persisted.todoLists, history: persisted.todoHistory });
    case "notes":
      return stampNotesPayload({ notes: await loadQuickNotesAll() });
    case "reminders":
      return stampRemindersPayload({ reminders: await loadRemindersRaw() });
    case "vault":
      return stampVaultPayload({ privateLists: persisted.privateLists });
    default:
      return null;
  }
}

export async function exportEnabledSyncPayloads(
  tools: SyncToolsConfig,
  vaultSyncAllowed: boolean,
  source?: SyncExportSource | null
): Promise<Partial<Record<SyncToolId, SyncToolPayload>>> {
  const out: Partial<Record<SyncToolId, SyncToolPayload>> = {};
  for (const id of SYNC_TOOL_IDS) {
    if (!tools[id]) continue;
    const payload = await exportSyncToolPayload(id, vaultSyncAllowed, source);
    if (payload != null) out[id] = payload;
  }
  return out;
}
