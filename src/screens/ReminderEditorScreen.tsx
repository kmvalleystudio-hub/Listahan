import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
  Keyboard,
  Modal,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { ReminderEditorProps } from "../navigation/types";
import { useToolTheme } from "../hooks/useToolTheme";
import type { AppThemeColors } from "../theme/colors";
import {
  deleteReminder,
  loadRemindersRaw,
  newReminderId,
  upsertReminder,
  canUseNotify1d,
  canUseNotify1w,
  type SavedReminder,
  type ReminderRecurrence,
  type NotifyBeforeOption,
  type CustomNotifyUnit,
} from "../utils/remindersStorage";
import {
  cancelReminderScheduleIds,
  requestReminderNotificationPermission,
  scheduleReminderNotification,
} from "../utils/reminderNotifications";

const RECURRENCE_OPTIONS: { id: ReminderRecurrence; label: string }[] = [
  { id: "none", label: "Once" },
  { id: "hourly", label: "Hourly" },
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

const NOTIFY_OPTIONS: { id: NotifyBeforeOption; label: string }[] = [
  { id: "on_time", label: "On time" },
  { id: "1h", label: "1h before" },
  { id: "1d", label: "1 day before" },
  { id: "1w", label: "1 week before" },
  { id: "custom", label: "Custom" },
];

const CUSTOM_UNIT_OPTIONS: { id: CustomNotifyUnit; label: string }[] = [
  { id: "min", label: "Minutes" },
  { id: "h", label: "Hours" },
  { id: "d", label: "Days" },
];

function clampCustomAmount(raw: number, unit: CustomNotifyUnit): number {
  const n = Math.max(1, Math.round(raw));
  if (unit === "min") return Math.min(n, 60 * 24 * 365);
  if (unit === "h") return Math.min(n, 24 * 365);
  return Math.min(n, 365);
}

function defaultFireDate(): Date {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setSeconds(0, 0);
  return d;
}

function applyDatePart(base: Date, picked: Date): Date {
  const out = new Date(base);
  out.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
  return out;
}

function applyTimePart(base: Date, picked: Date): Date {
  const out = new Date(base);
  out.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
  return out;
}

function createStyles(c: AppThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    header: {
      paddingHorizontal: 16,
      paddingBottom: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      backgroundColor: c.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.borderMuted,
    },
    backRow: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 8 },
    backText: { fontSize: 16, fontWeight: "600", color: c.linkBlue },
    headerTitle: { fontSize: 17, fontWeight: "700", color: c.text, flex: 1, textAlign: "center" },
    trashBtn: { padding: 8 },
    scroll: { flex: 1 },
    scrollInner: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },
    label: { fontSize: 13, fontWeight: "700", color: c.textTertiary, marginBottom: 6 },
    titleInput: {
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.card,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 17,
      fontWeight: "600",
      color: c.text,
    },
    notesInput: {
      marginTop: 16,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.card,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      lineHeight: 22,
      color: c.text,
      minHeight: 100,
      textAlignVertical: "top",
    },
    chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.card,
    },
    chipActive: {
      borderColor: c.linkBlue,
      backgroundColor: c.accentBlueSoft,
    },
    chipDisabled: { opacity: 0.45 },
    chipText: { fontSize: 14, fontWeight: "600", color: c.text },
    chipTextActive: { color: c.linkBlue },
    hint: { marginTop: 8, fontSize: 13, color: c.textTertiary, lineHeight: 18 },
    pickerRow: {
      marginTop: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.card,
    },
    pickerRowLabel: { fontSize: 15, fontWeight: "600", color: c.text },
    pickerRowValue: { fontSize: 15, color: c.linkBlue, fontWeight: "600", maxWidth: "55%" },
    iosPickerDone: {
      flexDirection: "row",
      justifyContent: "flex-end",
      marginTop: 8,
      marginBottom: 4,
    },
    iosPickerDoneText: { fontSize: 16, fontWeight: "700", color: c.linkBlue },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    footer: {
      paddingHorizontal: 16,
      paddingTop: 10,
      backgroundColor: c.background,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.borderMuted,
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
    primaryBtnDisabled: { opacity: 0.55 },
    primaryBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
    customInlineRow: {
      marginTop: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    customAmountInputInline: {
      flex: 1,
      minWidth: 0,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.card,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: 16,
      color: c.text,
    },
    customUnitDropdown: {
      flexShrink: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.card,
      minWidth: 118,
      justifyContent: "space-between",
    },
    customUnitDropdownText: {
      flex: 1,
      minWidth: 0,
      fontSize: 15,
      fontWeight: "600",
      color: c.linkBlue,
      textAlign: "right",
    },
    notifyModalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    notifyModalSheet: {
      backgroundColor: c.card,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: 0,
      borderColor: c.border,
      maxHeight: "52%",
    },
    notifyModalTitle: {
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 12,
      fontSize: 17,
      fontWeight: "700",
      color: c.text,
    },
    notifyModalOption: {
      paddingVertical: 14,
      paddingHorizontal: 18,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.borderMuted,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    notifyModalOptionActive: { backgroundColor: c.accentBlueSoft },
    notifyModalOptionDisabled: { opacity: 0.42 },
    notifyModalOptionText: { fontSize: 16, fontWeight: "600", color: c.text },
    notifyModalOptionTextActive: { color: c.linkBlue },
    /** Right side of Notify row: take remaining width so value text is not capped by nested % maxWidths. */
    notifyTimingRowRight: {
      flex: 1,
      minWidth: 0,
      marginLeft: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 6,
    },
    notifyTimingValue: {
      fontSize: 15,
      color: c.linkBlue,
      fontWeight: "600",
      textAlign: "right",
      flexShrink: 1,
    },
  });
}

