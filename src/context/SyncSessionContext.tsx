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
import { SYNC_TOOL_IDS } from "../constants/syncTools";
import { loadUserProfile } from "../utils/userProfileStorage";
import { usePrivateVault } from "./PrivateVaultContext";
import SyncConnectedOverlay from "../components/SyncConnectedOverlay";
import SyncEndedOverlay from "../components/SyncEndedOverlay";
import {
  promoteSyncBackup,
  restoreSyncBackupForSession,
  hasSyncBackup,
  saveSyncBackup,
} from "../utils/syncBackupStorage";
import { captureLocalBackupForTools } from "../services/syncSnapshotImport";
import { syncToolsFromJson } from "../constants/syncTools";

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
  celebration: SyncCelebration | null;
  refreshSyncState: () => Promise<void>;
  celebrateSyncConnected: (partnerLabel: string, sessionId?: string) => void;
  celebrateSyncEnded: (sessionId?: string) => void;
  updateTools: (tools: SyncToolsConfig) => Promise<{ ok: boolean; message?: string }>;
  endSession: () => Promise<{ ok: boolean; message?: string }>;
  pushToolSnapshot: (tool: SyncToolId) => Promise<void>;
  registerDataRefresh: (fn: () => Promise<void>) => void;
  registerExportSource: (fn: () => SyncExportSource) => void;
};

const SyncSessionContext = createContext<SyncSessionContextValue | null>(null);

const PUSH_DEBOUNCE_MS = 500;
/** Pull partner snapshot changes while a session is active (Realtime backup). */
const SNAPSHOT_POLL_MS = 4000;
/** Refresh pending badge + discover new sessions (Realtime backup). */
const SYNC_STATE_POLL_MS = 12000;

