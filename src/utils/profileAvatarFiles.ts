import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";
import { saveUserProfile } from "./userProfileStorage";

export function localAvatarDestination(ext: string): string {
  const safe = ext.startsWith(".") ? ext : `.${ext}`;
  return `${FileSystem.documentDirectory ?? ""}profile_avatar${safe}`;
}

export function extFromPickerAsset(uri: string, mime?: string | null): ".jpg" | ".png" {
  const m = (mime ?? "").toLowerCase();
  if (m.includes("png")) return ".png";
  if (uri.toLowerCase().endsWith(".png")) return ".png";
  return ".jpg";
}

/** Copies picker output into app storage and updates the local profile record. */
export async function persistProfileAvatarLocal(pickerUri: string, mime?: string | null): Promise<string> {
  if (Platform.OS === "web") {
    await saveUserProfile({
      avatarLocalUri: pickerUri,
      avatarRemoteUrl: undefined,
      avatarStoragePath: undefined,
    });
    return pickerUri;
  }
  const dir = FileSystem.documentDirectory;
  if (!dir) {
    await saveUserProfile({
      avatarLocalUri: pickerUri,
      avatarRemoteUrl: undefined,
      avatarStoragePath: undefined,
    });
    return pickerUri;
  }
  const ext = extFromPickerAsset(pickerUri, mime);
  const dest = localAvatarDestination(ext);
  try {
    const info = await FileSystem.getInfoAsync(dest);
    if (info.exists) await FileSystem.deleteAsync(dest, { idempotent: true });
  } catch {
    /* ignore */
  }
  await FileSystem.copyAsync({ from: pickerUri, to: dest });
  await saveUserProfile({
    avatarLocalUri: dest,
    avatarRemoteUrl: undefined,
    avatarStoragePath: undefined,
  });
  return dest;
}
