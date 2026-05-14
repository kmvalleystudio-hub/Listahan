import { Platform } from "react-native";
import { scanFromURLAsync } from "expo-camera";
import * as FileSystem from "expo-file-system/legacy";

/**
 * Decode QR payloads from a gallery/camera-roll image. Uses fallbacks because
 * ML Kit / loaders can miss content:// URIs on Android, or non-black-on-white exports.
 * (Avoids extra native modules so dev clients do not require a rebuild.)
 */
export async function scanQrDataStringsFromImage(uri: string): Promise<string[]> {
  const found = new Set<string>();

  const scan = async (u: string) => {
    try {
      const results = await scanFromURLAsync(u, ["qr"]);
      for (const r of results) {
        if (typeof r.data === "string" && r.data.trim()) found.add(r.data.trim());
      }
    } catch {
      // try next strategy
    }
  };

  await scan(uri);

  if (found.size === 0 && Platform.OS === "android" && FileSystem.cacheDirectory && uri.startsWith("content:")) {
    const dest = `${FileSystem.cacheDirectory}saycart-qr-import-${Date.now()}.jpg`;
    try {
      await FileSystem.copyAsync({ from: uri, to: dest });
      await scan(dest);
    } catch {
      // ignore
    }
  }

  return [...found];
}
