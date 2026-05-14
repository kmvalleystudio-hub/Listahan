import { getSupabaseClient } from "./supabaseClient";

/** Same Supabase RPCs as groceries — payload is arbitrary JSON (kind discriminates). */
export async function uploadShareExport(payload: Record<string, unknown>): Promise<string> {
  const sb = getSupabaseClient();
  const { data, error } = await sb.rpc("create_grocery_share_export", {
    p_payload: payload,
  });
  if (error) throw error;
  if (typeof data !== "string" || !data) {
    throw new Error("Unexpected response from share service.");
  }
  return data;
}

export async function replaceShareExport(shareId: string, payload: Record<string, unknown>): Promise<void> {
  const sb = getSupabaseClient();
  const { error } = await sb.rpc("replace_grocery_share_export", {
    p_id: shareId,
    p_payload: payload,
  });
  if (error) throw error;
}

export async function fetchShareExport(shareId: string): Promise<unknown> {
  const sb = getSupabaseClient();
  const { data, error } = await sb.rpc("get_grocery_share_export", { p_id: shareId });
  if (error) throw error;
  return data;
}
