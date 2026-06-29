import { useEffect, useState } from "react";
import { Image, Platform, type ImageSourcePropType } from "react-native";

/** Native-only aspect probe; on web uses fallback (resolveAssetSource is unavailable). */
export function useImageAspectRatio(
  source: ImageSourcePropType,
  fallbackAspect: number
): number {
  const [aspect, setAspect] = useState(fallbackAspect);

  useEffect(() => {
    setAspect(fallbackAspect);
    if (Platform.OS === "web") return;

    const resolver = Image.resolveAssetSource;
    if (typeof resolver !== "function") return;

    const resolved = resolver(source);
    const uri = resolved?.uri;
    if (!uri) return;

    Image.getSize(
      uri,
      (w, h) => {
        if (w > 0 && h > 0) setAspect(w / h);
      },
      () => {}
    );
  }, [source, fallbackAspect]);

  return aspect;
}
