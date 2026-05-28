import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

let client: SupabaseClient | null = null;

function readUrl(): string | undefined {
  const fromEnv = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (typeof fromEnv === "string" && fromEnv.trim()) return fromEnv.trim();
  const extra = Constants.expoConfig?.extra as { supabaseUrl?: string } | undefined;
  if (typeof extra?.supabaseUrl === "string" && extra.supabaseUrl.trim()) return extra.supabaseUrl.trim();
  return undefined;
}

function readAnonKey(): string | undefined {
  const fromEnv = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (typeof fromEnv === "string" && fromEnv.trim()) return fromEnv.trim();
  const extra = Constants.expoConfig?.extra as { supabaseAnonKey?: string } | undefined;
  if (typeof extra?.supabaseAnonKey === "string" && extra.supabaseAnonKey.trim()) return extra.supabaseAnonKey.trim();
  return undefined;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(readUrl() && readAnonKey());
}

/** Lightweight reachability check — no native modules (works in any APK build). */
export async function pingSupabaseReachable(timeoutMs = 5000): Promise<boolean> {
  const url = readUrl();
  const key = readAnonKey();
  if (!url || !key) return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/`, {
      method: "HEAD",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      signal: controller.signal,
    });
    return res.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;
  const url = readUrl();
  const key = readAnonKey();
  if (!url || !key) {
    throw new Error("Supabase is not configured (set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY).");
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}
