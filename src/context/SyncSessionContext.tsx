import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import { getSupabaseClient, isSupabaseConfigured } from "../services/supabaseClient";
import {
  fetchActiveSyncSession,
  listSyncSnapshots,
  upsertSyncSnapshot,
  updateSyncSessionTools,
  endSyncSession,
  type ActiveSyncSession,
} from "../services/syncSessionService";
import { countPendingSyncRequests } from "../services/syncRequestService";
import { exportSyncToolPayload, type SyncExportSource } from "../services/syncSnapshotExport";
import { applySyncToolPayload } from "../services/syncSnapshotImport";
import type { SyncToolId, SyncToolsConfig } from "../constants/syncTools";
import { SYNC_TOOL_IDS, syncToolUsesReplaceMerge } from "../constants/syncTools";
import { subscribeSyncConnectivity, checkSyncConnectivity } from "../utils/syncConnectivity";
import { loadUserProfile } from "../utils/userProfileStorage";
import { usePrivateVault } from "./PrivateVaultContext";
import SyncConnectedOverlay from "../components/SyncConnectedOverlay";
import SyncEndedOverlay from "../components/SyncEndedOverlay";
import {
  promoteSyncBackup,
  restoreSyncBackupForSession,
  restoreSyncBackupToolsByIds,
  hasSyncBackup,
  saveSyncBackup,
} from "../utils/syncBackupStorage";
import {
  applyInitiatorSnapshotsForToolsOrEmpty,
  captureFullLocalBackup,
} from "../services/syncSnapshotImport";
import { diffSyncTools } from "../utils/syncToolsChangeMessage";
import { notifyNotesUiRefresh, notifyRemindersUiRefresh } from "../utils/syncLocalChangeNotify";

function partnerLabelFromSession(active: ActiveSyncSession): string {
  return (active.partnerPublicTag || active.partnerUsername || "your partner").trim();
}

type SyncCelebration = {
  partnerLabel: string;
};

type SyncSessionContextValue = {
  ready: boolean;
  pendingIncomingCount: number;
  session: ActiveSyncSession | null;
  /** True while merging partner snapshot updates into local data. */
  partnerRefreshing: boolean;
  celebration: SyncCelebration | null;
  refreshSyncState: () => Promise<void>;
  celebrateSyncConnected: (partnerLabel: string, sessionId?: string) => void;
  celebrateSyncEnded: (sessionId?: string) => void;
  updateTools: (tools: SyncToolsConfig) => Promise<{ ok: boolean; message?: string }>;
  endSession: () => Promise<{ ok: boolean; message?: string }>;
  pushToolSnapshot: (tool: SyncToolId) => Promise<void>;
  registerDataRefresh: (fn: () => Promise<void>) => void;
  registerNotesRefresh: (fn: () => Promise<void>) => () => void;
  registerRemindersRefresh: (fn: () => Promise<void>) => () => void;
  /** Tools dashboard reload after sync-connected celebration ends. */
  registerDashboardRefresh: (fn: () => Promise<void>) => () => void;
  registerExportSource: (fn: () => SyncExportSource) => void;
  /** Blocks outbound pushes while the recipient is accepting (prevents overwriting sender data). */
  runDuringSyncAccept: <T>(fn: () => Promise<T>) => Promise<T>;
  /** Push all enabled tools immediately (initiator session start). */
  flushAllEnabledSnapshots: () => Promise<void>;
  seedSnapshotVersions: (sessionId: string, rows: Array<{ toolKey: string; version: number }>) => void;
};

const SyncSessionContext = createContext<SyncSessionContextValue | null>(null);

const PUSH_DEBOUNCE_MS = 500;
/** Silent catch-up pull (no Refreshing UI) if Realtime misses an event. */
const SNAPSHOT_CATCHUP_MS = 45000;
/** When offline or pushes are queued, retry push + pull on this interval. */
const OFFLINE_RECONCILE_MS = 30000;
/** Refresh pending badge + discover new sessions (Realtime backup). */
const SYNC_STATE_POLL_MS = 12000;

