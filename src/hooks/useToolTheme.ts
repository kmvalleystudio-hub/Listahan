import { useMemo } from "react";
import type { ToolId } from "../constants/toolsCatalog";
import { useTheme } from "../context/ThemeContext";
import type { AppThemeColors } from "../theme/colors";
import { darkColors } from "../theme/colors";
import { applyToolTheme } from "../theme/toolTheme";

const VAULT_TOOL_ID = "private_list" as const;

/** Vault always uses the dark palette, independent of Profile appearance. */
export function getVaultColors(): AppThemeColors {
  return applyToolTheme(darkColors, VAULT_TOOL_ID);
}

export function useVaultTheme() {
  const t = useTheme();
  const colors = useMemo(() => getVaultColors(), [t.styleEpoch]);
  return useMemo(() => ({ ...t, colors, isDark: true as const }), [t, colors]);
}

export function useToolTheme(toolId: ToolId) {
  const t = useTheme();
  const colors = useMemo(() => applyToolTheme(t.colors, toolId), [t.colors, toolId]);
  return useMemo(() => ({ ...t, colors }), [t, colors]);
}

/** StyleSheet factory using per-tool accent colors (not the global grocery palette). */
export function useToolStyles<T>(
  toolId: ToolId,
  factory: (colors: AppThemeColors) => T,
  extraDeps: readonly unknown[] = []
): T {
  const { colors, styleEpoch } = useToolTheme(toolId);
  return useMemo(
    () => factory(colors),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [colors, styleEpoch, toolId, factory, ...extraDeps]
  );
}

export function useToolStylesWithArgs<T, D extends readonly unknown[]>(
  toolId: ToolId,
  factory: (colors: AppThemeColors, ...deps: D) => T,
  ...deps: D
): T {
  const { colors, styleEpoch } = useToolTheme(toolId);
  return useMemo(
    () => factory(colors, ...deps),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [colors, styleEpoch, toolId, factory, ...deps]
  );
}

export function useVaultStyles<T>(
  factory: (colors: AppThemeColors) => T,
  extraDeps: readonly unknown[] = []
): T {
  const { colors, styleEpoch } = useVaultTheme();
  return useMemo(
    () => factory(colors),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [colors, styleEpoch, factory, ...extraDeps]
  );
}

export function useVaultStylesWithArgs<T, D extends readonly unknown[]>(
  factory: (colors: AppThemeColors, ...deps: D) => T,
  ...deps: D
): T {
  const { colors, styleEpoch } = useVaultTheme();
  return useMemo(
    () => factory(colors, ...deps),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [colors, styleEpoch, factory, ...deps]
  );
}
