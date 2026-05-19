import { getSupabaseClient, isSupabaseConfigured } from "./supabaseClient";

const SYNC_RPC_TIMEOUT_MS = 45_000;

async function rpcWithTimeout<T>(call: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ac = new AbortController();
  const tid = setTimeout(() => ac.abort(), SYNC_RPC_TIMEOUT_MS);
  try {
    return await call(ac.signal);
  } finally {
    clearTimeout(tid);
  }
}
import type { SyncToolsConfig } from "../constants/syncTools";
import { syncToolsFromJson, syncToolsToJson } from "../constants/syncTools";
import { listahanPublicTag } from "../utils/userProfileStorage";
import { publicUrlForStoragePath } from "./profileCloudSync";

export type SyncRequestRow = {
  id: string;
  fromDeviceId: string;
  toDeviceId: string;
  status: string;
  tools: SyncToolsConfig;
  createdAt: string;
  fromUsername: string;
  fromTagSuffix: string;
  fromPublicTag: string;
  fromAvatarUrl: string | null;
};

type RpcRequestRow = {
  id: string;
  from_device_id: string;
  to_device_id: string;
  status: string;
  tools: unknown;
  created_at: string;
  from_username: string | null;
  from_tag_suffix: string | null;
  from_avatar_storage_path: string | null;
};

function mapRequest(row: RpcRequestRow): SyncRequestRow {
  const fromUsername = (row.from_username ?? "").trim();
  const fromTagSuffix = (row.from_tag_suffix ?? "").trim();
  return {
    id: row.id,
    fromDeviceId: row.from_device_id,
    toDeviceId: row.to_device_id,
    status: row.status,
    tools: syncToolsFromJson(row.tools),
    createdAt: row.created_at,
    fromUsername,
    fromTagSuffix,
    fromPublicTag: listahanPublicTag(fromUsername, fromTagSuffix),
    fromAvatarUrl: row.from_avatar_storage_path
      ? publicUrlForStoragePath(row.from_avatar_storage_path)
      : null,
  };
}

function friendlyRpcError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("cannot_sync_with_self")) return "You cannot sync with yourself.";
  if (m.includes("pending_request_exists")) return "A pending request already exists for this user.";
  if (m.includes("active_session_exists")) return "You already have an active sync with this user.";
  if (m.includes("no_tools_selected")) return "Select at least one tool to sync.";
  if (m.includes("not_request_recipient")) return "Only the recipient can respond to this request.";
  if (m.includes("request_not_pending")) return "This request is no longer pending.";
  return message;
}

export async function createSyncRequest(
  fromDeviceId: string,
  toDeviceId: string,
  tools: SyncToolsConfig
): Promise<{ ok: true; requestId: string } | { ok: false; message: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Cloud sync is not configured." };
  }

  const { data, error } = await rpcWithTimeout((signal) =>
    getSupabaseClient()
      .rpc("create_sync_request", {
        p_from_device_id: fromDeviceId,
        p_to_device_id: toDeviceId,
        p_tools: syncToolsToJson(tools),
      })
      .abortSignal(signal)
  );

  if (error) {
    return { ok: false, message: friendlyRpcError(error.message) };
  }
  if (typeof data !== "string") {
    return { ok: false, message: "Unexpected response from server." };
  }
  return { ok: true, requestId: data };
}

export async function listIncomingSyncRequests(
  deviceId: string
): Promise<{ ok: true; requests: SyncRequestRow[] } | { ok: false; message: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Cloud sync is not configured." };
  }

  const { data, error } = await rpcWithTimeout((signal) =>
    getSupabaseClient()
      .rpc("list_sync_requests", {
        p_device_id: deviceId,
        p_direction: "incoming",
      })
      .abortSignal(signal)
  );

  if (error) {
    return { ok: false, message: error.message };
  }

  const rows = (Array.isArray(data) ? data : []) as RpcRequestRow[];
  return { ok: true, requests: rows.map(mapRequest) };
}

export async function countPendingSyncRequests(
  deviceId: string
): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const { data, error } = await rpcWithTimeout((signal) =>
    getSupabaseClient()
      .rpc("count_pending_sync_requests", { p_device_id: deviceId })
      .abortSignal(signal)
  );
  if (error || typeof data !== "number") return 0;
  return data;
}

export async function respondSyncRequest(
  requestId: string,
  deviceId: string,
  accept: boolean
): Promise<{ ok: true; sessionId: string | null } | { ok: false; message: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Cloud sync is not configured." };
  }

  const { data, error } = await rpcWithTimeout((signal) =>
    getSupabaseClient()
      .rpc("respond_sync_request", {
        p_request_id: requestId,
        p_device_id: deviceId,
        p_accept: accept,
      })
      .abortSignal(signal)
  );

  if (error) {
    return { ok: false, message: friendlyRpcError(error.message) };
  }

  return { ok: true, sessionId: typeof data === "string" ? data : null };
}
