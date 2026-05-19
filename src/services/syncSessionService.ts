import { getSupabaseClient, isSupabaseConfigured } from "./supabaseClient";
import type { SyncToolsConfig } from "../constants/syncTools";
import { syncToolsFromJson, syncToolsToJson } from "../constants/syncTools";
import { listahanPublicTag } from "../utils/userProfileStorage";
import { publicUrlForStoragePath } from "./profileCloudSync";

export type ActiveSyncSession = {
  sessionId: string;
  requestId: string;
  initiatorId: string;
  recipientId: string;
  tools: SyncToolsConfig;
  status: string;
  createdAt: string;
  partnerId: string;
  partnerUsername: string;
  partnerTagSuffix: string;
  partnerPublicTag: string;
  partnerAvatarUrl: string | null;
  isInitiator: boolean;
};

type RpcSessionRow = {
  session_id: string;
  request_id: string;
  initiator_id: string;
  recipient_id: string;
  tools: unknown;
  status: string;
  created_at: string;
  partner_id: string;
  partner_username: string | null;
  partner_tag_suffix: string | null;
  partner_avatar_storage_path: string | null;
};

function mapSession(row: RpcSessionRow, deviceId: string): ActiveSyncSession {
  const partnerUsername = (row.partner_username ?? "").trim();
  const partnerTagSuffix = (row.partner_tag_suffix ?? "").trim();
  return {
    sessionId: row.session_id,
    requestId: row.request_id,
    initiatorId: row.initiator_id,
    recipientId: row.recipient_id,
    tools: syncToolsFromJson(row.tools),
    status: row.status,
    createdAt: row.created_at,
    partnerId: row.partner_id,
    partnerUsername,
    partnerTagSuffix,
    partnerPublicTag: listahanPublicTag(partnerUsername, partnerTagSuffix),
    partnerAvatarUrl: row.partner_avatar_storage_path
      ? publicUrlForStoragePath(row.partner_avatar_storage_path)
      : null,
    isInitiator: row.initiator_id === deviceId,
  };
}

export async function fetchActiveSyncSession(
  deviceId: string
): Promise<ActiveSyncSession | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await getSupabaseClient().rpc("get_sync_session", {
    p_device_id: deviceId,
  });

  if (error || !Array.isArray(data) || data.length < 1) return null;
  return mapSession(data[0] as RpcSessionRow, deviceId);
}

export async function updateSyncSessionTools(
  sessionId: string,
  deviceId: string,
  tools: SyncToolsConfig
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Cloud sync is not configured." };
  }

  const { error } = await getSupabaseClient().rpc("update_sync_session_tools", {
    p_session_id: sessionId,
    p_device_id: deviceId,
    p_tools: syncToolsToJson(tools),
  });

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function endSyncSession(
  sessionId: string,
  deviceId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Cloud sync is not configured." };
  }

  const { error } = await getSupabaseClient().rpc("end_sync_session", {
    p_session_id: sessionId,
    p_device_id: deviceId,
  });

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export type SyncSnapshotRow = {
  toolKey: string;
  payload: unknown;
  version: number;
  updatedBy: string;
  updatedAt: string;
};

export async function listSyncSnapshots(
  sessionId: string,
  deviceId: string
): Promise<{ ok: true; snapshots: SyncSnapshotRow[] } | { ok: false; message: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Cloud sync is not configured." };
  }

  const { data, error } = await getSupabaseClient().rpc("list_sync_snapshots", {
    p_session_id: sessionId,
    p_device_id: deviceId,
  });

  if (error) return { ok: false, message: error.message };

  const rows = (Array.isArray(data) ? data : []) as Array<{
    tool_key: string;
    payload: unknown;
    version: number;
    updated_by: string;
    updated_at: string;
  }>;

  return {
    ok: true,
    snapshots: rows.map((r) => ({
      toolKey: r.tool_key,
      payload: r.payload,
      version: r.version,
      updatedBy: r.updated_by,
      updatedAt: r.updated_at,
    })),
  };
}

export async function upsertSyncSnapshot(args: {
  actorId: string;
  requestId?: string | null;
  sessionId?: string | null;
  toolKey: string;
  payload: unknown;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Cloud sync is not configured." };
  }

  const { error } = await getSupabaseClient().rpc("upsert_sync_snapshot", {
    p_actor_id: args.actorId,
    p_request_id: args.requestId ?? null,
    p_session_id: args.sessionId ?? null,
    p_tool_key: args.toolKey,
    p_payload: args.payload,
  });

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
