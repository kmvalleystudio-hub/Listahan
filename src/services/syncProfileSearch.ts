import { getSupabaseClient, isSupabaseConfigured } from "./supabaseClient";
import { publicUrlForStoragePath } from "./profileCloudSync";
import { listahanPublicTag } from "../utils/userProfileStorage";

const SEARCH_RPC_TIMEOUT_MS = 45_000;

export type SyncProfileSearchResult = {
  deviceProfileId: string;
  username: string;
  tagSuffix: string;
  publicTag: string;
  avatarUrl: string | null;
  updatedAt: string | null;
};

type RpcRow = {
  device_profile_id: string;
  username: string;
  tag_suffix: string | null;
  avatar_storage_path: string | null;
  updated_at: string | null;
};

function mapRow(row: RpcRow): SyncProfileSearchResult {
  const tagSuffix = (row.tag_suffix ?? "").trim();
  const username = (row.username ?? "").trim();
  return {
    deviceProfileId: row.device_profile_id,
    username,
    tagSuffix,
    publicTag: listahanPublicTag(username, tagSuffix),
    avatarUrl: row.avatar_storage_path ? publicUrlForStoragePath(row.avatar_storage_path) : null,
    updatedAt: row.updated_at,
  };
}

export async function searchProfiles(
  query: string,
  callerDeviceId: string
): Promise<{ ok: true; results: SyncProfileSearchResult[] } | { ok: false; message: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Cloud search is not configured on this build." };
  }
  const q = query.trim();
  if (q.length < 1) {
    return { ok: true, results: [] };
  }

  const ac = new AbortController();
  const tid = setTimeout(() => ac.abort(), SEARCH_RPC_TIMEOUT_MS);
  let data: unknown;
  let error: { message?: string } | null = null;
  try {
    const result = await getSupabaseClient()
      .rpc("search_listahan_profiles", {
        p_query: q,
        p_caller_id: callerDeviceId,
      })
      .abortSignal(ac.signal);
    data = result.data;
    error = result.error;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.toLowerCase().includes("abort")) {
      return { ok: false, message: "Search timed out. Check your connection and try again." };
    }
    return { ok: false, message: msg || "Search failed." };
  } finally {
    clearTimeout(tid);
  }

  if (error) {
    const msg = (error.message ?? "").toLowerCase();
    if (msg.includes("abort") || msg.includes("timeout")) {
      return { ok: false, message: "Search timed out. Check your connection and try again." };
    }
    if (msg.includes("search_listahan_profiles") && msg.includes("could not find")) {
      return { ok: false, message: "Search is not available yet. Apply the latest Supabase migration." };
    }
    if (msg.includes("caller_required")) {
      return { ok: false, message: "Profile not ready. Finish username setup and try again." };
    }
    return { ok: false, message: error.message ?? "Search failed." };
  }

  const rows = (Array.isArray(data) ? data : []) as RpcRow[];
  return { ok: true, results: rows.map(mapRow) };
}
