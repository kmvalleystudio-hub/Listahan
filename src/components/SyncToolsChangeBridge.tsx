import { useEffect, useRef } from "react";
import { useSyncSession } from "../context/SyncSessionContext";
import { useAppAlert } from "../context/AppAlertContext";
import { navigationRef } from "../navigation/navigationRef";
import {
  SYNC_TOOL_IDS,
  type SyncToolId,
  type SyncToolsConfig,
} from "../constants/syncTools";
import {
  buildSyncToolsChangeSummary,
  buildSyncToolsDetailsMessage,
  diffSyncTools,
} from "../utils/syncToolsChangeMessage";

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
    const { turnedOn, turnedOff } = diffSyncTools(prevTools, session.tools);
    if (turnedOn.length === 0 && turnedOff.length === 0) return;

    if (routeUsesDisabledTool(session.tools) && navigationRef.isReady()) {
      navigationRef.navigate("ToolsDashboard");
    }

    const partner = session.partnerPublicTag || session.partnerUsername || "Your partner";
    const summary = buildSyncToolsChangeSummary(partner, prevTools, session.tools);
    const revertNote =
      !session.isInitiator && turnedOff.length > 0
        ? "\n\nOn this device, turned-off tools go back to your own lists from before sync."
        : "";
    const detailsMessage = buildSyncToolsDetailsMessage(session.tools, partner);

    showAlert({
      title: "Sync tools updated",
      message: `${summary}${revertNote}`,
      variant: "info",
      buttons: [
        {
          text: "Details",
          style: "cancel",
          onPress: () => {
            showAlert({
              title: "Sync tools",
              message: detailsMessage,
              variant: "info",
            });
          },
        },
        { text: "OK", style: "default" },
      ],
    });
  }, [session, showAlert]);

  return null;
}
