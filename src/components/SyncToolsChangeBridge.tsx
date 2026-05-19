import { useEffect, useRef } from "react";
import { useSyncSession } from "../context/SyncSessionContext";
import { useAppAlert } from "../context/AppAlertContext";
import { navigationRef } from "../navigation/navigationRef";
import {
  SYNC_TOOL_IDS,
  SYNC_TOOL_LABELS,
  type SyncToolId,
  type SyncToolsConfig,
} from "../constants/syncTools";

const TOOL_ROUTE_NAMES: Record<SyncToolId, string[]> = {
  grocery: ["GroceryHome", "CreateList", "ListDetail", "History", "CompletedListPreview", "AllDone"],
  todo: ["TodoHome", "TodoCreateList", "TodoListDetail", "TodoRecent", "TodoRecentPreview"],
  notes: ["NotesHome", "NoteEditor"],
  reminders: ["ReminderHome", "ReminderEditor"],
  vault: ["PrivateHome", "PrivateCreateList", "PrivateListDetail", "PrivateVaultSettings"],
};

function routeUsesDisabledTool(tools: SyncToolsConfig): boolean {
  if (!navigationRef.isReady()) return false;
  const route = navigationRef.getCurrentRoute()?.name;
  if (!route) return false;
  return SYNC_TOOL_IDS.some((id) => !tools[id] && TOOL_ROUTE_NAMES[id].includes(route));
}

/** Live partner tool-toggle updates — refresh session, notify, leave disabled tool screens. */
export default function SyncToolsChangeBridge() {
  const { session } = useSyncSession();
  const { showAlert } = useAppAlert();
  const prevToolsKeyRef = useRef("");

  useEffect(() => {
    if (!session) {
      prevToolsKeyRef.current = "";
      return;
    }

    const toolsKey = JSON.stringify(session.tools);
    const prevKey = prevToolsKeyRef.current;
    prevToolsKeyRef.current = toolsKey;

    if (!prevKey || prevKey === toolsKey) return;

    const prevTools = JSON.parse(prevKey) as SyncToolsConfig;
    const turnedOff = SYNC_TOOL_IDS.filter((id) => prevTools[id] && !session.tools[id]);
    if (turnedOff.length === 0) return;

    if (routeUsesDisabledTool(session.tools) && navigationRef.isReady()) {
      navigationRef.navigate("ToolsDashboard");
    }

    const labels = turnedOff.map((id) => SYNC_TOOL_LABELS[id]).join(", ");
    const partner = session.partnerPublicTag || session.partnerUsername || "Your partner";
    showAlert({
      title: "Sync tools updated",
      message: `${partner} turned off: ${labels}.`,
      variant: "info",
    });
  }, [session, showAlert]);

  return null;
}
