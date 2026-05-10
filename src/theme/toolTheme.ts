import type { ToolId } from "../constants/toolsCatalog";
import { TOOLS_CATALOG } from "../constants/toolsCatalog";
import type { AppThemeColors } from "./colors";

function catalogEntry(id: ToolId) {
  return TOOLS_CATALOG.find((t) => t.id === id);
}

export function rgbaFromHex(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return `rgba(15,23,42,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Accent overrides derived from dashboard icon pairs — buttons, links, totals, bulk mic ring. */
const TOOL_PATCH: Record<
  ToolId,
  Pick<
    AppThemeColors,
    | "primary"
    | "primaryDark"
    | "linkBlue"
    | "micIcon"
    | "totalBg"
    | "totalBorder"
    | "totalLabel"
    | "totalValue"
    | "bulkMicBg"
    | "bulkMicBorder"
    | "bulkMicActiveBorder"
    | "currencyActiveRow"
    | "accentBlueSoft"
    | "accentBlueBorder"
    | "switchTrackOn"
    | "switchThumbOn"
    | "saveGreen"
    | "success"
    | "iconBlobBg"
    | "iconBlobFg"
  >
> = {
  grocery: {
    primary: "#BAC67A",
    primaryDark: "#5F6F22",
    linkBlue: "#5F6F22",
    micIcon: "#C2410C",
    totalBg: "rgba(95, 111, 34, 0.12)",
    totalBorder: rgbaFromHex("#5F6F22", 0.35),
    totalLabel: "#5F6F22",
    totalValue: "#3F4A18",
    bulkMicBg: "rgba(186, 198, 122, 0.22)",
    bulkMicBorder: rgbaFromHex("#5F6F22", 0.55),
    bulkMicActiveBorder: rgbaFromHex("#C2410C", 0.55),
    currencyActiveRow: "rgba(95, 111, 34, 0.12)",
    accentBlueSoft: "rgba(95, 111, 34, 0.1)",
    accentBlueBorder: rgbaFromHex("#5F6F22", 0.28),
    switchTrackOn: "rgba(95, 111, 34, 0.45)",
    switchThumbOn: "#5F6F22",
    saveGreen: "#5F6F22",
    success: "#5F6F22",
    iconBlobBg: "#E4EAC4",
    iconBlobFg: "#5F6F22",
  },
  todo: {
    primary: "#14B8A6",
    primaryDark: "#0F766E",
    linkBlue: "#0F766E",
    micIcon: "#0F766E",
    totalBg: "rgba(15, 118, 110, 0.12)",
    totalBorder: rgbaFromHex("#0F766E", 0.35),
    totalLabel: "#0F766E",
    totalValue: "#0B4F4A",
    bulkMicBg: "rgba(20, 184, 166, 0.18)",
    bulkMicBorder: rgbaFromHex("#0F766E", 0.5),
    bulkMicActiveBorder: rgbaFromHex("#0F766E", 0.65),
    currencyActiveRow: "rgba(15, 118, 110, 0.12)",
    accentBlueSoft: "rgba(15, 118, 110, 0.1)",
    accentBlueBorder: rgbaFromHex("#0F766E", 0.28),
    switchTrackOn: "rgba(15, 118, 110, 0.45)",
    switchThumbOn: "#0F766E",
    saveGreen: "#0F766E",
    success: "#0F766E",
    iconBlobBg: "#D0F7F2",
    iconBlobFg: "#0F766E",
  },
  private_list: {
    primary: "#FB923C",
    primaryDark: "#C2410C",
    linkBlue: "#C2410C",
    micIcon: "#C2410C",
    totalBg: "rgba(194, 65, 12, 0.12)",
    totalBorder: rgbaFromHex("#C2410C", 0.35),
    totalLabel: "#C2410C",
    totalValue: "#7C2D12",
    bulkMicBg: "rgba(251, 146, 60, 0.2)",
    bulkMicBorder: rgbaFromHex("#C2410C", 0.5),
    bulkMicActiveBorder: rgbaFromHex("#EA580C", 0.55),
    currencyActiveRow: "rgba(194, 65, 12, 0.12)",
    accentBlueSoft: "rgba(194, 65, 12, 0.1)",
    accentBlueBorder: rgbaFromHex("#C2410C", 0.28),
    switchTrackOn: "rgba(194, 65, 12, 0.45)",
    switchThumbOn: "#C2410C",
    saveGreen: "#C2410C",
    success: "#EA580C",
    iconBlobBg: "#FFE7D4",
    iconBlobFg: "#C2410C",
  },
  reminder: {
    primary: "#A78BFA",
    primaryDark: "#5B21B6",
    linkBlue: "#5B21B6",
    micIcon: "#5B21B6",
    totalBg: "rgba(91, 33, 182, 0.12)",
    totalBorder: rgbaFromHex("#5B21B6", 0.35),
    totalLabel: "#5B21B6",
    totalValue: "#3B0764",
    bulkMicBg: "rgba(167, 139, 250, 0.2)",
    bulkMicBorder: rgbaFromHex("#5B21B6", 0.5),
    bulkMicActiveBorder: rgbaFromHex("#7C3AED", 0.55),
    currencyActiveRow: "rgba(91, 33, 182, 0.12)",
    accentBlueSoft: "rgba(91, 33, 182, 0.1)",
    accentBlueBorder: rgbaFromHex("#5B21B6", 0.28),
    switchTrackOn: "rgba(91, 33, 182, 0.45)",
    switchThumbOn: "#5B21B6",
    saveGreen: "#5B21B6",
    success: "#7C3AED",
    iconBlobBg: "#EDE9FE",
    iconBlobFg: "#5B21B6",
  },
  notes: {
    primary: "#EAB308",
    primaryDark: "#A16207",
    linkBlue: "#A16207",
    micIcon: "#A16207",
    totalBg: "rgba(161, 98, 7, 0.12)",
    totalBorder: rgbaFromHex("#A16207", 0.35),
    totalLabel: "#A16207",
    totalValue: "#713F12",
    bulkMicBg: "rgba(234, 179, 8, 0.2)",
    bulkMicBorder: rgbaFromHex("#A16207", 0.5),
    bulkMicActiveBorder: rgbaFromHex("#CA8A04", 0.55),
    currencyActiveRow: "rgba(161, 98, 7, 0.12)",
    accentBlueSoft: "rgba(161, 98, 7, 0.1)",
    accentBlueBorder: rgbaFromHex("#A16207", 0.28),
    switchTrackOn: "rgba(161, 98, 7, 0.45)",
    switchThumbOn: "#A16207",
    saveGreen: "#A16207",
    success: "#CA8A04",
    iconBlobBg: "#FEF3C7",
    iconBlobFg: "#A16207",
  },
};

export function applyToolTheme(base: AppThemeColors, toolId: ToolId): AppThemeColors {
  if (!catalogEntry(toolId)) return base;
  const patch = TOOL_PATCH[toolId];
  return { ...base, ...patch };
}
