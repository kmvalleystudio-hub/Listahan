import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Dimensions, PixelRatio, Text, TextInput } from "react-native";
import type { AppThemeColors } from "../theme/colors";
import { darkColors, lightColors } from "../theme/colors";
import {
  clampFontSizeLevel,
  COLOR_SCHEME_STORAGE_KEY,
  DEFAULT_FONT_SIZE_LEVEL,
  fontScaleForLevel,
  loadAppearancePreferences,
  persistFontSizeLevel,
  persistUseSystemFontSize,
} from "../theme/appearanceStorage";
import { setStyleSheetFontMultiplier } from "../theme/installStyleSheetScale";

/** Main app defaults to light until the user picks otherwise on Profile (`UsernameSetup` uses a fixed dark palette). */

export type ColorScheme = "light" | "dark";

type ThemeContextValue = {
  colors: AppThemeColors;
  scheme: ColorScheme;
  isDark: boolean;
  setScheme: (next: ColorScheme) => void;
  toggleScheme: () => void;
  fontSizeLevel: number;
  fontScale: number;
  useSystemFontSize: boolean;
  effectiveFontScale: number;
  setFontSizeLevel: (level: number) => void;
  setUseSystemFontSize: (enabled: boolean) => void;
  styleEpoch: number;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readSystemFontScale(): number {
  const raw = PixelRatio.getFontScale();
  return Math.min(1.25, Math.max(0.85, raw));
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [scheme, setSchemeState] = useState<ColorScheme>("light");
  const [fontSizeLevel, setFontSizeLevelState] = useState(DEFAULT_FONT_SIZE_LEVEL);
  const [useSystemFontSize, setUseSystemFontSizeState] = useState(false);
  const [styleEpoch, setStyleEpoch] = useState(0);
  const [dimensionsTick, setDimensionsTick] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  const fontScale = useMemo(() => fontScaleForLevel(fontSizeLevel), [fontSizeLevel]);

  useEffect(() => {
    let cancelled = false;
    void loadAppearancePreferences().then((prefs) => {
      if (cancelled) return;
      if (prefs.scheme) setSchemeState(prefs.scheme);
      setFontSizeLevelState(prefs.fontSizeLevel);
      setUseSystemFontSizeState(prefs.useSystemFontSize);
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const effectiveFontScale = useMemo(
    () => (useSystemFontSize ? readSystemFontScale() : fontScale),
    [fontScale, useSystemFontSize, dimensionsTick]
  );

  useEffect(() => {
    if (!hydrated) return;
    setStyleSheetFontMultiplier(effectiveFontScale);
    setStyleEpoch((n) => n + 1);
  }, [effectiveFontScale, hydrated]);

  useEffect(() => {
    const allowFontScaling = useSystemFontSize;
    const textDefaults = Text as typeof Text & { defaultProps?: { allowFontScaling?: boolean } };
    const inputDefaults = TextInput as typeof TextInput & { defaultProps?: { allowFontScaling?: boolean } };
    textDefaults.defaultProps = { ...(textDefaults.defaultProps ?? {}), allowFontScaling };
    inputDefaults.defaultProps = { ...(inputDefaults.defaultProps ?? {}), allowFontScaling };
  }, [useSystemFontSize]);

  useEffect(() => {
    if (!useSystemFontSize) return;
    const sub = Dimensions.addEventListener("change", () => {
      setDimensionsTick((n) => n + 1);
    });
    return () => sub.remove();
  }, [useSystemFontSize]);

  const setScheme = useCallback((next: ColorScheme) => {
    setSchemeState(next);
    void AsyncStorage.setItem(COLOR_SCHEME_STORAGE_KEY, next);
  }, []);

  const toggleScheme = useCallback(() => {
    setSchemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      void AsyncStorage.setItem(COLOR_SCHEME_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const setFontSizeLevel = useCallback((next: number) => {
    const clamped = clampFontSizeLevel(next);
    setFontSizeLevelState(clamped);
    void persistFontSizeLevel(clamped);
  }, []);

  const setUseSystemFontSize = useCallback((enabled: boolean) => {
    setUseSystemFontSizeState(enabled);
    void persistUseSystemFontSize(enabled);
  }, []);

  const colors = scheme === "dark" ? darkColors : lightColors;

  const value = useMemo(
    () => ({
      colors,
      scheme,
      isDark: scheme === "dark",
      setScheme,
      toggleScheme,
      fontSizeLevel,
      fontScale,
      useSystemFontSize,
      effectiveFontScale,
      setFontSizeLevel,
      setUseSystemFontSize,
      styleEpoch,
    }),
    [
      colors,
      scheme,
      setScheme,
      toggleScheme,
      fontSizeLevel,
      fontScale,
      useSystemFontSize,
      effectiveFontScale,
      setFontSizeLevel,
      setUseSystemFontSize,
      styleEpoch,
    ]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
