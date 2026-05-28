/** ISO timestamp helpers for sync last-write-wins merge. */

export function syncTimeMs(iso?: string | null): number {
  if (!iso || typeof iso !== "string") return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

/** Latest activity on an entity (edit or delete). */
export function entityActivityMs(entity: { updatedAt?: string; deletedAt?: string }): number {
  return Math.max(syncTimeMs(entity.updatedAt), syncTimeMs(entity.deletedAt));
}

export function isSyncDeleted(entity: { deletedAt?: string }): boolean {
  return Boolean(entity.deletedAt);
}

type SyncCheckable = {
  checked?: boolean;
  checkPending?: boolean;
};

function checkProgressScore(row: SyncCheckable): number {
  if (row.checked && !row.checkPending) return 2;
  if (row.checkPending) return 1;
  return 0;
}

export function pickSyncWinner<T extends { id: string; updatedAt?: string; deletedAt?: string }>(
  local: T,
  remote: T
): T {
  const lm = entityActivityMs(local);
  const rm = entityActivityMs(remote);
  if (rm > lm) return remote;
  if (lm > rm) return local;
  if (remote.deletedAt && !local.deletedAt) return remote;
  if (local.deletedAt && !remote.deletedAt) return local;
  return remote;
}

/** Last-write-wins for list rows; on a tie, prefer the more "done" check state. */
export function pickSyncItemWinner<
  T extends { id: string; updatedAt?: string; deletedAt?: string } & SyncCheckable,
>(local: T, remote: T): T {
  const lm = entityActivityMs(local);
  const rm = entityActivityMs(remote);
  if (rm > lm) return remote;
  if (lm > rm) return local;
  const lp = checkProgressScore(local);
  const rp = checkProgressScore(remote);
  if (rp > lp) return remote;
  if (lp > rp) return local;
  if (remote.deletedAt && !local.deletedAt) return remote;
  if (local.deletedAt && !remote.deletedAt) return local;
  return remote;
}

export function nowIso(): string {
  return new Date().toISOString();
}
