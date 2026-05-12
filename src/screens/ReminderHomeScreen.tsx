import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Pressable,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { ReminderHomeProps } from "../navigation/types";
import { useToolTheme } from "../hooks/useToolTheme";
import type { AppThemeColors } from "../theme/colors";
import {
  deleteReminder,
  loadReminders,
  isPastOneShot,
  recurrenceLabel,
  notifyBeforeLabel,
  type SavedReminder,
} from "../utils/remindersStorage";
import { cancelReminderScheduleIds, reconcileScheduledReminders } from "../utils/reminderNotifications";

function formatFireAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function createStyles(c: AppThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    header: {
      paddingHorizontal: 20,
      paddingBottom: 12,
      flexShrink: 0,
    },
    bodyFill: { flex: 1, minHeight: 0 },
    headerTextCol: { alignSelf: "stretch" },
    backRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6 },
    backTextSmall: { fontSize: 14, fontWeight: "600", color: c.linkBlue },
    title: { fontSize: 28, fontWeight: "800", color: c.text },
    subtitle: { marginTop: 4, fontSize: 15, color: c.textTertiary },
    settingsLink: {
      marginTop: 10,
      fontSize: 15,
      fontWeight: "700",
      color: c.linkBlue,
    },
    listContent: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
    card: {
      backgroundColor: c.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    cardPressed: { opacity: 0.92 },
    rowTitle: { fontSize: 16, fontWeight: "700", color: c.text },
    rowMeta: { marginTop: 6, fontSize: 13, color: c.placeholder },
    rowMetaPast: { marginTop: 6, fontSize: 13, color: c.textTertiary },
    empty: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 24 },
    emptyTitle: { marginTop: 12, fontSize: 18, fontWeight: "700", color: c.textTertiary },
    emptyText: { marginTop: 6, fontSize: 14, color: c.placeholder, textAlign: "center" },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    footer: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 16,
      paddingTop: 10,
      backgroundColor: "transparent",
    },
    primaryBtn: {
      backgroundColor: c.primary,
      borderRadius: 16,
      paddingVertical: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      shadowColor: c.primaryDark,
      shadowOpacity: 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    primaryBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  });
}

export default function ReminderHomeScreen({ navigation }: ReminderHomeProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useToolTheme("reminder");
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [items, setItems] = useState<SavedReminder[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const list = await loadReminders();
    setItems(list);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await refresh();
        if (Platform.OS === "android" || Platform.OS === "ios") {
          await reconcileScheduledReminders();
          await refresh();
        }
      })();
    }, [refresh])
  );

  const onNew = useCallback(() => {
    navigation.navigate("ReminderEditor", {});
  }, [navigation]);

  const onOpen = useCallback(
    (id: string) => {
      navigation.navigate("ReminderEditor", { reminderId: id });
    },
    [navigation]
  );

  const onDelete = useCallback(
    (r: SavedReminder) => {
      Alert.alert("Delete reminder?", "This removes the saved reminder and any scheduled alert.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              await cancelReminderScheduleIds(r);
              await deleteReminder(r.id);
              await refresh();
            })();
          },
        },
      ]);
    },
    [refresh]
  );

  const listBottomPad = insets.bottom + 120;

  if (loading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
        <View style={styles.header} collapsable={false}>
          <View style={styles.headerTextCol}>
            <TouchableOpacity
              style={styles.backRow}
              onPress={() => navigation.navigate("ToolsDashboard")}
              accessibilityRole="button"
              accessibilityLabel="Back to tools"
            >
              <Ionicons name="chevron-back" size={18} color={colors.linkBlue} />
              <Text style={styles.backTextSmall}>Tools</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Reminder</Text>
          </View>
        </View>
        <View style={[styles.bodyFill, styles.center]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (Platform.OS === "web") {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.header} collapsable={false}>
          <View style={styles.headerTextCol}>
            <TouchableOpacity
              style={styles.backRow}
              onPress={() => navigation.navigate("ToolsDashboard")}
              accessibilityRole="button"
              accessibilityLabel="Back to tools"
            >
              <Ionicons name="chevron-back" size={18} color={colors.linkBlue} />
              <Text style={styles.backTextSmall}>Tools</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Reminder</Text>
            <Text style={styles.subtitle}>Nudges at the right time — on your phone.</Text>
          </View>
        </View>
        <View style={[styles.bodyFill, styles.center, { paddingHorizontal: 24 }]}>
          <Ionicons name="phone-portrait-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>Open SayCart on iOS or Android</Text>
          <Text style={[styles.emptyText, { marginTop: 8 }]}>
            Scheduled local alerts are not available in the web preview. Your lists and other tools still work here.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header} collapsable={false}>
        <View style={styles.headerTextCol}>
          <TouchableOpacity
            style={styles.backRow}
            onPress={() => navigation.navigate("ToolsDashboard")}
            accessibilityRole="button"
            accessibilityLabel="Back to tools"
          >
            <Ionicons name="chevron-back" size={18} color={colors.linkBlue} />
            <Text style={styles.backTextSmall}>Tools</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Reminder</Text>
          <Text style={styles.subtitle}>Turn on Allow notifications for SayCart if you want nudges.</Text>
          <TouchableOpacity
            onPress={() => void Linking.openSettings()}
            accessibilityRole="button"
            accessibilityLabel="Open system settings for SayCart"
          >
            <Text style={styles.settingsLink}>Open SayCart in system settings</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.bodyFill}>
        {items.length === 0 ? (
          <View style={[styles.empty, { paddingBottom: listBottomPad }]}>
            <Ionicons name="alarm-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No reminders yet</Text>
            <Text style={styles.emptyText}>Tap below to schedule your first nudge.</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            style={{ flex: 1 }}
            contentContainerStyle={[styles.listContent, { paddingBottom: listBottomPad }]}
            renderItem={({ item }) => {
              const past = isPastOneShot(item);
              const bits = [formatFireAt(item.fireAt), recurrenceLabel(item.recurrence)];
              if (item.recurrence === "none" && item.notifyBefore !== "on_time") {
                bits.push(notifyBeforeLabel(item.notifyBefore, item));
              }
              return (
                <Pressable
                  style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                  onPress={() => onOpen(item.id)}
                  onLongPress={() => onDelete(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Reminder: ${item.title}`}
                >
                  <Text style={styles.rowTitle} numberOfLines={2}>
                    {item.title.trim() || "Reminder"}
                  </Text>
                  <Text style={past ? styles.rowMetaPast : styles.rowMeta}>
                    {past ? "Past · " : ""}
                    {bits.join(" · ")}
                    {!past && item.notificationId == null && item.earlyNotificationId == null
                      ? " · In-app only (no alert)"
                      : ""}
                  </Text>
                </Pressable>
              );
            }}
          />
        )}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={styles.primaryBtn} onPress={onNew} activeOpacity={0.9}>
          <Ionicons name="add-circle-outline" size={22} color="#fff" />
          <Text style={styles.primaryBtnText}>Add reminder</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
