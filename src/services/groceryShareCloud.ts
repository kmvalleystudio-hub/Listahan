import { getSupabaseClient } from "./supabaseClient";
import { parseGrocerySharePayload, type GroceryShareFileV1 } from "../utils/grocerySharePayload";

export async function uploadGroceryShareToCloud(payload: GroceryShareFileV1): Promise<string> {
  const sb = getSupabaseClient();
  const { data, error } = await sb.rpc("create_grocery_share_export", {
    p_payload: payload as unknown as Record<string, unknown>,
  });
  if (error) throw error;
  if (typeof data !== "string" || !data) {
    throw new Error("Unexpected response from share service.");
  }
  return data;
}

export async function fetchGroceryShareFromCloud(shareId: string): Promise<GroceryShareFileV1 | null> {
  const sb = getSupabaseClient();
  const { data, error } = await sb.rpc("get_grocery_share_export", { p_id: shareId });
  if (error) throw error;
  if (data == null) return null;
  return parseGrocerySharePayload(data);
}
