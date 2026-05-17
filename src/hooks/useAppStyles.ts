import { useMemo } from "react";
import { useTheme } from "../context/ThemeContext";
import type { AppThemeColors } from "../theme/colors";

export function useAppStyles<T>(
  factory: (colors: AppThemeColors) => T,
  extraDeps: readonly unknown[] = []
): T {
  const { colors, styleEpoch } = useTheme();
  return useMemo(
    () => factory(colors),
    // styleEpoch bumps when font scale changes so StyleSheet.create runs again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [colors, styleEpoch, factory, ...extraDeps]
  );
}

export function useAppStylesWithArgs<T, D extends readonly unknown[]>(
  factory: (colors: AppThemeColors, ...deps: D) => T,
  ...deps: D
): T {
  const { colors, styleEpoch } = useTheme();
  return useMemo(
    () => factory(colors, ...deps),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [colors, styleEpoch, factory, ...deps]
  );
}
