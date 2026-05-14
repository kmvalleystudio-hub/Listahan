import {
  type CustomNotifyUnit,
  type NotifyBeforeOption,
  type ReminderRecurrence,
  type SavedReminder,
  newReminderId,
} from "./remindersStorage";

export const REMINDER_SHARE_FORMAT_VERSION = 1 as const;
export const REMINDER_SHARE_KIND = "saycart-reminder" as const;

export type ReminderShareFileV1 = {
  formatVersion: typeof REMINDER_SHARE_FORMAT_VERSION;
  kind: typeof REMINDER_SHARE_KIND;
  exportedAt: string;
  reminder: {
    title: string;
    notes: string;
    fireAt: string;
    recurrence: ReminderRecurrence;
    notifyBefore: NotifyBeforeOption;
    customNotifyAmount: number | null;
    customNotifyUnit: CustomNotifyUnit | null;
  };
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

const RECURRENCE_VALUES = ["none", "hourly", "daily", "weekly", "monthly"] as const;
const NOTIFY_BEFORE_VALUES = ["on_time", "1h", "1d", "1w", "custom"] as const;
const CUSTOM_NOTIFY_UNITS = ["min", "h", "d"] as const;

function isRecurrence(x: unknown): x is ReminderRecurrence {
  return typeof x === "string" && (RECURRENCE_VALUES as readonly string[]).includes(x);
}

function isNotifyBefore(x: unknown): x is NotifyBeforeOption {
  return typeof x === "string" && (NOTIFY_BEFORE_VALUES as readonly string[]).includes(x);
}

function isCustomNotifyUnit(x: unknown): x is CustomNotifyUnit {
  return typeof x === "string" && (CUSTOM_NOTIFY_UNITS as readonly string[]).includes(x);
}

export function buildReminderShareFileFromReminder(r: SavedReminder, exportedAtIso: string): ReminderShareFileV1 {
  return {
    formatVersion: REMINDER_SHARE_FORMAT_VERSION,
    kind: REMINDER_SHARE_KIND,
    exportedAt: exportedAtIso,
    reminder: {
      title: r.title.trim() || "Reminder",
      notes: String(r.notes ?? ""),
      fireAt: r.fireAt,
      recurrence: r.recurrence,
      notifyBefore: r.notifyBefore,
      customNotifyAmount: r.customNotifyAmount,
      customNotifyUnit: r.customNotifyUnit,
    },
  };
}

export function parseReminderSharePayload(raw: unknown): ReminderShareFileV1 | null {
  if (!isRecord(raw)) return null;
  if (raw.formatVersion !== REMINDER_SHARE_FORMAT_VERSION) return null;
  if (raw.kind !== REMINDER_SHARE_KIND) return null;
  if (typeof raw.exportedAt !== "string") return null;
  const rem = raw.reminder;
  if (!isRecord(rem)) return null;
  const title = typeof rem.title === "string" ? rem.title.trim() : "";
  const notes = typeof rem.notes === "string" ? rem.notes : "";
  const fireAt = typeof rem.fireAt === "string" ? rem.fireAt : new Date().toISOString();
  const recurrence: ReminderRecurrence = isRecurrence(rem.recurrence) ? rem.recurrence : "none";
  const notifyBefore: NotifyBeforeOption = isNotifyBefore(rem.notifyBefore) ? rem.notifyBefore : "on_time";
  let customNotifyAmount: number | null = null;
  let customNotifyUnit: CustomNotifyUnit | null = null;
  if (typeof rem.customNotifyAmount === "number" && Number.isFinite(rem.customNotifyAmount)) {
    customNotifyAmount = Math.round(rem.customNotifyAmount);
  }
  if (isCustomNotifyUnit(rem.customNotifyUnit)) {
    customNotifyUnit = rem.customNotifyUnit;
  }
  if (notifyBefore === "custom" && (customNotifyAmount == null || customNotifyUnit == null)) {
    customNotifyAmount = 30;
    customNotifyUnit = "min";
  }
  return {
    formatVersion: REMINDER_SHARE_FORMAT_VERSION,
    kind: REMINDER_SHARE_KIND,
    exportedAt: raw.exportedAt,
    reminder: {
      title: title || "Reminder",
      notes,
      fireAt,
      recurrence,
      notifyBefore,
      customNotifyAmount,
      customNotifyUnit,
    },
  };
}

/** New reminder row (no notification ids); caller schedules + upserts. */
export function savedReminderFromSharePayload(parsed: ReminderShareFileV1): SavedReminder {
  const r = parsed.reminder;
  const now = new Date().toISOString();
  return {
    id: newReminderId(),
    title: r.title,
    notes: r.notes,
    fireAt: r.fireAt,
    recurrence: r.recurrence,
    notifyBefore: r.recurrence === "none" ? r.notifyBefore : "on_time",
    customNotifyAmount: r.recurrence === "none" && r.notifyBefore === "custom" ? r.customNotifyAmount : null,
    customNotifyUnit: r.recurrence === "none" && r.notifyBefore === "custom" ? r.customNotifyUnit : null,
    notificationId: null,
    earlyNotificationId: null,
    updatedAt: now,
    importedFromShare: true,
  };
}