export default function ReminderEditorScreen({ navigation, route }: ReminderEditorProps) {
  const insets = useSafeAreaInsets();
  const paramId = route.params?.reminderId;
  const { colors, isDark } = useToolTheme("reminder");
  const styles = useMemo(() => createStyles(colors), [colors]);

  const idRef = useRef(paramId ?? newReminderId());
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [fireDate, setFireDate] = useState(defaultFireDate);
  const [recurrence, setRecurrence] = useState<ReminderRecurrence>("none");
  const [notifyBefore, setNotifyBefore] = useState<NotifyBeforeOption>("on_time");
  const [customAmount, setCustomAmount] = useState("30");
  const [customUnit, setCustomUnit] = useState<CustomNotifyUnit>("min");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [showNotifyPicker, setShowNotifyPicker] = useState(false);
  const [showCustomUnitPicker, setShowCustomUnitPicker] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!paramId) {
      setLoaded(true);
      return () => {
        cancelled = true;
      };
    }
    void loadRemindersRaw().then((all) => {
      if (cancelled) return;
      const r = all.find((x) => x.id === paramId);
      if (!r) {
        navigation.goBack();
        return;
      }
      idRef.current = r.id;
      setTitle(r.title);
      setNotes(r.notes);
      setFireDate(new Date(r.fireAt));
      setRecurrence(r.recurrence);
      setNotifyBefore(r.notifyBefore);
      setCustomAmount(String(r.customNotifyAmount ?? 30));
      setCustomUnit(r.customNotifyUnit ?? "min");
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [navigation, paramId]);

  const onDelete = useCallback(() => {
    Alert.alert("Delete this reminder?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void (async () => {
            const all = await loadRemindersRaw();
            const r = all.find((x) => x.id === idRef.current);
            await cancelReminderScheduleIds(r ?? { earlyNotificationId: null, notificationId: null });
            await deleteReminder(idRef.current);
            navigation.goBack();
          })();
        },
      },
    ]);
  }, [navigation]);

  const onSave = useCallback(async () => {
    if (Platform.OS === "web") {
      Alert.alert("Not on web", "Use the SayCart app on iOS or Android to save reminders.");
      return;
    }
    const t = title.trim();
    if (!t) {
      Alert.alert("Title needed", "Give this reminder a short title.");
      return;
    }

    const eventMs = fireDate.getTime();
    const customAmt = clampCustomAmount(parseInt(customAmount, 10) || 30, customUnit);
    const effectiveNotify: NotifyBeforeOption = recurrence === "none" ? notifyBefore : "on_time";

    const draft: SavedReminder = {
      id: idRef.current,
      title: t,
      notes: notes.trim(),
      fireAt: fireDate.toISOString(),
      recurrence,
      notifyBefore: effectiveNotify,
      customNotifyAmount: recurrence === "none" && notifyBefore === "custom" ? customAmt : null,
      customNotifyUnit: recurrence === "none" && notifyBefore === "custom" ? customUnit : null,
      notificationId: null,
      earlyNotificationId: null,
      updatedAt: new Date().toISOString(),
    };

    if (recurrence === "none") {
      if (notifyBefore === "1d" && !canUseNotify1d(eventMs)) {
        Alert.alert("1 day before", "Pick a date at least 2 days from now, or choose a different notify time.");
        return;
      }
      if (notifyBefore === "1w" && !canUseNotify1w(eventMs)) {
        Alert.alert("1 week before", "Pick a date at least 8 days from now, or choose a different notify time.");
        return;
      }
    } else {
      if (eventMs <= Date.now() + 60_000) {
        Alert.alert("Adjust time", "Choose a date and time at least one minute from now.");
        return;
      }
    }

    Keyboard.dismiss();
    setSaving(true);
    try {
      const existing = (await loadRemindersRaw()).find((x) => x.id === idRef.current);
      await cancelReminderScheduleIds(existing ?? { earlyNotificationId: null, notificationId: null });

      let notificationId: string | null = null;
      let earlyNotificationId: string | null = null;
      const granted = await requestReminderNotificationPermission();
      if (granted) {
        const rowForSchedule: SavedReminder = { ...draft, notificationId: null, earlyNotificationId: null };
        const ids = await scheduleReminderNotification(rowForSchedule);
        notificationId = ids.notificationId;
        earlyNotificationId = ids.earlyNotificationId;
        if (!notificationId && !earlyNotificationId) {
          Alert.alert("Could not schedule", "Try a slightly later time.");
        }
      } else {
        Alert.alert("Notifications", "Allow notifications for SayCart in system settings to get nudges.");
      }

      const row: SavedReminder = {
        ...draft,
        notificationId,
        earlyNotificationId,
        updatedAt: new Date().toISOString(),
      };
      await upsertReminder(row);
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  }, [customAmount, customUnit, fireDate, navigation, notes, notifyBefore, recurrence, title]);

  const dateLabel = useMemo(
    () =>
      fireDate.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    [fireDate]
  );
  const timeLabel = useMemo(
    () => fireDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
    [fireDate]
  );

  const onDateChange = useCallback(
    (event: { type?: string }, selected?: Date) => {
      if (Platform.OS === "android") {
        setShowDate(false);
        if (event.type !== "set" || !selected) return;
      }
      if (selected) setFireDate((prev) => applyDatePart(prev, selected));
    },
    []
  );

  const onTimeChange = useCallback(
    (event: { type?: string }, selected?: Date) => {
      if (Platform.OS === "android") {
        setShowTime(false);
        if (event.type !== "set" || !selected) return;
      }
      if (selected) setFireDate((prev) => applyTimePart(prev, selected));
    },
    []
  );

  const notifyDisabled = recurrence !== "none";

  useEffect(() => {
    if (notifyDisabled) {
      setShowNotifyPicker(false);
      setShowCustomUnitPicker(false);
    }
  }, [notifyDisabled]);

  useEffect(() => {
    if (notifyBefore !== "custom") setShowCustomUnitPicker(false);
  }, [notifyBefore]);

  const notifySelectionLabel = useMemo(() => {
    const opt = NOTIFY_OPTIONS.find((o) => o.id === notifyBefore);
    return opt?.label ?? "On time";
  }, [notifyBefore]);

  const customUnitLabel = useMemo(() => {
    const opt = CUSTOM_UNIT_OPTIONS.find((o) => o.id === customUnit);
    return opt?.label ?? "Minutes";
  }, [customUnit]);

  if (!loaded) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 4 }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backRow}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back to reminders"
          >
            <Ionicons name="chevron-back" size={22} color={colors.linkBlue} />
            <Text style={styles.backText}>Reminders</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Loading
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top + 4 }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 6 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backRow}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.linkBlue} />
          <Text style={styles.backText}>Reminders</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {paramId ? "Edit" : "New"}
        </Text>
        {paramId ? (
          <TouchableOpacity
            style={styles.trashBtn}
            onPress={onDelete}
            accessibilityRole="button"
            accessibilityLabel="Delete reminder"
          >
            <Ionicons name="trash-outline" size={22} color={colors.danger} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollInner} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={setTitle}
          placeholder="What should we nudge you about?"
          placeholderTextColor={colors.placeholder}
          maxLength={120}
        />

        <Text style={[styles.label, { marginTop: 16 }]}>Notes (optional)</Text>
        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={setNotes}
          placeholder="Extra detail for the notification…"
          placeholderTextColor={colors.placeholder}
          multiline
        />

        <Text style={[styles.label, { marginTop: 16 }]}>Repeat</Text>
        <View style={styles.chipWrap}>
          {RECURRENCE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              style={[styles.chip, recurrence === opt.id && styles.chipActive]}
              onPress={() => {
                setRecurrence(opt.id);
                if (opt.id !== "none") setNotifyBefore("on_time");
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: recurrence === opt.id }}
            >
              <Text style={[styles.chipText, recurrence === opt.id && styles.chipTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {recurrence === "hourly" ? (
          <Text style={styles.hint}>Hourly repeats every 60 minutes from when it is scheduled.</Text>
        ) : null}

        <Text style={[styles.label, { marginTop: 16 }]}>When</Text>
        <TouchableOpacity style={[styles.pickerRow, { marginTop: 8 }]} onPress={() => setShowDate((s) => !s)} activeOpacity={0.85}>
          <Text style={styles.pickerRowLabel}>Date</Text>
          <Text style={styles.pickerRowValue} numberOfLines={1}>
            {dateLabel}
          </Text>
        </TouchableOpacity>

        {showDate && Platform.OS === "ios" ? (
          <View>
            <View style={styles.iosPickerDone}>
              <TouchableOpacity onPress={() => setShowDate(false)} hitSlop={12}>
                <Text style={styles.iosPickerDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={fireDate}
              mode="date"
              display="spinner"
              onChange={onDateChange}
              themeVariant={isDark ? "dark" : "light"}
            />
          </View>
        ) : null}
        {showDate && Platform.OS === "android" ? (
          <DateTimePicker value={fireDate} mode="date" display="default" onChange={onDateChange} />
        ) : null}

        <TouchableOpacity
          style={[styles.pickerRow, { marginTop: 10 }]}
          onPress={() => setShowTime((s) => !s)}
          activeOpacity={0.85}
        >
          <Text style={styles.pickerRowLabel}>Time</Text>
          <Text style={styles.pickerRowValue} numberOfLines={1}>
            {timeLabel}
          </Text>
        </TouchableOpacity>

        {showTime && Platform.OS === "ios" ? (
          <View>
            <View style={styles.iosPickerDone}>
              <TouchableOpacity onPress={() => setShowTime(false)} hitSlop={12}>
                <Text style={styles.iosPickerDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={fireDate}
              mode="time"
              display="spinner"
              onChange={onTimeChange}
              themeVariant={isDark ? "dark" : "light"}
            />
          </View>
        ) : null}
        {showTime && Platform.OS === "android" ? (
          <DateTimePicker value={fireDate} mode="time" display="default" onChange={onTimeChange} />
        ) : null}

        <Text style={[styles.label, { marginTop: 16 }]}>Notify</Text>
        {notifyDisabled ? (
          <Text style={styles.hint}>Repeating reminders always notify on time each cycle.</Text>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.pickerRow, { marginTop: 8 }]}
              onPress={() => {
                Keyboard.dismiss();
                setShowNotifyPicker(true);
              }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Notify ${notifySelectionLabel}`}
            >
              <Text style={styles.pickerRowLabel} numberOfLines={1}>
                Timing
              </Text>
              <View style={styles.notifyTimingRowRight}>
                <Text style={styles.notifyTimingValue} numberOfLines={1}>
                  {notifySelectionLabel}
                </Text>
                <Ionicons name="chevron-down" size={18} color={colors.linkBlue} style={{ flexShrink: 0 }} />
              </View>
            </TouchableOpacity>
            <Modal visible={showNotifyPicker} transparent animationType="fade" onRequestClose={() => setShowNotifyPicker(false)}>
              <View style={{ flex: 1 }}>
                <TouchableOpacity
                  style={styles.notifyModalBackdrop}
                  activeOpacity={1}
                  onPress={() => setShowNotifyPicker(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss"
                />
                <View
                  style={[
                    styles.notifyModalSheet,
                    {
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: 0,
                      paddingBottom: insets.bottom + 16,
                    },
                  ]}
                >
                  <Text style={styles.notifyModalTitle}>Notify</Text>
                  <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
                    {NOTIFY_OPTIONS.map((opt) => {
                      const disabled =
                        (opt.id === "1d" && !canUseNotify1d(fireDate.getTime())) ||
                        (opt.id === "1w" && !canUseNotify1w(fireDate.getTime()));
                      const selected = notifyBefore === opt.id;
                      return (
                        <TouchableOpacity
                          key={opt.id}
                          style={[
                            styles.notifyModalOption,
                            selected && styles.notifyModalOptionActive,
                            disabled && styles.notifyModalOptionDisabled,
                          ]}
                          disabled={disabled}
                          onPress={() => {
                            setNotifyBefore(opt.id);
                            setShowNotifyPicker(false);
                          }}
                          accessibilityRole="button"
                          accessibilityState={{ selected, disabled }}
                        >
                          <Text
                            style={[
                              styles.notifyModalOptionText,
                              selected && styles.notifyModalOptionTextActive,
                            ]}
                          >
                            {opt.label}
                          </Text>
                          {selected ? <Ionicons name="checkmark" size={22} color={colors.linkBlue} /> : <View style={{ width: 22 }} />}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>
            </Modal>
            {notifyBefore === "custom" ? (
              <View style={{ marginTop: 8 }}>
                <View style={styles.customInlineRow}>
                  <TextInput
                    style={styles.customAmountInputInline}
                    value={customAmount}
                    onChangeText={setCustomAmount}
                    keyboardType="number-pad"
                    accessibilityLabel="Custom amount before event"
                    placeholder="Amount"
                    placeholderTextColor={colors.placeholder}
                  />
                  <TouchableOpacity
                    style={styles.customUnitDropdown}
                    onPress={() => {
                      Keyboard.dismiss();
                      setShowCustomUnitPicker(true);
                    }}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={`Unit ${customUnitLabel}`}
                  >
                    <Text style={styles.customUnitDropdownText} numberOfLines={1}>
                      {customUnitLabel}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={colors.linkBlue} style={{ flexShrink: 0 }} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.hint, { marginTop: 6 }]}>Before the date and time above.</Text>
                <Modal
                  visible={showCustomUnitPicker}
                  transparent
                  animationType="fade"
                  onRequestClose={() => setShowCustomUnitPicker(false)}
                >
                  <View style={{ flex: 1 }}>
                    <TouchableOpacity
                      style={styles.notifyModalBackdrop}
                      activeOpacity={1}
                      onPress={() => setShowCustomUnitPicker(false)}
                      accessibilityRole="button"
                      accessibilityLabel="Dismiss"
                    />
                    <View
                      style={[
                        styles.notifyModalSheet,
                        {
                          position: "absolute",
                          left: 0,
                          right: 0,
                          bottom: 0,
                          paddingBottom: insets.bottom + 16,
                        },
                      ]}
                    >
                      <Text style={styles.notifyModalTitle}>Unit</Text>
                      <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
                        {CUSTOM_UNIT_OPTIONS.map((opt) => {
                          const selected = customUnit === opt.id;
                          return (
                            <TouchableOpacity
                              key={opt.id}
                              style={[styles.notifyModalOption, selected && styles.notifyModalOptionActive]}
                              onPress={() => {
                                setCustomUnit(opt.id);
                                setShowCustomUnitPicker(false);
                              }}
                              accessibilityRole="button"
                              accessibilityState={{ selected }}
                            >
                              <Text
                                style={[
                                  styles.notifyModalOptionText,
                                  selected && styles.notifyModalOptionTextActive,
                                ]}
                              >
                                {opt.label}
                              </Text>
                              {selected ? (
                                <Ionicons name="checkmark" size={22} color={colors.linkBlue} />
                              ) : (
                                <View style={{ width: 22 }} />
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  </View>
                </Modal>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.primaryBtn, (!title.trim() || saving) && styles.primaryBtnDisabled]}
          onPress={() => void onSave()}
          disabled={!title.trim() || saving}
          activeOpacity={0.9}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Save reminder</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
