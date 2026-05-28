import AsyncStorage from "@react-native-async-storage/async-storage";
import { notifyRemindersLocalChange } from "./syncLocalChangeNotify";

const STORAGE_KEY = "@saycart/reminders_v1";

export const RECURRENCE_VALUES = ["none", "hourly", "daily", "weekly", "monthly"] as const;
export type ReminderRecurrence = (typeof RECURRENCE_VALUES)[number];

export const NOTIFY_BEFORE_VALUES = ["on_time", "1h", "1d", "1w", "custom"] as const;
export type NotifyBeforeOption = (typeof NOTIFY_BEFORE_VALUES)[number];

export const CUSTOM_NOTIFY_UNITS = ["min", "h", "d"] as const;
export type CustomNotifyUnit = (typeof CUSTOM_NOTIFY_UNITS)[number];

export type SavedReminder = {
  id: string;
  title: string;
  notes: string;
  /** ISO — anchor date/time for the reminder (event time). */
  fireAt: string;
  recurrence: ReminderRecurrence;
  /** Early nudge only applies when `recurrence` is `none` (repeating uses on-time each cycle). */
  notifyBefore: NotifyBeforeOption;
  /** When `notifyBefore` is `custom`: amount in `customNotifyUnit` (e.g. 30 + min = 30 minutes before). */
  customNotifyAmount: number | null;
  customNotifyUnit: CustomNotifyUnit | null;
  /** expo-notifications id for the on-time (at event) alert, or the only alert when no early nudge */
  notificationId: string | null;
  /** When an early nudge is used: second scheduled id for the lead-in alert */
  earlyNotificationId: string | null;
  updatedAt: string;
  importedFromShare?: boolean;
  deletedAt?: string;
};

function newId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export { newId as newReminderId };

function isRecurrence(x: unknown): x is ReminderRecurrence {
  return typeof x === "string" && (RECURRENCE_VALUES as readonly string[]).includes(x);
}

function isNotifyBefore(x: unknown): x is NotifyBeforeOption {
  return typeof x === "string" && (NOTIFY_BEFORE_VALUES as readonly string[]).includes(x);
}

/** Repeating reminders always use on-time delivery (OS repeating triggers have no early offset). */
export function effectiveNotifyBefore(r: Pick<SavedReminder, "recurrence" | "notifyBefore">): NotifyBeforeOption {
  return r.recurrence === "none" ? r.notifyBefore : "on_time";
}

function isCustomNotifyUnit(x: unknown): x is CustomNotifyUnit {
  return typeof x === "string" && (CUSTOM_NOTIFY_UNITS as readonly string[]).includes(x);
}

/** Converts custom amount+unit to total minutes before the event. */
export function customNotifyToMinutes(r: Pick<SavedReminder, "customNotifyAmount" | "customNotifyUnit">): number {
  const amt = r.customNotifyAmount != null && Number.isFinite(r.customNotifyAmount) ? Math.max(1, Math.round(r.customNotifyAmount)) : 30;
  const unit: CustomNotifyUnit = r.customNotifyUnit ?? "min";
  switch (unit) {
    case "min":
      return Math.min(amt, 60 * 24 * 365);
    case "h":
      return Math.min(amt * 60, 60 * 24 * 365);
    case "d":
      return Math.min(amt * 24 * 60, 60 * 24 * 365);
    default:
      return 30;
  }
}

export function minutesBeforeNotifyFor(r: SavedReminder): number {
  const n = effectiveNotifyBefore(r);
  switch (n) {
    case "on_time":
      return 0;
    case "1h":
      return 60;
    case "1d":
      return 24 * 60;
    case "1w":
      return 7 * 24 * 60;
    case "custom":
      return customNotifyToMinutes(r);
    default:
      return 0;
  }
}

export function computeDeliverMs(r: SavedReminder): number {
  const eventMs = new Date(r.fireAt).getTime();
  return eventMs - minutesBeforeNotifyFor(r) * 60 * 1000;
}

export function canUseNotify1d(eventMs: number): boolean {
  return eventMs - Date.now() >= 2 * 24 * 60 * 60 * 1000;
}

export function canUseNotify1w(eventMs: number): boolean {
  return eventMs - Date.now() >= 8 * 24 * 60 * 60 * 1000;
}

export function recurrenceLabel(r: ReminderRecurrence): string {
  switch (r) {
    case "none":
      return "Once";
    case "hourly":
      return "Hourly";
    case "daily":
      return "Daily";
    case "weekly":
      return "Weekly";
    case "monthly":
      return "Monthly";
    default:
      return "";
  }
}

/** Human fragment for early nudge title, e.g. "in 1 hour" (no leading dash). */
export function relativeLeadInFragment(
  r: Pick<SavedReminder, "notifyBefore" | "recurrence" | "customNotifyAmount" | "customNotifyUnit">
): string {
  if (r.recurrence !== "none" || r.notifyBefore === "on_time") return "";
  switch (r.notifyBefore) {
    case "1h":
      return "in 1 hour";
    case "1d":
      return "in 1 day";
    case "1w":
      return "in 1 week";
    case "custom": {
      if (r.customNotifyAmount == null || !r.customNotifyUnit) return "";
      const a = r.customNotifyAmount;
      if (r.customNotifyUnit === "min") return a === 1 ? "in 1 minute" : `in ${a} minutes`;
      if (r.customNotifyUnit === "h") return a === 1 ? "in 1 hour" : `in ${a} hours`;
      return a === 1 ? "in 1 day" : `in ${a} days`;
    }
    default:
      return "";
  }
}

