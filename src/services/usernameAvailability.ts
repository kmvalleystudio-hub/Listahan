import { getSupabaseClient, isSupabaseConfigured } from "./supabaseClient";

/** Mobile networks + cold DNS can exceed a short window; abort avoids hung fetch. */
const USERNAME_RPC_TIMEOUT_MS = 45_000;

/** Never surface raw PostgREST/Postgres text in username dialogs. */
function friendlyUsernameCheckFailure(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("timed out") || m.includes("abort")) {
    return "The username check is taking too long. Check your connection and try again.";
  }
  if (
    m.includes("could not find the function") ||
    m.includes("schema cache") ||
    m.includes("42883")
  ) {
    return "Username check isn’t ready on the server yet. Run the latest Supabase SQL migration for Listahan, then try again.";
  }
  if (m.includes("network") || m.includes("fetch")) {
    return "Could not reach the server. Check your connection and try again.";
  }
  return "Could not verify username. Please try again.";
}

export async function checkUsernameAvailableOnServer(
  normalizedUsername: string,
  deviceProfileId: string
): Promise<
  | { ok: true }
  | { ok: false; message: string; usernameTaken: boolean }
> {
  if (!isSupabaseConfigured()) return { ok: true };
  const ac = new AbortController();
  const tid = setTimeout(() => ac.abort(), USERNAME_RPC_TIMEOUT_MS);
  try {
    /** Argument order matches DB `(uuid, text)` after migration `20260518140000_*`. */
    const { data, error } = await getSupabaseClient()
      .rpc("check_listahan_username_available", {
        p_device_profile_id: deviceProfileId,
        p_username: normalizedUsername,
      })
      .abortSignal(ac.signal);
    if (error)
      return {
        ok: false,
        message: friendlyUsernameCheckFailure(error.message ?? ""),
        usernameTaken: false,
      };
    if (data !== true)
      return { ok: false, message: "That username is already taken.", usernameTaken: true };
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      message: friendlyUsernameCheckFailure(e instanceof Error ? e.message : ""),
      usernameTaken: false,
    };
  } finally {
    clearTimeout(tid);
  }
}
