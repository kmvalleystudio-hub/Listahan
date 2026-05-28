import { useEffect, useRef } from "react";
import { useAppData } from "../context/AppDataContext";
import { useSyncSession } from "../context/SyncSessionContext";
import type { SyncExportSource } from "../services/syncSnapshotExport";
import { SYNC_TOOL_IDS, type SyncToolsConfig } from "../constants/syncTools";
import {
  subscribeNotesLocalChange,
  subscribeRemindersLocalChange,
} from "../utils/syncLocalChangeNotify";

/** Pushes local list changes to the active sync session and refreshes after remote updates. */
export default function SyncDataBridge() {
  const { session, pushToolSnapshot, registerDataRefresh, registerExportSource, refreshSyncState, flushAllEnabledSnapshots } =
    useSyncSession();
  const { lists, history, todoLists, todoHistory, privateLists, refresh } = useAppData();
  const skipPush = useRef(false);
  const prevSessionToolsKeyRef = useRef("");
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
        const s = session;
        if (!s) return;
        if (s.tools.grocery) void pushToolSnapshot("grocery");
        if (s.tools.todo) void pushToolSnapshot("todo");
        if (s.tools.vault) void pushToolSnapshot("vault");
        if (s.tools.notes) void pushToolSnapshot("notes");
        if (s.tools.reminders) void pushToolSnapshot("reminders");
      }, 900);
    });
  }, [registerDataRefresh, refresh, session, pushToolSnapshot]);

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
    return subscribeNotesLocalChange(() => {
      if (session.tools.notes) void pushToolSnapshot("notes");
    });
  }, [session?.sessionId, session?.tools.notes, pushToolSnapshot]);

  useEffect(() => {
    if (!session || skipPush.current) return;
    return subscribeRemindersLocalChange(() => {
      if (session.tools.reminders) void pushToolSnapshot("reminders");
    });
  }, [session?.sessionId, session?.tools.reminders, pushToolSnapshot]);

  /** When sync tools change (e.g. Notes enabled), upload local data and pull partner snapshots. */
  useEffect(() => {
    if (!session) {
      prevSessionToolsKeyRef.current = "";
      return;
    }
    const key = JSON.stringify(session.tools);
    const prevKey = prevSessionToolsKeyRef.current;
    if (key === prevKey) return;

    let prevTools: SyncToolsConfig | null = null;
    if (prevKey) {
      try {
        prevTools = JSON.parse(prevKey) as SyncToolsConfig;
      } catch {
        prevTools = null;
      }
    }
    prevSessionToolsKeyRef.current = key;

    if (!prevTools) {
      if (session.isInitiator) {
        void flushAllEnabledSnapshots();
      } else {
        void refreshSyncState();
      }
      return;
    }

    const newlyOn = SYNC_TOOL_IDS.filter((id) => session.tools[id] && !prevTools![id]);
    if (newlyOn.length > 0) {
      if (session.isInitiator) {
        for (const id of newlyOn) {
          void pushToolSnapshot(id);
        }
      }
      void refreshSyncState();
    }
  }, [session?.sessionId, session?.tools, session?.isInitiator, pushToolSnapshot, refreshSyncState, flushAllEnabledSnapshots]);

  return null;
}