export function SyncSessionProvider({ children }: { children: React.ReactNode }) {
  const { vaultSyncAllowed } = usePrivateVault();
  const [ready, setReady] = useState(false);
  const [pendingIncomingCount, setPendingIncomingCount] = useState(0);
  const [session, setSession] = useState<ActiveSyncSession | null>(null);
  const [celebration, setCelebration] = useState<SyncCelebration | null>(null);
  const [syncEndedVisible, setSyncEndedVisible] = useState(false);
  const deviceIdRef = useRef<string>("");
  const sessionRef = useRef<ActiveSyncSession | null>(null);
  const celebratedSessionIdsRef = useRef<Set<string>>(new Set());
  const endedSessionIdsRef = useRef<Set<string>>(new Set());
  const dataRefreshRef = useRef<(() => Promise<void>) | null>(null);
  const exportSourceRef = useRef<(() => SyncExportSource) | null>(null);
  const pushTimers = useRef<Partial<Record<SyncToolId, ReturnType<typeof setTimeout>>>>({});
  const lastAppliedVersion = useRef<Partial<Record<string, number>>>({});
  const applyingRemoteRef = useRef(false);

  const applyRemoteSnapshots = useCallback(async () => {
    const active = sessionRef.current;
    const deviceId = deviceIdRef.current;
    if (!active || !deviceId || !isSupabaseConfigured()) return;

    applyingRemoteRef.current = true;
    try {
      const listed = await listSyncSnapshots(active.sessionId, deviceId);
      if (!listed.ok) return;

      let changed = false;
      for (const snap of listed.snapshots) {
        const tool = snap.toolKey as SyncToolId;
        if (!SYNC_TOOL_IDS.includes(tool) || !active.tools[tool]) continue;
        const verKey = `${active.sessionId}:${tool}`;
        const prev = lastAppliedVersion.current[verKey] ?? 0;
        if (snap.updatedBy === deviceId) continue;
        if (snap.version <= prev) continue;
        await applySyncToolPayload(tool, snap.payload, "replace");
        lastAppliedVersion.current[verKey] = snap.version;
        changed = true;
      }
      if (changed && dataRefreshRef.current) {
        await dataRefreshRef.current();
      }
    } finally {
      applyingRemoteRef.current = false;
    }
  }, []);

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

  const dismissCelebration = useCallback(() => setCelebration(null), []);

  const celebrateSyncEnded = useCallback((sessionId?: string) => {
    if (sessionId && endedSessionIdsRef.current.has(sessionId)) return;
    if (sessionId) endedSessionIdsRef.current.add(sessionId);
    setSyncEndedVisible(true);
  }, []);

  const dismissSyncEnded = useCallback(() => setSyncEndedVisible(false), []);

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
    const [active, pending] = await Promise.all([
      fetchActiveSyncSession(profile.deviceProfileId),
      countPendingSyncRequests(profile.deviceProfileId),
    ]);
    sessionRef.current = active;
    setSession(active);
    setPendingIncomingCount(pending);
    setReady(true);
    if (active) {
      await applyRemoteSnapshots();
    } else {
      lastAppliedVersion.current = {};
    }
  }, [applyRemoteSnapshots]);

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
                  const tools = syncToolsFromJson(row.tools);
                  const backup = await captureLocalBackupForTools(tools, vaultSyncAllowed);
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
                celebrateSyncEnded(sessionId);
                if (sessionId) {
                  const restored = await restoreSyncBackupForSession(sessionId, requestId);
                  if (restored && dataRefreshRef.current) {
                    await dataRefreshRef.current();
                  }
                }
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
  }, [celebrateSyncConnected, celebrateSyncEnded, refreshSyncState, vaultSyncAllowed]);

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
          void applyRemoteSnapshots();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void applyRemoteSnapshots();
      });

    void applyRemoteSnapshots();

    return () => {
      void client.removeChannel(channel);
    };
  }, [session?.sessionId, applyRemoteSnapshots]);

  useEffect(() => {
    if (!session || !isSupabaseConfigured()) return;
    const timer = setInterval(() => {
      void applyRemoteSnapshots();
    }, SNAPSHOT_POLL_MS);
    return () => clearInterval(timer);
  }, [session?.sessionId, applyRemoteSnapshots]);

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
        void (async () => {
          const active = sessionRef.current;
          if (!active || applyingRemoteRef.current) return;
          const source = exportSourceRef.current?.() ?? null;
          const payload = await exportSyncToolPayload(tool, vaultSyncAllowed, source);
          if (payload == null) return;
          await upsertSyncSnapshot({
            actorId: deviceIdRef.current,
            sessionId: active.sessionId,
            toolKey: tool,
            payload,
          });
        })();
      }, PUSH_DEBOUNCE_MS);
    },
    [session, vaultSyncAllowed]
  );

  const updateTools = useCallback(
    async (tools: SyncToolsConfig) => {
      if (!session) return { ok: false, message: "No active sync session." };
      const result = await updateSyncSessionTools(session.sessionId, deviceIdRef.current, tools);
      if (!result.ok) return { ok: false, message: result.message };
      await refreshSyncState();
      return { ok: true };
    },
    [session, refreshSyncState]
  );

  const endSession = useCallback(async () => {
    if (!session) return { ok: false, message: "No active session." };
    const result = await endSyncSession(session.sessionId, deviceIdRef.current);
    if (!result.ok) return { ok: false, message: result.message };
    await refreshSyncState();
    return { ok: true };
  }, [session, refreshSyncState]);

  const registerDataRefresh = useCallback((fn: () => Promise<void>) => {
    dataRefreshRef.current = fn;
  }, []);

  const registerExportSource = useCallback((fn: () => SyncExportSource) => {
    exportSourceRef.current = fn;
  }, []);

  const value = useMemo(
    () => ({
      ready,
      pendingIncomingCount,
      session,
      celebration,
      refreshSyncState,
      celebrateSyncConnected,
      celebrateSyncEnded,
      updateTools,
      endSession,
      pushToolSnapshot,
      registerDataRefresh,
      registerExportSource,
    }),
    [
      ready,
      pendingIncomingCount,
      session,
      celebration,
      refreshSyncState,
      celebrateSyncConnected,
      celebrateSyncEnded,
      updateTools,
      endSession,
      pushToolSnapshot,
      registerDataRefresh,
      registerExportSource,
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
