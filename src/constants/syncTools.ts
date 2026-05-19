export const SYNC_TOOL_IDS = ["grocery", "todo", "notes", "reminders", "vault"] as const;

export type SyncToolId = (typeof SYNC_TOOL_IDS)[number];

export type SyncToolsConfig = Record<SyncToolId, boolean>;

export const DEFAULT_SYNC_TOOLS_REQUEST: SyncToolsConfig = {
  grocery: true,
  todo: true,
  notes: false,
  reminders: false,
  vault: false,
};

export const SYNC_TOOL_LABELS: Record<SyncToolId, string> = {
  grocery: "Grocery lists",
  todo: "To-do lists",
  notes: "Notes",
  reminders: "Reminders",
  vault: "Vault sheets",
};

export function hasEnabledSyncTool(tools: SyncToolsConfig): boolean {
  return SYNC_TOOL_IDS.some((id) => tools[id]);
}

export function syncToolsToJson(tools: SyncToolsConfig): Record<string, boolean> {
  return {
    grocery: !!tools.grocery,
    todo: !!tools.todo,
    notes: !!tools.notes,
    reminders: !!tools.reminders,
    vault: !!tools.vault,
  };
}

export function syncToolsFromJson(raw: unknown): SyncToolsConfig {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    grocery: !!o.grocery,
    todo: !!o.todo,
    notes: !!o.notes,
    reminders: !!o.reminders,
    vault: !!o.vault,
  };
}
