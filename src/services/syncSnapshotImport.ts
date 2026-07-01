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
import {
  mergeGroceryPayload,
  mergeNotesPayload,
  mergeRemindersPayload,
  mergeTodoPayload,
  mergeVaultPayload,
} from "../utils/syncMerge";
import {
  stampGroceryPayload,
  stampNotesPayload,
  stampRemindersPayload,
  stampTodoPayload,
  stampVaultPayload,
} from "../utils/syncPayloadStamp";
import { saveQuickNotes, loadQuickNotesAll, type QuickNote } from "../utils/quickNotesStorage";
import { saveReminders, loadRemindersRaw, type SavedReminder } from "../utils/remindersStorage";
import { exportSyncToolPayload, type SyncExportSource } from "./syncSnapshotExport";

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

/** Snapshot every tool on this device before sync merges partner data. */
export async function captureFullLocalBackup(
  _vaultSyncAllowed: boolean
): Promise<Partial<Record<SyncToolId, unknown>>> {
  const allTools: SyncToolsConfig = {
    grocery: true,
    todo: true,
    notes: true,
    reminders: true,
    vault: true,
  };
  const out = await captureLocalBackupForTools(allTools, true);
  if (out.vault == null) {
    const vaultPayload = await exportSyncToolPayload("vault", true);
    if (vaultPayload != null) out.vault = vaultPayload;
  }
  return out;
}

