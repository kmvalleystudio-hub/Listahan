import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { AppThemeColors } from "../theme/colors";
import { darkColors, lightColors } from "../theme/colors";

const STORAGE_KEY = "@saycart/color_scheme_v1";

/** Main app defaults to light until the user picks otherwise in Settings (`UsernameSetup` uses a fixed dark palette). */

export type ColorScheme = "light" | "dark";

type ThemeContextValue = {
  colors: AppThemeColors;
  scheme: ColorScheme;
  isDark: boolean;
  setScheme: (next: ColorScheme) => void;
  toggleScheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [scheme, setSchemeState] = useState<ColorScheme>("light");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && (raw === "dark" || raw === "light")) {
          setSchemeState(raw);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setScheme = useCallback((next: ColorScheme) => {
    setSchemeState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const toggleScheme = useCallback(() => {
    setSchemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      void AsyncStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const colors = scheme === "dark" ? darkColors : lightColors;

  const value = useMemo(
    () => ({
      colors,
      scheme,
      isDark: scheme === "dark",
      setScheme,
      toggleScheme,
    }),
    [colors, scheme, setScheme, toggleScheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
