/**
 * Master registry of Listahan suite tools — roadmap, copy, and navigation ids.
 */

export type ToolId = "grocery" | "todo" | "private_list" | "reminder" | "notes";

export type ToolStatus = "live" | "coming_soon";

export type ToolDefinition = {
  id: ToolId;
  title: string;
  tagline: string;
  description: string;
  icon: string;
  dashboardIconFg: string;
  dashboardIconBg: string;
  status: ToolStatus;
  roadmapNotes: string[];
};

export const TOOLS_CATALOG: ToolDefinition[] = [
  {
    id: "grocery",
    title: "Grocery",
    tagline: "Groceries, prices, voice & scan",
    description: "Groceries, prices, voice & scan",
    icon: "cart",
    dashboardIconFg: "#5F6F22",
    dashboardIconBg: "#E4EAC4",
    status: "live",
    roadmapNotes: [],
  },
  {
    id: "todo",
    title: "To-do",
    tagline: "Simple tasks, timers, chimes",
    description: "Simple tasks, timers, chimes",
    icon: "checkmark-circle",
    dashboardIconFg: "#0F766E",
    dashboardIconBg: "#D0F7F2",
    status: "live",
    roadmapNotes: [],
  },
  {
    id: "private_list",
    title: "Vault",
    tagline: "Passwords & secure notes",
    description: "Passwords, PINs, and sensitive lines — no check-off flow",
    icon: "lock-closed",
    dashboardIconFg: "#475569",
    dashboardIconBg: "#E8EDF5",
    status: "live",
    roadmapNotes: [],
  },
  {
    id: "reminder",
    title: "Reminder",
    tagline: "Nudges at the right time",
    description: "Nudges at the right time",
    icon: "alarm",
    dashboardIconFg: "#8B5CF6",
    dashboardIconBg: "#F5F3FF",
    status: "live",
    roadmapNotes: [],
  },
  {
    id: "notes",
    title: "Notes",
    tagline: "Quick capture",
    description: "Quick capture",
    icon: "document-text",
    dashboardIconFg: "#A16207",
    dashboardIconBg: "#FEF3C7",
    status: "live",
    roadmapNotes: [],
  },
];
