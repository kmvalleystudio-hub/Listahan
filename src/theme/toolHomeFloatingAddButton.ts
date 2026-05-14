import { Platform, type ViewStyle } from "react-native";
import type { AppThemeColors } from "./colors";

/**
 * Stronger shadow / glow for bottom “Add” CTAs on tool home screens in dark mode,
 * so long lists read behind a clearly floating pill (iOS/web: colored shadow; Android: elevation).
 */
export function toolHomeFloatingAddButtonDarkLift(isDark: boolean, c: AppThemeColors): ViewStyle {
  if (!isDark) return {};
  return {
    shadowColor: c.primary,
    shadowOpacity: Platform.OS === "android" ? 0.42 : 0.58,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 12 },
    elevation: Platform.OS === "android" ? 22 : 14,
  };
}
