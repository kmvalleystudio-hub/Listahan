import type { SyncToolId } from "../constants/syncTools";
import { SYNC_TOOL_IDS } from "../constants/syncTools";
import type { SyncToolsConfig } from "../constants/syncTools";
import { loadPersisted, savePersisted } from "../storage/persist";
import type {
  GroceryList,
  HistoryEntry,
  PrivateList,
  TodoHistoryEntry,
  TodoList,
} from "../types";
import { saveQuickNotes, loadQuickNotes, type QuickNote } from "../utils/quickNotesStorage";
import { saveReminders, loadReminders, type SavedReminder } from "../utils/remindersStorage";
import { exportSyncToolPayload } from "./syncSnapshotExport";

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function parseGroceryPayload(payload: unknown): { lists: GroceryList[]; history: HistoryEntry[] } | null {
  if (!isRecord(payload)) return null;
  const lists = Array.isArray(payload.lists) ? (payload.lists as GroceryList[]) : [];
  const history = Array.isArray(payload.history) ? (payload.history as HistoryEntry[]) : [];
  return { lists, history };
}

function parseTodoPayload(payload: unknown): { lists: TodoList[]; history: TodoHistoryEntry[] } | null {
  if (!isRecord(payload)) return null;
  const lists = Array.isArray(payload.lists) ? (payload.lists as TodoList[]) : [];
  const history = Array.isArray(payload.history) ? (payload.history as TodoHistoryEntry[]) : [];
  return { lists, history };
}

function parseNotesPayload(payload: unknown): QuickNote[] | null {
  if (!isRecord(payload)) return null;
  return Array.isArray(payload.notes) ? (payload.notes as QuickNote[]) : [];
}

function parseRemindersPayload(payload: unknown): SavedReminder[] | null {
  if (!isRecord(payload)) return null;
  return Array.isArray(payload.reminders) ? (payload.reminders as SavedReminder[]) : [];
}

function parseVaultPayload(payload: unknown): PrivateList[] | null {
  if (!isRecord(payload)) return null;
  return Array.isArray(payload.privateLists) ? (payload.privateLists as PrivateList[]) : [];
}

export async function captureLocalBackupForTools(
  tools: SyncToolsConfig,
  vaultSyncAllowed: boolean
): Promise<Partial<Record<SyncToolId, unknown>>> {
  const out: Partial<Record<SyncToolId, unknown>> = {};
  for (const id of SYNC_TOOL_IDS) {
    if (!tools[id]) continue;
    const payload = await exportSyncToolPayload(id, vaultSyncAllowed);
    if (payload != null) out[id] = payload;
  }
  return out;
}

export async function applySyncToolPayload(
  tool: SyncToolId,
  payload: unknown,
  mode: "replace" | "merge" = "replace"
): Promise<void> {
  const persisted = await loadPersisted();

  switch (tool) {
    case "grocery": {
      const parsed = parseGroceryPayload(payload);
      if (!parsed) return;
      if (mode === "replace") {
        await savePersisted({
          ...persisted,
          lists: parsed.lists,
          history: parsed.history,
        });
      }
      break;
    }
    case "todo": {
      const parsed = parseTodoPayload(payload);
      if (!parsed) return;
      if (mode === "replace") {
        await savePersisted({
          ...persisted,
          todoLists: parsed.lists,
          todoHistory: parsed.history,
        });
      }
      break;
    }
    case "notes": {
      const notes = parseNotesPayload(payload);
      if (!notes) return;
      if (mode === "replace") {
        await saveQuickNotes(notes);
      }
      break;
    }
    case "reminders": {
      const reminders = parseRemindersPayload(payload);
      if (!reminders) return;
      if (mode === "replace") {
        await saveReminders(reminders);
      }
      break;
    }
    case "vault": {
      const privateLists = parseVaultPayload(payload);
      if (!privateLists) return;
      if (mode === "replace") {
        await savePersisted({
          ...persisted,
          privateLists,
        });
      }
      break;
    }
    default:
      break;
  }
}

export async function applySyncSnapshots(
  snapshots: Array<{ toolKey: string; payload: unknown }>,
  toolsFilter: SyncToolsConfig
): Promise<void> {
  for (const snap of snapshots) {
    const tool = snap.toolKey as SyncToolId;
    if (!SYNC_TOOL_IDS.includes(tool) || !toolsFilter[tool]) continue;
    await applySyncToolPayload(tool, snap.payload, "replace");
  }
}

export async function restoreSyncBackupTools(
  tools: Partial<Record<SyncToolId, unknown>>
): Promise<void> {
  for (const id of SYNC_TOOL_IDS) {
    const payload = tools[id];
    if (payload == null) continue;
    await applySyncToolPayload(id, payload, "replace");
  }
}

/** Re-export for backup capture without vault when locked */
export async function loadLocalNotesAndReminders() {
  return {
    notes: await loadQuickNotes(),
    reminders: await loadReminders(),
  };
}
