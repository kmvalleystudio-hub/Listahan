/**
 * Master registry of SayCart suite tools — roadmap, copy, and navigation ids.
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
    dashboardIconFg: "#E5E7EB",
    dashboardIconBg: "#374151",
    status: "live",
    roadmapNotes: [],
  },
  {
    id: "reminder",
    title: "Reminder",
    tagline: "Nudges at the right time",
    description: "Nudges at the right time",
    icon: "alarm",
    dashboardIconFg: "#5B21B6",
    dashboardIconBg: "#EDE9FE",
    status: "coming_soon",
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
