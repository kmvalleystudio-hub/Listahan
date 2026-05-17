import { File as ExpoFsFile } from "expo-file-system";
import { Platform } from "react-native";
import { getSupabaseClient, isSupabaseConfigured } from "./supabaseClient";
import type { UserProfile } from "../utils/userProfileStorage";

const BUCKET = "profile_avatars";

export function avatarObjectPath(deviceProfileId: string, filename: string): string {
  return `${deviceProfileId}/${filename}`;
}

export function avatarFilenameFromMime(mime?: string | null): string {
  const m = (mime ?? "").toLowerCase();
  if (m.includes("png")) return "avatar.png";
  return "avatar.jpg";
}

export function contentTypeFromMime(mime?: string | null): string {
  const m = (mime ?? "").toLowerCase();
  if (m.includes("png")) return "image/png";
  return "image/jpeg";
}

export function publicUrlForStoragePath(storagePath: string): string | null {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data } = getSupabaseClient().storage.from(BUCKET).getPublicUrl(storagePath);
    return data.publicUrl ?? null;
  } catch {
    return null;
  }
}

type UploadResult = { ok: true; publicUrl: string; storagePath: string } | { ok: false; message: string };

type UploadBytes = Blob | ArrayBuffer;

/**
 * React Native: fetch(file://…) is unreliable; avoid `new Blob([arrayBuffer])` — Hermes RN Blob rejects
 * ArrayBuffer / ArrayBufferView parts. Read bytes via expo-file-system and upload raw ArrayBuffer
 * (Supabase sends it as the request body without wrapping in FormData).
 */
async function loadAvatarUploadBody(localUri: string, mimeType?: string | null): Promise<UploadBytes> {
  if (Platform.OS === "web") {
    const contentType = contentTypeFromMime(mimeType);
    const res = await fetch(localUri);
    if (!res.ok) {
      throw new Error(`Could not read image (${res.status}).`);
    }
    const blob = await res.blob();
    return blob.type ? blob : new Blob([blob], { type: contentType });
  }
  const fileRef = new ExpoFsFile(localUri);
  return fileRef.arrayBuffer();
}

export async function uploadProfileAvatarToCloud(
  deviceProfileId: string,
  username: string,
  localUri: string,
  mimeType?: string | null
): Promise<UploadResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Cloud profile sync is not configured." };
  }
  try {
    const client = getSupabaseClient();
    const filename = avatarFilenameFromMime(mimeType);
    const path = avatarObjectPath(deviceProfileId, filename);
    const body = await loadAvatarUploadBody(localUri, mimeType);
    const { error: upErr } = await client.storage.from(BUCKET).upload(path, body, {
      upsert: true,
      contentType: contentTypeFromMime(mimeType),
    });
    if (upErr) return { ok: false, message: upErr.message };

    const { error: rpcErr } = await client.rpc("upsert_listahan_public_profile", {
      p_device_profile_id: deviceProfileId,
      p_username: username.trim().toLowerCase(),
      p_avatar_storage_path: path,
    });
    if (rpcErr) return { ok: false, message: rpcErr.message };

    const url = publicUrlForStoragePath(path);
    if (!url) return { ok: false, message: "Could not resolve public avatar URL." };
    return { ok: true, publicUrl: url, storagePath: path };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed.";
    return { ok: false, message: msg };
  }
}

export async function deleteProfileAvatarFromCloud(
  deviceProfileId: string,
  username: string,
  storagePath?: string | null
): Promise<{ ok: boolean; message?: string }> {
  if (!isSupabaseConfigured()) return { ok: true };
  try {
    const client = getSupabaseClient();
    const paths = new Set<string>();
    if (storagePath?.trim()) paths.add(storagePath.trim());
    paths.add(avatarObjectPath(deviceProfileId, "avatar.jpg"));
    paths.add(avatarObjectPath(deviceProfileId, "avatar.png"));
    await client.storage.from(BUCKET).remove([...paths]);

    const { error } = await client.rpc("upsert_listahan_public_profile", {
      p_device_profile_id: deviceProfileId,
      p_username: username.trim().toLowerCase(),
      p_avatar_storage_path: null,
    });
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Delete failed." };
  }
}

/** Upserts username (and avatar path) for discovery/sync rows. */
export async function upsertPublicProfileMeta(
  profile: Pick<UserProfile, "deviceProfileId" | "username" | "avatarStoragePath">
): Promise<{ ok: boolean; message?: string }> {
  if (!isSupabaseConfigured()) return { ok: true };
  try {
    const { error } = await getSupabaseClient().rpc("upsert_listahan_public_profile", {
      p_device_profile_id: profile.deviceProfileId,
      p_username: profile.username ?? "",
      p_avatar_storage_path: profile.avatarStoragePath ?? null,
    });
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Sync failed." };
  }
}