export function earlyNotificationTitle(r: SavedReminder): string {
  const base = (r.title || "Reminder").trim() || "Reminder";
  const frag = relativeLeadInFragment(r);
  return frag ? `${base} - ${frag}` : base;
}

export function eventTimeBodyLine(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `Event: ${d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

export function notifyBeforeLabel(n: NotifyBeforeOption, r?: Pick<SavedReminder, "customNotifyAmount" | "customNotifyUnit">): string {
  switch (n) {
    case "on_time":
      return "On time";
    case "1h":
      return "1h before";
    case "1d":
      return "1 day before";
    case "1w":
      return "1 week before";
    case "custom": {
      if (r?.customNotifyAmount != null && r.customNotifyUnit) {
        const a = r.customNotifyAmount;
        if (r.customNotifyUnit === "min") return `${a} min before`;
        if (r.customNotifyUnit === "h") return `${a} hr${a === 1 ? "" : "s"} before`;
        return `${a} day${a === 1 ? "" : "s"} before`;
      }
      return "Custom before";
    }
    default:
      return "";
  }
}

function parseReminders(raw: unknown): SavedReminder[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedReminder[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.title !== "string") continue;
    const notes = typeof o.notes === "string" ? o.notes : "";
    const fireAt = typeof o.fireAt === "string" ? o.fireAt : new Date().toISOString();
    const recurrence: ReminderRecurrence = isRecurrence(o.recurrence) ? o.recurrence : "none";
    const notifyBefore: NotifyBeforeOption = isNotifyBefore(o.notifyBefore) ? o.notifyBefore : "on_time";
    const legacyMin =
      typeof o.customNotifyBeforeMinutes === "number" && Number.isFinite(o.customNotifyBeforeMinutes)
        ? Math.round(o.customNotifyBeforeMinutes)
        : null;
    let customNotifyAmount: number | null = null;
    let customNotifyUnit: CustomNotifyUnit | null = null;
    if (typeof o.customNotifyAmount === "number" && Number.isFinite(o.customNotifyAmount) && isCustomNotifyUnit(o.customNotifyUnit)) {
      customNotifyAmount = Math.round(o.customNotifyAmount);
      customNotifyUnit = o.customNotifyUnit;
    } else if (notifyBefore === "custom" && legacyMin != null) {
      customNotifyAmount = legacyMin;
      customNotifyUnit = "min";
    }
    if (notifyBefore === "custom" && (customNotifyAmount == null || customNotifyUnit == null)) {
      customNotifyAmount = 30;
      customNotifyUnit = "min";
    }
    const notificationId =
      o.notificationId === null || typeof o.notificationId === "string" ? o.notificationId : null;
    const earlyNotificationId =
      o.earlyNotificationId === null || typeof o.earlyNotificationId === "string" ? o.earlyNotificationId : null;
    const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : new Date().toISOString();
    const deletedAt = typeof o.deletedAt === "string" ? o.deletedAt : undefined;
    out.push({
      id: o.id,
      title: o.title,
      notes,
      fireAt,
      recurrence,
      notifyBefore,
      customNotifyAmount,
      customNotifyUnit,
      notificationId,
      earlyNotificationId,
      updatedAt,
      importedFromShare: o.importedFromShare === true,
      deletedAt,
    });
  }
  return out;
}

/** One-off reminders whose event time has passed. */
export function isPastOneShot(r: SavedReminder): boolean {
  if (r.recurrence !== "none") return false;
  return new Date(r.fireAt).getTime() < Date.now();
}

/** Upcoming soonest first, then past (most recent first). */
export function sortRemindersForDisplay(reminders: SavedReminder[]): SavedReminder[] {
  const now = Date.now();
  const upcoming = reminders
    .filter((r) => {
      if (r.recurrence !== "none") return true;
      return new Date(r.fireAt).getTime() >= now;
    })
    .sort((a, b) => {
      const key = (r: SavedReminder): number => {
        if (r.recurrence !== "none") return new Date(r.fireAt).getTime();
        const eventMs = new Date(r.fireAt).getTime();
        const deliverMs = computeDeliverMs(r);
        if (deliverMs >= now) return deliverMs;
        return eventMs;
      };
      return key(a) - key(b);
    });
  const upIds = new Set(upcoming.map((x) => x.id));
  const past = reminders
    .filter((r) => !upIds.has(r.id))
    .sort((a, b) => new Date(b.fireAt).getTime() - new Date(a.fireAt).getTime());
  return [...upcoming, ...past];
}

export async function loadRemindersRaw(): Promise<SavedReminder[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return parseReminders(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

export async function loadReminders(): Promise<SavedReminder[]> {
  const all = await loadRemindersRaw();
  return sortRemindersForDisplay(all.filter((r) => !r.deletedAt));
}

export async function saveReminders(reminders: SavedReminder[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
  notifyRemindersLocalChange();
}

export async function upsertReminder(reminder: SavedReminder): Promise<SavedReminder[]> {
  const all = await loadRemindersRaw();
  const i = all.findIndex((n) => n.id === reminder.id);
  const next = i >= 0 ? all.map((x, j) => (j === i ? reminder : x)) : [reminder, ...all];
  const sorted = sortRemindersForDisplay(next);
  await saveReminders(sorted);
  return sorted;
}

export async function deleteReminder(id: string): Promise<SavedReminder[]> {
  const all = await loadRemindersRaw();
  const at = new Date().toISOString();
  const next = all.map((n) => (n.id === id ? { ...n, deletedAt: at, updatedAt: at } : n));
  await saveReminders(next);
  return sortRemindersForDisplay(next.filter((n) => !n.deletedAt));
}
