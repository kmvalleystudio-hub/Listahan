import { SYNC_TOOL_IDS, SYNC_TOOL_LABELS, type SyncToolId, type SyncToolsConfig } from "../constants/syncTools";

export function diffSyncTools(prev: SyncToolsConfig, next: SyncToolsConfig): {
  turnedOn: SyncToolId[];
  turnedOff: SyncToolId[];
} {
  const turnedOn: SyncToolId[] = [];
  const turnedOff: SyncToolId[] = [];
  for (const id of SYNC_TOOL_IDS) {
    if (!prev[id] && next[id]) turnedOn.push(id);
    else if (prev[id] && !next[id]) turnedOff.push(id);
  }
  return { turnedOn, turnedOff };
}

function labelList(ids: SyncToolId[]): string {
  return ids.map((id) => SYNC_TOOL_LABELS[id]).join(", ");
}

/** Short summary for the first alert after a partner tool change. */
export function buildSyncToolsChangeSummary(
  partnerLabel: string,
  prev: SyncToolsConfig,
  next: SyncToolsConfig
): string {
  const { turnedOn, turnedOff } = diffSyncTools(prev, next);
  const parts: string[] = [];
  if (turnedOn.length > 0) {
    parts.push(`${partnerLabel} turned on: ${labelList(turnedOn)}.`);
  }
  if (turnedOff.length > 0) {
    parts.push(`${partnerLabel} turned off: ${labelList(turnedOff)}.`);
  }
  if (parts.length === 0) {
    return `${partnerLabel} updated which tools are syncing.`;
  }
  return parts.join("\n\n");
}

/** Full tool list — one shared config for both devices while synced. */
export function buildSyncToolsDetailsMessage(
  tools: SyncToolsConfig,
  partnerLabel: string
): string {
  const lines = SYNC_TOOL_IDS.map((id) => {
    const state = tools[id] ? "On" : "Off";
    return `${SYNC_TOOL_LABELS[id]} — ${state}`;
  });
  return [
    `While you are synced with ${partnerLabel}, both devices use the same tool settings:`,
    "",
    ...lines,
  ].join("\n");
}
