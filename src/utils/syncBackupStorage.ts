import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SyncToolId } from "../constants/syncTools";
import type { SyncToolPayload } from "../services/syncSnapshotExport";

const BACKUP_KEY = "@saycart/sync_backup_v1";

export type SyncBackupBundle = {
  sessionId: string;
  savedAt: string;
  tools: Partial<Record<SyncToolId, SyncToolPayload>>;
};

type BackupStore = Record<string, SyncBackupBundle>;

async function readStore(): Promise<BackupStore> {
  try {
    const raw = await AsyncStorage.getItem(BACKUP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as BackupStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeStore(store: BackupStore): Promise<void> {
  await AsyncStorage.setItem(BACKUP_KEY, JSON.stringify(store));
}

export async function saveSyncBackup(
  sessionId: string,
  tools: Partial<Record<SyncToolId, SyncToolPayload>>
): Promise<void> {
  const store = await readStore();
  store[sessionId] = {
    sessionId,
    savedAt: new Date().toISOString(),
    tools,
  };
  await writeStore(store);
}

export async function hasSyncBackup(storageKey: string): Promise<boolean> {
  return (await loadSyncBackup(storageKey)) != null;
}

export async function loadSyncBackup(sessionId: string): Promise<SyncBackupBundle | null> {
  const store = await readStore();
  return store[sessionId] ?? null;
}

export async function clearSyncBackup(sessionId: string): Promise<void> {
  const store = await readStore();
  delete store[sessionId];
  await writeStore(store);
}

/** Copy backup from request id to session id when sync becomes active (initiator). */
export async function promoteSyncBackup(fromKey: string, toKey: string): Promise<boolean> {
  if (fromKey === toKey) return false;
  const backup = await loadSyncBackup(fromKey);
  if (!backup) return false;
  await saveSyncBackup(toKey, backup.tools);
  await clearSyncBackup(fromKey);
  return true;
}

export async function restoreSyncBackupIfAny(storageKey: string): Promise<boolean> {
  const backup = await loadSyncBackup(storageKey);
  if (!backup) return false;
  const { restoreSyncBackupTools } = await import("../services/syncSnapshotImport");
  await restoreSyncBackupTools(backup.tools);
  await clearSyncBackup(storageKey);
  return true;
}

/** Try session id first, then pending request id (initiator backup before accept). */
export async function restoreSyncBackupForSession(
  sessionId: string,
  requestId?: string
): Promise<boolean> {
  if (await restoreSyncBackupIfAny(sessionId)) return true;
  if (requestId && requestId !== sessionId) {
    return restoreSyncBackupIfAny(requestId);
  }
  return false;
}

/** @deprecated Use restoreSyncBackupIfAny or restoreSyncBackupForSession */
export const restoreRecipientBackupIfAny = restoreSyncBackupIfAny;
