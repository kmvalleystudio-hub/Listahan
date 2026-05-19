import { useEffect, useRef } from "react";
import { useAppData } from "../context/AppDataContext";
import { useSyncSession } from "../context/SyncSessionContext";
import type { SyncExportSource } from "../services/syncSnapshotExport";
import { SYNC_TOOL_IDS } from "../constants/syncTools";

/** Pushes local list changes to the active sync session and refreshes after remote updates. */
export default function SyncDataBridge() {
  const { session, pushToolSnapshot, registerDataRefresh, registerExportSource } = useSyncSession();
  const { lists, history, todoLists, todoHistory, privateLists, refresh } = useAppData();
  const skipPush = useRef(false);
  const exportSourceRef = useRef<SyncExportSource>({
    lists: [],
    history: [],
    todoLists: [],
    todoHistory: [],
    privateLists: [],
  });

  exportSourceRef.current = { lists, history, todoLists, todoHistory, privateLists };

  useEffect(() => {
    registerExportSource(() => exportSourceRef.current);
  }, [registerExportSource, lists, history, todoLists, todoHistory, privateLists]);

  useEffect(() => {
    registerDataRefresh(async () => {
      skipPush.current = true;
      await refresh();
      setTimeout(() => {
        skipPush.current = false;
      }, 900);
    });
  }, [registerDataRefresh, refresh]);

  useEffect(() => {
    if (!session || skipPush.current) return;
    if (session.tools.grocery) void pushToolSnapshot("grocery");
  }, [lists, session, pushToolSnapshot]);

  useEffect(() => {
    if (!session || skipPush.current) return;
    if (session.tools.todo) void pushToolSnapshot("todo");
  }, [todoLists, session, pushToolSnapshot]);

  useEffect(() => {
    if (!session || skipPush.current) return;
    if (session.tools.vault) void pushToolSnapshot("vault");
  }, [privateLists, session, pushToolSnapshot]);

  useEffect(() => {
    if (!session || skipPush.current) return;
    if (!session.tools.notes && !session.tools.reminders) return;
    const id = setInterval(() => {
      if (session.tools.notes) void pushToolSnapshot("notes");
      if (session.tools.reminders) void pushToolSnapshot("reminders");
    }, 8000);
    return () => clearInterval(id);
  }, [session, pushToolSnapshot]);

  void SYNC_TOOL_IDS;
  return null;
}
