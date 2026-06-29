import { useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "../context/ThemeContext";
import { syncStatusBarForRoute } from "../utils/syncStatusBarForRoute";
import type { RootStackParamList } from "../navigation/types";

/** Re-apply status bar style whenever a screen gains focus (fixes first-visit light icons on light bg). */
export function useStatusBarOnFocus(routeName: keyof RootStackParamList): void {
  const { isDark } = useTheme();

  useFocusEffect(
    useCallback(() => {
      syncStatusBarForRoute(routeName, isDark);
    }, [routeName, isDark])
  );
}