export function SyncSessionProvider({ children }: { children: React.ReactNode }) {
  const { vaultSyncAllowed } = usePrivateVault();
  const [ready, setReady] = useState(false);
  const [pendingIncomingCount, setPendingIncomingCount] = useState(0);
  const [session, setSession] = useState<ActiveSyncSession | null>(null);
  const [celebration, setCelebration] = useState<SyncCelebration | null>(null);
  const [syncEndedVisible, setSyncEndedVisible] = useState(false);
  const [partnerRefreshing, setPartnerRefreshing] = useState(false);
  const deviceIdRef = useRef<string>("");
  const sessionRef = useRef<ActiveSyncSession | null>(null);
  const celebratedSessionIdsRef = useRef<Set<string>>(new Set());
  const endedSessionIdsRef = useRef<Set<string>>(new Set());
  const dataRefreshRef = useRef<(() => Promise<void>) | null>(null);
  const notesRefreshListeners = useRef(new Set<() => Promise<void>>());
  const remindersRefreshListeners = useRef(new Set<() => Promise<void>>());
  const dashboardRefreshListeners = useRef(new Set<() => Promise<void>>());
  const exportSourceRef = useRef<(() => SyncExportSource) | null>(null);
  const pushTimers = useRef<Partial<Record<SyncToolId, ReturnType<typeof setTimeout>>>>({});
  const lastAppliedVersion = useRef<Partial<Record<string, number>>>({});
  const applyingRemoteRef = useRef(false);
  const pendingPushTools = useRef<Set<SyncToolId>>(new Set());
  const isOnlineRef = useRef(true);
  const reconcileInFlightRef = useRef(false);
  const pushAllEnabledToolsRef = useRef<() => Promise<void>>(async () => {});
  const suppressSyncPushRef = useRef(false);
  const syncAcceptInProgressRef = useRef(false);
  const finalizeEndSyncRef = useRef<
    (args: { sessionId: string; requestId?: string }) => Promise<void>
  >(async () => {});

  const flushPushTool = useCallback(
    async (tool: SyncToolId): Promise<boolean> => {
      if (suppressSyncPushRef.current || syncAcceptInProgressRef.current) return false;
      const active = sessionRef.current;
      if (!active || !active.tools[tool]) return false;
      if (!isSupabaseConfigured()) return false;

      if (applyingRemoteRef.current) {
        pendingPushTools.current.add(tool);
        return false;
      }

      const source = exportSourceRef.current?.() ?? null;
      const allowVaultExport = tool !== "vault" || vaultSyncAllowed || active.tools.vault;
      const payload = await exportSyncToolPayload(tool, allowVaultExport, source);
      if (payload == null) return false;

      isOnlineRef.current = true;

      const result = await upsertSyncSnapshot({
        actorId: deviceIdRef.current,
        sessionId: active.sessionId,
        toolKey: tool,
        payload,
      });

      if (!result.ok) {
        isOnlineRef.current = false;
        pendingPushTools.current.add(tool);
        return false;
      }

      pendingPushTools.current.delete(tool);
      return true;
    },
    [vaultSyncAllowed]
  );

  const pushAllEnabledTools = useCallback(async () => {
    const active = sessionRef.current;
    if (!active) return;
    const tools = new Set<SyncToolId>([
      ...SYNC_TOOL_IDS.filter((t) => active.tools[t]),
      ...pendingPushTools.current,
    ]);
    for (const tool of tools) {
      await flushPushTool(tool);
    }
  }, [flushPushTool]);

  pushAllEnabledToolsRef.current = pushAllEnabledTools;

  const flushAllEnabledSnapshots = useCallback(async () => {
    const active = sessionRef.current;
    if (!active) return;
    for (const tool of SYNC_TOOL_IDS) {
      if (active.tools[tool]) await flushPushTool(tool);
    }
  }, [flushPushTool]);

  const runDuringSyncAccept = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    syncAcceptInProgressRef.current = true;
    suppressSyncPushRef.current = true;
    try {
      return await fn();
    } finally {
      syncAcceptInProgressRef.current = false;
      suppressSyncPushRef.current = false;
    }
  }, []);

  const seedSnapshotVersions = useCallback(
    (sessionId: string, rows: Array<{ toolKey: string; version: number }>) => {
      for (const row of rows) {
        lastAppliedVersion.current[`${sessionId}:${row.toolKey}`] = row.version;
      }
    },
    []
  );

  const applyRemoteSnapshots = useCallback(
    async (opts?: { showRefreshing?: boolean }) => {
      const active = sessionRef.current;
      const deviceId = deviceIdRef.current;
      if (!active || !deviceId || !isSupabaseConfigured()) return;

      const listed = await listSyncSnapshots(active.sessionId, deviceId);
      if (!listed.ok) return;

      const toApply = listed.snapshots.filter((snap) => {
        const tool = snap.toolKey as SyncToolId;
        if (!SYNC_TOOL_IDS.includes(tool) || !active.tools[tool]) return false;
        const verKey = `${active.sessionId}:${tool}`;
        const prev = lastAppliedVersion.current[verKey] ?? 0;
        return snap.updatedBy !== deviceId && snap.version > prev;
      });

      if (toApply.length === 0) return;

      const showRefreshing = opts?.showRefreshing !== false;
      if (showRefreshing) setPartnerRefreshing(true);
      applyingRemoteRef.current = true;
      try {
        let appDataChanged = false;
        let notesChanged = false;
        let remindersChanged = false;
        for (const snap of toApply) {
          const tool = snap.toolKey as SyncToolId;
          const verKey = `${active.sessionId}:${tool}`;
          try {
            const localSource = exportSourceRef.current?.() ?? null;
            const mode = syncToolUsesReplaceMerge(tool) ? "replace" : "merge";
            const vaultImportOk = tool !== "vault" || active.tools.vault;
            await applySyncToolPayload(tool, snap.payload, mode, vaultImportOk, localSource);
            lastAppliedVersion.current[verKey] = snap.version;
            if (tool === "notes") notesChanged = true;
            else if (tool === "reminders") remindersChanged = true;
            else appDataChanged = true;
          } catch (err) {
            console.warn(`[sync] merge failed for ${tool}:`, err);
          }
        }
        if (appDataChanged && dataRefreshRef.current) {
          await dataRefreshRef.current();
        }
        if (notesChanged) {
          await Promise.all([...notesRefreshListeners.current].map((fn) => fn()));
          await notifyNotesUiRefresh();
        }
        if (remindersChanged) {
          await Promise.all([...remindersRefreshListeners.current].map((fn) => fn()));
          await notifyRemindersUiRefresh();
        }
      } finally {
        applyingRemoteRef.current = false;
        if (showRefreshing) setPartnerRefreshing(false);
        if (pendingPushTools.current.size > 0) {
          void pushAllEnabledToolsRef.current();
        }
      }
    },
    [vaultSyncAllowed]
  );

  const reconcileSync = useCallback(async () => {
    if (!sessionRef.current || reconcileInFlightRef.current) return;
    reconcileInFlightRef.current = true;
    try {
      const online = await checkSyncConnectivity();
      isOnlineRef.current = online;
      if (!online) return;
      await pushAllEnabledTools();
      await applyRemoteSnapshots({ showRefreshing: false });
    } finally {
      reconcileInFlightRef.current = false;
    }
  }, [applyRemoteSnapshots, pushAllEnabledTools]);

  const refreshPendingCount = useCallback(async () => {
    const deviceId = deviceIdRef.current;
    if (!deviceId || !isSupabaseConfigured()) return;
    const pending = await countPendingSyncRequests(deviceId);
    setPendingIncomingCount(pending);
  }, []);

  const celebrateSyncConnected = useCallback((partnerLabel: string, sessionId?: string) => {
    if (sessionId && celebratedSessionIdsRef.current.has(sessionId)) return;
    if (sessionId) celebratedSessionIdsRef.current.add(sessionId);
    const label = partnerLabel.trim() || "your partner";
    setCelebration({ partnerLabel: label });
  }, []);

  const celebrateSyncEnded = useCallback((sessionId?: string) => {
    if (sessionId && endedSessionIdsRef.current.has(sessionId)) return;
    if (sessionId) endedSessionIdsRef.current.add(sessionId);
    setSyncEndedVisible(true);
  }, []);

  const dismissSyncEnded = useCallback(() => setSyncEndedVisible(false), []);

  const refreshAfterToolRestore = useCallback(async (toolIds: SyncToolId[]) => {
    let appDataChanged = false;
    let notesChanged = false;
    let remindersChanged = false;
    for (const id of toolIds) {
      if (id === "notes") notesChanged = true;
      else if (id === "reminders") remindersChanged = true;
      else appDataChanged = true;
    }
    if (appDataChanged && dataRefreshRef.current) {
      await dataRefreshRef.current();
    }
    if (notesChanged) {
      await Promise.all([...notesRefreshListeners.current].map((fn) => fn()));
      await notifyNotesUiRefresh();
    }
    if (remindersChanged) {
      const { reconcileScheduledReminders } = await import("../utils/reminderNotifications");
      await reconcileScheduledReminders();
      await Promise.all([...remindersRefreshListeners.current].map((fn) => fn()));
      await notifyRemindersUiRefresh();
    }
  }, []);

  const refreshSyncState = useCallback(async () => {
    const profile = await loadUserProfile();
    deviceIdRef.current = profile.deviceProfileId;
    if (!isSupabaseConfigured()) {
      sessionRef.current = null;
      setSession(null);
      setPendingIncomingCount(0);
      setReady(true);
      lastAppliedVersion.current = {};
      return;
    }
    const prev = sessionRef.current;
    const [active, pending] = await Promise.all([
      fetchActiveSyncSession(profile.deviceProfileId),
      countPendingSyncRequests(profile.deviceProfileId),
    ]);

    let turnedOff: SyncToolId[] = [];
    let turnedOn: SyncToolId[] = [];
    if (prev && active && prev.sessionId === active.sessionId) {
      const diff = diffSyncTools(prev.tools, active.tools);
      turnedOff = diff.turnedOff;
      turnedOn = diff.turnedOn;
    }

    sessionRef.current = active;
    setSession(active);
    setPendingIncomingCount(pending);
    setReady(true);

    if (active && turnedOff.length > 0 && !active.isInitiator) {
      suppressSyncPushRef.current = true;
      try {
        const restored = await restoreSyncBackupToolsByIds(
          active.sessionId,
          turnedOff,
          active.requestId
        );
        if (restored) {
          await refreshAfterToolRestore(turnedOff);
        }
      } finally {
        suppressSyncPushRef.current = false;
      }
    }

    if (active && turnedOn.length > 0) {
      suppressSyncPushRef.current = true;
      applyingRemoteRef.current = true;
      try {
        if (active.isInitiator) {
          for (const id of turnedOn) {
            await flushPushTool(id);
          }
          const listed = await listSyncSnapshots(active.sessionId, deviceIdRef.current);
          if (listed.ok) {
            const applied = listed.snapshots
              .filter((s) => turnedOn.includes(s.toolKey as SyncToolId))
              .map((s) => ({ toolKey: s.toolKey, version: s.version }));
            seedSnapshotVersions(active.sessionId, applied);
          }
        } else {
          const pullInitiator = async () => {
            const listed = await listSyncSnapshots(active.sessionId, deviceIdRef.current);
            if (!listed.ok) return [] as Array<{ toolKey: string; version: number }>;
            return applyInitiatorSnapshotsForToolsOrEmpty(
              listed.snapshots,
              active.initiatorId,
              turnedOn,
              active.tools
            );
          };
          let applied = await pullInitiator();
          if (applied.some((a) => a.version === 0)) {
            await new Promise((r) => setTimeout(r, 900));
            const retry = await pullInitiator();
            for (const row of retry) {
              if (row.version > 0) {
                const idx = applied.findIndex((a) => a.toolKey === row.toolKey);
                if (idx >= 0) applied[idx] = row;
                else applied.push(row);
              }
            }
          } else if (applied.length < turnedOn.length) {
            await new Promise((r) => setTimeout(r, 900));
            applied = await pullInitiator();
          }
          const versionRows = applied.filter((a) => a.version > 0);
          if (versionRows.length > 0) {
            seedSnapshotVersions(active.sessionId, versionRows);
          }
          await refreshAfterToolRestore(turnedOn);
        }
      } finally {
        suppressSyncPushRef.current = false;
        applyingRemoteRef.current = false;
      }
    }

    if (active) {
      await applyRemoteSnapshots({ showRefreshing: false });
    } else if (prev) {
      const sessionId = prev.sessionId;
      if (sessionId && !endedSessionIdsRef.current.has(sessionId)) {
        celebrateSyncEnded(sessionId);
        await finalizeEndSyncRef.current({ sessionId, requestId: prev.requestId });
      } else {
        lastAppliedVersion.current = {};
      }
    } else {
      lastAppliedVersion.current = {};
    }
  }, [applyRemoteSnapshots, refreshAfterToolRestore, flushPushTool, seedSnapshotVersions, celebrateSyncEnded]);

  const dismissCelebration = useCallback(() => {
    setCelebration(null);
    void (async () => {
      await refreshSyncState();
      if (dataRefreshRef.current) await dataRefreshRef.current();
      await Promise.all([...dashboardRefreshListeners.current].map((fn) => fn()));
    })();
  }, [refreshSyncState]);

  /** Both devices restore their own pre-sync backup; block snapshot re-merge during restore. */
  const finalizeEndSync = useCallback(
    async (args: { sessionId: string; requestId?: string }) => {
      const { sessionId, requestId } = args;
      sessionRef.current = null;
      setSession(null);
      lastAppliedVersion.current = {};
      suppressSyncPushRef.current = true;
      applyingRemoteRef.current = true;
      try {
        const restored = await restoreSyncBackupForSession(sessionId, requestId);
        if (restored) {
          await refreshAfterToolRestore([...SYNC_TOOL_IDS]);
        }
      } finally {
        suppressSyncPushRef.current = false;
        applyingRemoteRef.current = false;
      }
    },
    [refreshAfterToolRestore]
  );

  finalizeEndSyncRef.current = finalizeEndSync;

  useEffect(() => {
    void refreshSyncState();
  }, [refreshSyncState]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "active") void refreshSyncState();
    });
    return () => sub.remove();
  }, [refreshSyncState]);

  /** Incoming sync requests — update Profile badge without leaving the screen. */
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;
    let channel: ReturnType<ReturnType<typeof getSupabaseClient>["channel"]> | null = null;

    void (async () => {
      const profile = await loadUserProfile();
      if (cancelled || !profile.deviceProfileId) return;
      deviceIdRef.current = profile.deviceProfileId;

      const client = getSupabaseClient();
      channel = client
        .channel(`sync-requests-in-${profile.deviceProfileId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "listahan_sync_requests",
            filter: `to_device_id=eq.${profile.deviceProfileId}`,
          },
          () => {
            void refreshPendingCount();
            void refreshSyncState();
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) void getSupabaseClient().removeChannel(channel);
    };
  }, [refreshPendingCount, refreshSyncState]);

  /** New active session — celebration on requester + accepter (deduped by session id). */
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;
    let channel: ReturnType<ReturnType<typeof getSupabaseClient>["channel"]> | null = null;

    void (async () => {
      const profile = await loadUserProfile();
      if (cancelled || !profile.deviceProfileId) return;
      const deviceId = profile.deviceProfileId;
      deviceIdRef.current = deviceId;

      const client = getSupabaseClient();
      channel = client
        .channel(`sync-sessions-${deviceId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "listahan_sync_sessions",
          },
          (payload) => {
            const row = payload.new as {
              id?: string;
              initiator_id?: string;
              recipient_id?: string;
              status?: string;
            };
            if (row.status && row.status !== "active") return;
            if (row.initiator_id !== deviceId && row.recipient_id !== deviceId) return;
            void (async () => {
              if (row.initiator_id === deviceId && row.id) {
                if (row.request_id) {
                  await promoteSyncBackup(row.request_id, row.id);
                }
                if (!(await hasSyncBackup(row.id))) {
                  const backup = await captureFullLocalBackup(vaultSyncAllowed);
                  await saveSyncBackup(row.id, backup);
                }
              }
              await refreshSyncState();
              const active = sessionRef.current;
              if (!active) return;
              celebrateSyncConnected(partnerLabelFromSession(active), active.sessionId);
            })();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "listahan_sync_sessions",
          },
          (payload) => {
            const row = payload.new as {
              id?: string;
              request_id?: string;
              initiator_id?: string;
              recipient_id?: string;
              status?: string;
            };
            if (row.initiator_id !== deviceId && row.recipient_id !== deviceId) return;

            if (row.status === "ended") {
              void (async () => {
                const active = sessionRef.current;
                const sessionId = row.id ?? active?.sessionId;
                const requestId = row.request_id ?? active?.requestId;
                if (!sessionId) return;
                celebrateSyncEnded(sessionId);
                await finalizeEndSync({ sessionId, requestId });
                await refreshSyncState();
              })();
              return;
            }

            if (row.status === "active") {
              void refreshSyncState();
            }
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) void getSupabaseClient().removeChannel(channel);
    };
  }, [celebrateSyncConnected, celebrateSyncEnded, refreshSyncState, vaultSyncAllowed, finalizeEndSync]);

  /** Partner toggles tools — refresh session config immediately. */
  useEffect(() => {
    if (!session || !isSupabaseConfigured()) return;

    const client = getSupabaseClient();
    const sessionId = session.sessionId;
    const channel = client
      .channel(`sync-session-tools-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "listahan_sync_sessions",
          filter: `id=eq.${sessionId}`,
        },
        () => {
          void refreshSyncState();
        }
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [session?.sessionId, refreshSyncState]);

  /** Partner snapshot edits — live grocery/todo updates on any screen. */
  useEffect(() => {
    if (!session || !isSupabaseConfigured()) return;

    const client = getSupabaseClient();
    const sessionId = session.sessionId;
    const channel = client
      .channel(`sync-snapshots-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "listahan_sync_snapshots",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          void applyRemoteSnapshots({ showRefreshing: true });
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void applyRemoteSnapshots({ showRefreshing: false });
      });

    void applyRemoteSnapshots({ showRefreshing: false });

    return () => {
      void client.removeChannel(channel);
    };
  }, [session?.sessionId, applyRemoteSnapshots]);

  useEffect(() => {
    if (!session || !isSupabaseConfigured()) return;
    const timer = setInterval(() => {
      void applyRemoteSnapshots({ showRefreshing: false });
    }, SNAPSHOT_CATCHUP_MS);
    return () => clearInterval(timer);
  }, [session?.sessionId, applyRemoteSnapshots]);

  /** Offline / pending push: retry upload + merge pull every 30s until caught up. */
  useEffect(() => {
    if (!session || !isSupabaseConfigured()) return;
    const timer = setInterval(() => {
      if (!isOnlineRef.current || pendingPushTools.current.size > 0) {
        void reconcileSync();
      }
    }, OFFLINE_RECONCILE_MS);
    return () => clearInterval(timer);
  }, [session?.sessionId, reconcileSync]);

  useEffect(() => {
    if (!session || !isSupabaseConfigured()) return;
    return subscribeSyncConnectivity((online) => {
      const wasOffline = !isOnlineRef.current;
      isOnlineRef.current = online;
      if (online && (wasOffline || pendingPushTools.current.size > 0)) {
        void reconcileSync();
      }
    });
  }, [session?.sessionId, reconcileSync]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const timer = setInterval(() => {
      void refreshSyncState();
    }, SYNC_STATE_POLL_MS);
    return () => clearInterval(timer);
  }, [refreshSyncState]);

  const pushToolSnapshot = useCallback(
    async (tool: SyncToolId) => {
      if (!session || applyingRemoteRef.current) return;
      const existing = pushTimers.current[tool];
      if (existing) clearTimeout(existing);
      pushTimers.current[tool] = setTimeout(() => {
        void flushPushTool(tool);
      }, PUSH_DEBOUNCE_MS);
    },
    [session, flushPushTool]
  );

  const updateTools = useCallback(
    async (tools: SyncToolsConfig) => {
      const active = sessionRef.current;
      if (!active) return { ok: false, message: "No active sync session." };
      const result = await updateSyncSessionTools(active.sessionId, deviceIdRef.current, tools);
      if (!result.ok) return { ok: false, message: result.message };
      await refreshSyncState();
      return { ok: true };
    },
    [refreshSyncState]
  );

  const endSession = useCallback(async () => {
    const active = sessionRef.current;
    if (!active) return { ok: false, message: "No active session." };
    const { sessionId, requestId } = active;
    const result = await endSyncSession(sessionId, deviceIdRef.current);
    if (!result.ok) return { ok: false, message: result.message };
    await finalizeEndSync({ sessionId, requestId });
    await refreshSyncState();
    return { ok: true };
  }, [finalizeEndSync, refreshSyncState]);

  const registerDataRefresh = useCallback((fn: () => Promise<void>) => {
    dataRefreshRef.current = fn;
  }, []);

  const registerNotesRefresh = useCallback((fn: () => Promise<void>) => {
    notesRefreshListeners.current.add(fn);
    return () => {
      notesRefreshListeners.current.delete(fn);
    };
  }, []);

  const registerRemindersRefresh = useCallback((fn: () => Promise<void>) => {
    remindersRefreshListeners.current.add(fn);
    return () => {
      remindersRefreshListeners.current.delete(fn);
    };
  }, []);

  const registerDashboardRefresh = useCallback((fn: () => Promise<void>) => {
    dashboardRefreshListeners.current.add(fn);
    return () => {
      dashboardRefreshListeners.current.delete(fn);
    };
  }, []);

  const registerExportSource = useCallback((fn: () => SyncExportSource) => {
    exportSourceRef.current = fn;
  }, []);

  const value = useMemo(
    () => ({
      ready,
      pendingIncomingCount,
      session,
      partnerRefreshing,
      celebration,
      refreshSyncState,
      celebrateSyncConnected,
      celebrateSyncEnded,
      updateTools,
      endSession,
      pushToolSnapshot,
      registerDataRefresh,
      registerNotesRefresh,
      registerRemindersRefresh,
      registerDashboardRefresh,
      registerExportSource,
      runDuringSyncAccept,
      flushAllEnabledSnapshots,
      seedSnapshotVersions,
    }),
    [
      ready,
      pendingIncomingCount,
      session,
      partnerRefreshing,
      celebration,
      refreshSyncState,
      celebrateSyncConnected,
      celebrateSyncEnded,
      updateTools,
      endSession,
      pushToolSnapshot,
      registerDataRefresh,
      registerNotesRefresh,
      registerRemindersRefresh,
      registerDashboardRefresh,
      registerExportSource,
      runDuringSyncAccept,
      flushAllEnabledSnapshots,
      seedSnapshotVersions,
    ]
  );

  return (
    <SyncSessionContext.Provider value={value}>
      {children}
      <SyncConnectedOverlay
        visible={celebration != null}
        partnerLabel={celebration?.partnerLabel ?? ""}
        onFinish={dismissCelebration}
      />
      <SyncEndedOverlay visible={syncEndedVisible} onFinish={dismissSyncEnded} />
    </SyncSessionContext.Provider>
  );
}

export function useSyncSession(): SyncSessionContextValue {
  const ctx = useContext(SyncSessionContext);
  if (!ctx) throw new Error("useSyncSession must be used within SyncSessionProvider");
  return ctx;
}
