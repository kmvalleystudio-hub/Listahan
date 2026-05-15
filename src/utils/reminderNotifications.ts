import { Platform, Vibration } from "react-native";
import * as Notifications from "expo-notifications";
import type { NotificationTriggerInput } from "expo-notifications";
import {
  computeDeliverMs,
  earlyNotificationTitle,
  effectiveNotifyBefore,
  eventTimeBodyLine,
  loadRemindersRaw,
  saveReminders,
  sortRemindersForDisplay,
  type SavedReminder,
} from "./remindersStorage";
import { APP_DISPLAY_NAME } from "../constants/appBranding";

/** Bump when channel behavior changes so Android picks up new audio/importance. */
export const REMINDER_ANDROID_CHANNEL_ID = "saycart_reminders_v4";

export type ScheduleReminderIds = {
  earlyNotificationId: string | null;
  notificationId: string | null;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureReminderAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(REMINDER_ANDROID_CHANNEL_ID, {
    name: "Reminders",
    description: `Time-based nudges from ${APP_DISPLAY_NAME}`,
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 280, 160, 280, 160, 400],
    enableVibrate: true,
    lightColor: "#5B21B6",
    sound: "default",
    audioAttributes: {
      usage: Notifications.AndroidAudioUsage.ALARM,
      contentType: Notifications.AndroidAudioContentType.SONIFICATION,
      flags: {
        enforceAudibility: true,
        requestHardwareAudioVideoSynchronization: false,
      },
    },
  });
}

export async function requestReminderNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function cancelScheduledReminderNotification(notificationId: string | null): Promise<void> {
  if (!notificationId || Platform.OS === "web") return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // stale id
  }
}

export async function cancelReminderScheduleIds(r: Pick<SavedReminder, "earlyNotificationId" | "notificationId">): Promise<void> {
  await cancelScheduledReminderNotification(r.earlyNotificationId ?? null);
  await cancelScheduledReminderNotification(r.notificationId ?? null);
}

function androidChannelId(): string | undefined {
  return Platform.OS === "android" ? REMINDER_ANDROID_CHANNEL_ID : undefined;
}

/** Expo weekly: 1 = Sunday … 7 = Saturday (not ISO). */
function expoWeekdayFromDate(d: Date): number {
  const js = d.getDay();
  return js === 0 ? 1 : js + 1;
}

function buildTrigger(r: SavedReminder): NotificationTriggerInput | null {
  const ch = androidChannelId();
  const event = new Date(r.fireAt);
  const rec = r.recurrence;

  if (rec === "none") {
    const deliver = new Date(computeDeliverMs(r));
    if (deliver.getTime() <= Date.now() + 10_000) return null;
    return {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: deliver,
      channelId: ch,
    };
  }

  const hour = event.getHours();
  const minute = event.getMinutes();
  const dayOfMonth = event.getDate();

  switch (rec) {
    case "hourly":
      return {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 3600,
        repeats: true,
        channelId: ch,
      };
    case "daily":
      return {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId: ch,
      };
    case "weekly":
      return {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: expoWeekdayFromDate(event),
        hour,
        minute,
        channelId: ch,
      };
    case "monthly":
      return {
        type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
        day: dayOfMonth,
        hour,
        minute,
        channelId: ch,
      };
    default:
      return null;
  }
}

function androidContentExtras() {
  return Platform.OS === "android"
    ? {
        vibrate: [0, 280, 160, 280, 160, 400],
        priority: Notifications.AndroidNotificationPriority.MAX,
      }
    : {};
}

async function scheduleDateNotification(params: {
  title: string;
  body: string | undefined;
  date: Date;
  reminderId: string;
  slot: "early" | "onTime";
}): Promise<string | null> {
  if (Platform.OS === "web") return null;
  if (params.date.getTime() <= Date.now() + 10_000) return null;
  const iosExtras = Platform.OS === "ios" ? { interruptionLevel: "timeSensitive" as const } : {};
  return Notifications.scheduleNotificationAsync({
    content: {
      title: params.title,
      body: params.body,
      sound: true,
      data: { reminderId: params.reminderId, slot: params.slot },
      ...androidContentExtras(),
      ...iosExtras,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: params.date,
      channelId: androidChannelId(),
    },
  });
}

