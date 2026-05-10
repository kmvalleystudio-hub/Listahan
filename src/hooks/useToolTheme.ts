import { useMemo } from "react";
import type { ToolId } from "../constants/toolsCatalog";
import { useTheme } from "../context/ThemeContext";
import { applyToolTheme } from "../theme/toolTheme";

export function useToolTheme(toolId: ToolId) {
  const t = useTheme();
  const colors = useMemo(() => applyToolTheme(t.colors, toolId), [t.colors, toolId]);
  return useMemo(() => ({ ...t, colors }), [t, colors]);
}
