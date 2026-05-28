import { useEffect } from "react";
import { useSyncSession } from "../context/SyncSessionContext";

type Props = {
  tool: "notes" | "reminders";
  refresh: () => Promise<void>;
};

/** Registers notes/reminders list reload after partner snapshot merge. */
export default function SyncAuxRefreshBridge({ tool, refresh }: Props) {
  const { registerNotesRefresh, registerRemindersRefresh } = useSyncSession();
  const register = tool === "notes" ? registerNotesRefresh : registerRemindersRefresh;

  useEffect(() => register(refresh), [register, refresh]);

  return null;
}