export async function applySyncToolPayload(
  tool: SyncToolId,
  payload: unknown,
  mode: "replace" | "merge" = "replace",
  vaultSyncAllowed = true,
  /** In-memory rows from SyncDataBridge — avoids merging against stale AsyncStorage. */
  localSource?: SyncExportSource | null
): Promise<void> {
  const disk = await loadPersisted();
  const mergeSource = localSource ?? disk;

  switch (tool) {
    case "grocery": {
      const parsed = parseGroceryPayload(payload);
      if (!parsed) return;
      if (mode === "replace") {
        const stamped = stampGroceryPayload(parsed);
        await savePersisted({
          ...disk,
          lists: stamped.lists.filter((l) => !l.deletedAt),
          history: stamped.history,
        });
        return;
      }
      const localRaw = await exportSyncToolPayload("grocery", true, mergeSource);
      const local = parseGroceryPayload(localRaw) ?? { lists: [], history: [] };
      const merged = mergeGroceryPayload(local, stampGroceryPayload(parsed));
      await savePersisted({
        ...disk,
        lists: merged.lists.filter((l) => !l.deletedAt),
        history: merged.history,
      });
      break;
    }
    case "todo": {
      const parsed = parseTodoPayload(payload);
      if (!parsed) return;
      if (mode === "replace") {
        const stamped = stampTodoPayload(parsed);
        await savePersisted({
          ...disk,
          todoLists: stamped.lists.filter((l) => !l.deletedAt),
          todoHistory: stamped.history,
        });
        return;
      }
      const localRaw = await exportSyncToolPayload("todo", true, mergeSource);
      const local = parseTodoPayload(localRaw) ?? { lists: [], history: [] };
      const merged = mergeTodoPayload(local, stampTodoPayload(parsed));
      await savePersisted({
        ...disk,
        todoLists: merged.lists.filter((l) => !l.deletedAt),
        todoHistory: merged.history,
      });
      break;
    }
    case "notes": {
      const notes = parseNotesPayload(payload);
      if (!notes) return;
      if (mode === "replace") {
        await saveQuickNotes(stampNotesPayload({ notes }).notes.filter((n) => !n.deletedAt));
        return;
      }
      const localNotes = await loadQuickNotesAll();
      const merged = mergeNotesPayload(
        { notes: localNotes },
        stampNotesPayload({ notes })
      );
      await saveQuickNotes(merged.notes.filter((n) => !n.deletedAt));
      break;
    }
    case "reminders": {
      const reminders = parseRemindersPayload(payload);
      if (!reminders) return;
      if (mode === "replace") {
        await saveReminders(stampRemindersPayload({ reminders }).reminders.filter((r) => !r.deletedAt));
        return;
      }
      const localReminders = await loadRemindersRaw();
      const merged = mergeRemindersPayload(
        { reminders: localReminders },
        stampRemindersPayload({ reminders })
      );
      await saveReminders(merged.reminders.filter((r) => !r.deletedAt));
      break;
    }
    case "vault": {
      /** Import when vault is enabled in the active sync session. */
      if (!vaultSyncAllowed) return;
      const privateLists = parseVaultPayload(payload);
      if (!privateLists) return;
      if (mode === "replace") {
        const stamped = stampVaultPayload({ privateLists });
        await savePersisted({
          ...disk,
          privateLists: stamped.privateLists.filter((l) => !l.deletedAt),
        });
        return;
      }
      const localRaw = await exportSyncToolPayload("vault", true, mergeSource);
      const localLists = parseVaultPayload(localRaw) ?? [];
      const merged = mergeVaultPayload(
        { privateLists: localLists },
        stampVaultPayload({ privateLists })
      );
      await savePersisted({
        ...disk,
        privateLists: merged.privateLists.filter((l) => !l.deletedAt),
      });
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
    await applySyncToolPayload(tool, snap.payload, "replace", true);
  }
}

/** Apply the sync sender's snapshots for specific tools (replace, not merge). */
export async function applyInitiatorSnapshotsForTools(
  snapshots: Array<{ toolKey: string; payload: unknown; updatedBy: string; version: number }>,
  initiatorDeviceId: string,
  toolIds: SyncToolId[],
  toolsFilter: SyncToolsConfig
): Promise<Array<{ toolKey: string; version: number }>> {
  const want = new Set(toolIds);
  const applied: Array<{ toolKey: string; version: number }> = [];
  for (const snap of snapshots) {
    if (snap.updatedBy !== initiatorDeviceId) continue;
    const tool = snap.toolKey as SyncToolId;
    if (!want.has(tool) || !toolsFilter[tool]) continue;
    await applySyncToolPayload(tool, snap.payload, "replace", true);
    applied.push({ toolKey: tool, version: snap.version });
  }
  return applied;
}

const INITIATOR_EMPTY_PAYLOAD: Partial<Record<SyncToolId, unknown>> = {
  notes: { notes: [] },
  reminders: { reminders: [] },
};

/**
 * Recipient: apply sender snapshots for newly enabled tools. If the sender has not
 * uploaded a row yet, notes/reminders default to empty (sender is source of truth).
 */
export async function applyInitiatorSnapshotsForToolsOrEmpty(
  snapshots: Array<{ toolKey: string; payload: unknown; updatedBy: string; version: number }>,
  initiatorDeviceId: string,
  toolIds: SyncToolId[],
  toolsFilter: SyncToolsConfig
): Promise<Array<{ toolKey: string; version: number }>> {
  const applied = await applyInitiatorSnapshotsForTools(
    snapshots,
    initiatorDeviceId,
    toolIds,
    toolsFilter
  );
  const appliedSet = new Set(applied.map((a) => a.toolKey));
  for (const tool of toolIds) {
    if (!toolsFilter[tool] || appliedSet.has(tool)) continue;
    const emptyPayload = INITIATOR_EMPTY_PAYLOAD[tool];
    if (emptyPayload == null) continue;
    await applySyncToolPayload(tool, emptyPayload, "replace", true);
    applied.push({ toolKey: tool, version: 0 });
  }
  return applied;
}

/** Recipient accept: replace local data with the sync sender's snapshots only. */
export async function applyInitiatorSnapshotsOnAccept(
  snapshots: Array<{ toolKey: string; payload: unknown; updatedBy: string; version: number }>,
  initiatorDeviceId: string,
  toolsFilter: SyncToolsConfig
): Promise<Array<{ toolKey: string; version: number }>> {
  return applyInitiatorSnapshotsForTools(snapshots, initiatorDeviceId, SYNC_TOOL_IDS, toolsFilter);
}

export async function restoreSyncBackupTools(
  tools: Partial<Record<SyncToolId, unknown>>
): Promise<void> {
  for (const id of SYNC_TOOL_IDS) {
    const payload = tools[id];
    if (payload == null) continue;
    await applySyncToolPayload(id, payload, "replace", true);
  }
}

/** Re-export for backup capture without vault when locked */
export async function loadLocalNotesAndReminders() {
  return {
    notes: await loadQuickNotes(),
    reminders: await loadReminders(),
  };
}
