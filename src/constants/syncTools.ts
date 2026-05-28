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

/** Whole-tool snapshots: partner payload replaces local rows (merge would keep local-only rows). */
export const SYNC_WHOLE_TOOL_REPLACE_IDS: SyncToolId[] = ["notes", "reminders"];

export function syncToolUsesReplaceMerge(tool: SyncToolId): boolean {
  return (SYNC_WHOLE_TOOL_REPLACE_IDS as readonly SyncToolId[]).includes(tool);
}

/** Dashboard tool tile id → active sync tool key (when a session is active). */
export function syncToolIdForDashboardTool(
  toolId: "grocery" | "todo" | "private_list" | "reminder" | "notes"
): SyncToolId | null {
  switch (toolId) {
    case "grocery":
      return "grocery";
    case "todo":
      return "todo";
    case "notes":
      return "notes";
    case "reminder":
      return "reminders";
    case "private_list":
      return "vault";
    default:
      return null;
  }
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