export async function scheduleReminderNotification(r: SavedReminder): Promise<ScheduleReminderIds> {
  const empty: ScheduleReminderIds = { earlyNotificationId: null, notificationId: null };
  if (Platform.OS === "web") return empty;
  await ensureReminderAndroidChannel();

  const dualEarly =
    r.recurrence === "none" && effectiveNotifyBefore(r) !== "on_time";

  if (dualEarly) {
    const eventDate = new Date(r.fireAt);
    const earlyDate = new Date(computeDeliverMs(r));
    const eventMs = eventDate.getTime();
    const earlyMs = earlyDate.getTime();

    let earlyId: string | null = null;
    if (earlyMs < eventMs - 5000 && earlyMs > Date.now() + 10_000) {
      earlyId = await scheduleDateNotification({
        title: earlyNotificationTitle(r),
        body: eventTimeBodyLine(r.fireAt) || r.notes.trim() || undefined,
        date: earlyDate,
        reminderId: r.id,
        slot: "early",
      });
    }

    let mainId: string | null = null;
    if (eventMs > Date.now() + 10_000) {
      mainId = await scheduleDateNotification({
        title: r.title.trim() || "Reminder",
        body: r.notes.trim() || undefined,
        date: eventDate,
        reminderId: r.id,
        slot: "onTime",
      });
    }

    return { earlyNotificationId: earlyId, notificationId: mainId };
  }

  const trigger = buildTrigger(r);
  if (trigger == null) return empty;

  const iosExtras = Platform.OS === "ios" ? { interruptionLevel: "timeSensitive" as const } : {};

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: r.title.trim() || "Reminder",
      body: r.notes.trim() || undefined,
      sound: true,
      data: { reminderId: r.id, slot: "onTime" as const },
      ...androidContentExtras(),
      ...iosExtras,
    },
    trigger,
  });
  return { earlyNotificationId: null, notificationId: id };
}

/**
 * Re-attach OS alarms when the system dropped them (common on some OEM battery savers) or when
 * permission was granted after an "in-app only" save.
 */
export async function reconcileScheduledReminders(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  await ensureReminderAndroidChannel();
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") return false;

  let scheduled: Awaited<ReturnType<typeof Notifications.getAllScheduledNotificationsAsync>>;
  try {
    scheduled = await Notifications.getAllScheduledNotificationsAsync();
  } catch {
    return false;
  }
  const scheduledIds = new Set(scheduled.map((x) => x.identifier));

  const raw = await loadRemindersRaw();
  const out: SavedReminder[] = [];
  let changed = false;

  for (const r of raw) {
    const eventMs = new Date(r.fireAt).getTime();
    const skipOneShotPast = r.recurrence === "none" && eventMs <= Date.now() + 15_000;
    if (skipOneShotPast) {
      out.push(r);
      continue;
    }

    const dual = r.recurrence === "none" && effectiveNotifyBefore(r) !== "on_time";
    const earlyMs = computeDeliverMs(r);
    const needEarly = dual && earlyMs < eventMs - 5000 && earlyMs > Date.now() + 10_000;
    const needMain = eventMs > Date.now() + 10_000;

    const earlyOk = !needEarly || (r.earlyNotificationId != null && scheduledIds.has(r.earlyNotificationId));
    const mainOk = !needMain || (r.notificationId != null && scheduledIds.has(r.notificationId));

    if (earlyOk && mainOk) {
      out.push(r);
      continue;
    }

    await cancelReminderScheduleIds(r);
    const ids = await scheduleReminderNotification(r);
    changed = true;
    out.push({
      ...r,
      earlyNotificationId: ids.earlyNotificationId,
      notificationId: ids.notificationId,
      updatedAt: new Date().toISOString(),
    });
  }

  if (changed) {
    await saveReminders(sortRemindersForDisplay(out));
  }
  return changed;
}

/** Extra buzz when a reminder fires while the app is foregrounded (DND still blocks OS sound sometimes). */
export function registerForegroundReminderFeedback(): () => void {
  if (Platform.OS === "web") return () => {};
  const sub = Notifications.addNotificationReceivedListener((event) => {
    const data = event.request.content.data as { reminderId?: string } | undefined;
    if (data?.reminderId) {
      if (Platform.OS === "android") {
        Vibration.vibrate([0, 260, 140, 260, 140, 400]);
      } else {
        Vibration.vibrate();
      }
    }
  });
  return () => sub.remove();
}
