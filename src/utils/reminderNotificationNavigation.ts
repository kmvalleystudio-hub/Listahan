import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import type { NotificationResponse } from "expo-notifications";
import { navigationRef } from "../navigation/navigationRef";

let pendingReminderId: string | null = null;

function parseReminderId(response: NotificationResponse): string | null {
  const data = response.notification.request.content.data;
  if (!data || typeof data !== "object") return null;
  const id = (data as Record<string, unknown>).reminderId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/** Open the reminder editor for a scheduled notification tap. */
export function navigateToReminderEditor(reminderId: string): void {
  if (!navigationRef.isReady()) {
    pendingReminderId = reminderId;
    return;
  }
  pendingReminderId = null;
  navigationRef.reset({
    index: 2,
    routes: [
      { name: "ToolsDashboard" },
      { name: "ReminderHome" },
      { name: "ReminderEditor", params: { reminderId } },
    ],
  });
}

/** Call when NavigationContainer is ready (cold start from notification). */
export function flushPendingReminderNotificationNavigation(): void {
  if (!pendingReminderId) return;
  navigateToReminderEditor(pendingReminderId);
}

function handleNotificationResponse(response: NotificationResponse): void {
  const reminderId = parseReminderId(response);
  if (!reminderId) return;
  void Notifications.clearLastNotificationResponseAsync().catch(() => {});
  navigateToReminderEditor(reminderId);
}

/** Wire OS notification taps → ReminderEditor (native only). */
export function registerReminderNotificationNavigation(): () => void {
  if (Platform.OS === "web") return () => {};

  void Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) handleNotificationResponse(response);
  });

  const sub = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
  return () => sub.remove();
}
