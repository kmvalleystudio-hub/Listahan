import { Platform, StatusBar as RNStatusBar } from "react-native";
import type { RootStackParamList } from "../navigation/types";

/** Onboarding screens use fixed palettes, not the global theme. */
const ROUTE_STATUS_BAR: Partial<Record<keyof RootStackParamList, "light-content" | "dark-content">> = {
  Welcome: "light-content",
  UsernameSetup: "dark-content",
};

export function syncStatusBarForRoute(
  routeName: keyof RootStackParamList | undefined,
  isDark: boolean
): void {
  if (Platform.OS === "web") return;
  const style = (routeName && ROUTE_STATUS_BAR[routeName]) ?? (isDark ? "light-content" : "dark-content");
  RNStatusBar.setBarStyle(style);
  if (Platform.OS === "android") {
    RNStatusBar.setTranslucent(true);
    RNStatusBar.setBackgroundColor("transparent");
  }
}
