import { AppState, type AppStateStatus } from "react-native";
import { isSupabaseConfigured } from "../services/supabaseClient";

export type SyncConnectivityListener = (online: boolean) => void;

let lastOnline: boolean | null = null;

/**
 * True when cloud sync can be attempted.
 * We optimistically return true when configured — push/pull RPC failures queue retries.
 * (HEAD probes were flaky on some devices and blocked all sync.)
 */
export async function checkSyncConnectivity(): Promise<boolean> {
  return isSupabaseConfigured();
}

export function subscribeSyncConnectivity(listener: SyncConnectivityListener): () => void {
  let cancelled = false;

  const emit = async () => {
    const online = await checkSyncConnectivity();
    if (cancelled) return;
    if (lastOnline !== online) {
      lastOnline = online;
      listener(online);
    }
  };

  void emit();
  const interval = setInterval(() => void emit(), 5000);

  const appSub = AppState.addEventListener("change", (next: AppStateStatus) => {
    if (next === "active") void emit();
  });

  return () => {
    cancelled = true;
    clearInterval(interval);
    appSub.remove();
  };
}
