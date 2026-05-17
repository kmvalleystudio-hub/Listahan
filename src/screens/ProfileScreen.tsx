import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable, Switch } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { ProfileProps } from "../navigation/types";
import { useTheme } from "../context/ThemeContext";
import { useAppStyles } from "../hooks/useAppStyles";
import FontSizeStepSlider from "../components/FontSizeStepSlider";
import { useAppAlert } from "../context/AppAlertContext";
import { useAppData } from "../context/AppDataContext";
import type { AppThemeColors } from "../theme/colors";
import { APP_DISPLAY_NAME } from "../constants/appBranding";
import { TOOLS_CATALOG } from "../constants/toolsCatalog";
import ProfileAvatarField from "../components/ProfileAvatarField";
import { isSupabaseConfigured } from "../services/supabaseClient";
import {
  formatMemberSince,
  listahanPublicTag,
  loadUserProfile,
  type UserProfile,
} from "../utils/userProfileStorage";
import { loadQuickNotes } from "../utils/quickNotesStorage";
import { loadReminders } from "../utils/remindersStorage";
import { resetToolOrderToDefault } from "../utils/toolsDashboardOrder";

const GRID_PAD = 16;

function createStyles(c: AppThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: GRID_PAD,
      paddingBottom: 10,
      minHeight: 44,
    },
    headerEdge: { flex: 1, minWidth: 0 },
    headerEdgeLeft: { alignItems: "flex-start" },
    headerEdgeRight: { alignItems: "flex-end" },
    backBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 8, paddingRight: 8 },
    backText: { fontSize: 16, fontWeight: "600", color: c.linkBlue },
    headerTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: c.text,
      textAlign: "center",
      flexShrink: 0,
      paddingHorizontal: 8,
    },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: GRID_PAD, paddingBottom: 32, gap: 18 },
    heroCard: {
      backgroundColor: c.card,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      padding: 14,
      gap: 10,
    },
    heroTopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    heroIdentity: { flex: 1, minWidth: 0, gap: 3 },
    heroName: { fontSize: 20, fontWeight: "800", color: c.text },
    heroSub: { fontSize: 13, color: c.textTertiary, lineHeight: 18 },
    tagRow: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 4,
      maxWidth: "100%",
    },
    tagText: {
      flexShrink: 1,
      fontSize: 13,
      fontWeight: "600",
      color: c.textSecondary,
      letterSpacing: 0.1,
    },
    tagCopyBtn: { padding: 2, flexShrink: 0 },
    cloudHint: {
      fontSize: 12,
      color: c.textTertiary,
      lineHeight: 17,
      backgroundColor: c.inputBg,
      borderRadius: 10,
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: "800",
      color: c.textTertiary,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      marginBottom: 8,
      marginTop: 4,
    },
    card: {
      backgroundColor: c.card,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      overflow: "hidden",
    },
    statRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      gap: 12,
    },
    statRowLast: { borderBottomWidth: 0 },
    statLabel: { fontSize: 15, fontWeight: "600", color: c.text },
    statValue: { fontSize: 15, fontWeight: "700", color: c.textTertiary },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    rowLast: { borderBottomWidth: 0 },
    rowBody: { flex: 1, minWidth: 0 },
    rowTitle: { fontSize: 16, fontWeight: "600", color: c.text },
    rowSubtitle: { fontSize: 13, color: c.placeholder, marginTop: 4, lineHeight: 18 },
    fontSizeBlock: {
      paddingVertical: 14,
      paddingHorizontal: 16,
      gap: 2,
      borderBottomWidth: 0,
    },
    rowIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: c.inputBg,
      alignItems: "center",
      justifyContent: "center",
    },
    foot: {
      marginTop: 8,
      fontSize: 12,
      color: c.placeholder,
      lineHeight: 18,
      paddingHorizontal: 4,
    },
    modalRoot: { flex: 1, justifyContent: "flex-end" },
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    modalSheet: {
      backgroundColor: c.card,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      paddingHorizontal: 20,
      paddingTop: 20,
      gap: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    modalTitle: { fontSize: 18, fontWeight: "800", color: c.text },
    input: {
      backgroundColor: c.inputBg,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 17,
      color: c.text,
    },
    modalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
    modalBtn: {
      flex: 1,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
    },
    modalBtnPrimary: { backgroundColor: c.primary },
    modalBtnGhost: { backgroundColor: c.inputBg, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    modalBtnTextPrimary: { color: "#fff", fontSize: 16, fontWeight: "700" },
    modalBtnTextGhost: { color: c.text, fontSize: 16, fontWeight: "700" },
  });
}

export default function ProfileScreen({ navigation }: ProfileProps) {
  const insets = useSafeAreaInsets();
  const {
    colors,
    isDark,
    toggleScheme,
    fontSizeLevel,
    useSystemFontSize,
    setUseSystemFontSize,
    setFontSizeLevel,
  } = useTheme();
  const { showAlert } = useAppAlert();
  const styles = useAppStyles(createStyles);
  const { lists, todoLists, privateLists } = useAppData();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [notesCount, setNotesCount] = useState(0);
  const [remindersCount, setRemindersCount] = useState(0);
  const refresh = useCallback(async () => {
    const [p, notes, reminders] = await Promise.all([
      loadUserProfile(),
      loadQuickNotes(),
      loadReminders(),
    ]);
    setProfile(p);
    setNotesCount(notes.length);
    setRemindersCount(reminders.length);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const copyListahanTag = useCallback(async () => {
    const tag = listahanPublicTag(profile?.username ?? "", profile?.tagSuffix);
    if (!tag) return;
    try {
      await Clipboard.setStringAsync(tag);
      showAlert({
        title: "Copied",
        message: "Your Listahan tag was copied to the clipboard.",
        variant: "success",
      });
    } catch {
      showAlert({
        title: "Could not copy",
        message: "Try selecting the tag manually.",
        variant: "error",
      });
    }
  }, [profile?.username, profile?.tagSuffix, showAlert]);

  const confirmResetTools = () => {
    showAlert({
      title: "Reset tools layout?",
      message: `Restore the home screen to the default order (${TOOLS_CATALOG.map((t) => t.title).join(", ")}).`,
      variant: "warning",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            void resetToolOrderToDefault().then(() => {
              showAlert({
                title: "Layout reset",
                message: "Open the home screen to see the default tool order.",
                variant: "success",
              });
            });
          },
        },
      ],
    });
  };

  const rowChevron = () => <Ionicons name="chevron-forward" size={20} color={colors.placeholder} />;

  const username = profile?.username ?? "";
  const publicTag = listahanPublicTag(username, profile?.tagSuffix);

  const renderListahanTagRow = () => {
    if (!publicTag) return null;
    return (
      <View style={styles.tagRow}>
        <Text style={styles.tagText} selectable>
          {publicTag}
        </Text>
        <Pressable
          onPress={() => void copyListahanTag()}
          hitSlop={10}
          style={styles.tagCopyBtn}
          accessibilityRole="button"
          accessibilityLabel="Copy Listahan tag"
        >
          <Ionicons name="copy-outline" size={17} color={colors.linkBlue} />
        </Pressable>
      </View>
    );
  };
  const memberSince = profile?.createdAt ? formatMemberSince(profile.createdAt) : "";

  const stats = [
    { label: "Grocery lists", value: lists.length },
    { label: "To-do lists", value: todoLists.length },
    { label: "Notes", value: notesCount },
    { label: "Reminders", value: remindersCount },
    { label: "Vault sheets", value: privateLists.length },
  ];

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <View style={[styles.headerEdge, styles.headerEdgeLeft]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={22} color={colors.linkBlue} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle} accessibilityRole="header">
          Profile
        </Text>
        <View style={[styles.headerEdge, styles.headerEdgeRight]} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <ProfileAvatarField
              colors={colors}
              size={64}
              showCaption={false}
              align="start"
              uploadAfterPick
              onProfileUpdated={setProfile}
            />

            <View style={styles.heroIdentity}>
              <Text style={styles.heroName} numberOfLines={1}>
                {username.trim() ? username.trim() : "Username"}
              </Text>
              {renderListahanTagRow()}
              <Text style={styles.heroSub} numberOfLines={2}>
                {memberSince ? `On ${APP_DISPLAY_NAME} since ${memberSince}` : `Your ${APP_DISPLAY_NAME} space`}
              </Text>
            </View>
          </View>

          <Text style={styles.cloudHint}>
            Portrait and tag saved for when others can find you on {APP_DISPLAY_NAME}.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Dark mode</Text>
              <Text style={styles.rowSubtitle}>Reduce glare and match dim environments.</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={() => toggleScheme()}
              trackColor={{ false: colors.switchTrackOff, true: colors.switchTrackOn }}
              thumbColor={isDark ? colors.switchThumbOn : colors.switchThumbOff}
              ios_backgroundColor={colors.iosSwitchBg}
            />
          </View>
          <View style={styles.row}>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Use system text size</Text>
              <Text style={styles.rowSubtitle}>Follow your device accessibility text size.</Text>
            </View>
            <Switch
              value={useSystemFontSize}
              onValueChange={setUseSystemFontSize}
              trackColor={{ false: colors.switchTrackOff, true: colors.switchTrackOn }}
              thumbColor={useSystemFontSize ? colors.switchThumbOn : colors.switchThumbOff}
              ios_backgroundColor={colors.iosSwitchBg}
            />
          </View>
          <View style={[styles.fontSizeBlock, styles.rowLast]}>
            <Text style={styles.rowTitle}>Text size</Text>
            <Text style={styles.rowSubtitle}>
              {useSystemFontSize
                ? "Using your device text size for the app."
                : "Drag the slider — 3 is the default size."}
            </Text>
            <FontSizeStepSlider
              colors={colors}
              value={fontSizeLevel}
              onValueChange={setFontSizeLevel}
              disabled={useSystemFontSize}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>On this device</Text>
        <View style={styles.card}>
          {stats.map((s, i) => (
            <View key={s.label} style={[styles.statRow, i === stats.length - 1 && styles.statRowLast]}>
              <Text style={styles.statLabel}>{s.label}</Text>
              <Text style={styles.statValue}>{s.value}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Shortcuts</Text>
        <View style={styles.card}>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
            onPress={() => navigation.navigate("ShareImport")}
            accessibilityRole="button"
          >
            <View style={styles.rowIcon}>
              <Ionicons name="download-outline" size={20} color={colors.primaryDark} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Import from share code</Text>
              <Text style={styles.rowSubtitle}>Paste a QR or code from someone else’s list.</Text>
            </View>
            {rowChevron()}
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
            onPress={() => navigation.navigate("PrivateVaultSettings")}
            accessibilityRole="button"
          >
            <View style={styles.rowIcon}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.primaryDark} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Vault security</Text>
              <Text style={styles.rowSubtitle}>PIN, biometrics, and recovery for private sheets.</Text>
            </View>
            {rowChevron()}
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.row, styles.rowLast, pressed && { opacity: 0.85 }]}
            onPress={confirmResetTools}
            accessibilityRole="button"
          >
            <View style={styles.rowIcon}>
              <Ionicons name="grid-outline" size={20} color={colors.primaryDark} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Reset tools layout</Text>
              <Text style={styles.rowSubtitle}>Restore the default order on the home screen.</Text>
            </View>
            {rowChevron()}
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Data</Text>
        <View style={styles.card}>
          <Pressable
            style={({ pressed }) => [styles.row, styles.rowLast, pressed && { opacity: 0.85 }]}
            onPress={() =>
              showAlert({
                title: "Data on this device",
                message: `${APP_DISPLAY_NAME} keeps your lists, notes, reminders, and vault on this phone. With Supabase configured, your Listahan tag (@username), portrait, and profile upload for future discovery sync; nothing else is uploaded unless you share or import a code.`,
                variant: "info",
              })
            }
            accessibilityRole="button"
          >
            <View style={styles.rowIcon}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.primaryDark} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Data & privacy</Text>
              <Text style={styles.rowSubtitle}>Where your information lives today.</Text>
            </View>
            {rowChevron()}
          </Pressable>
        </View>

        <Text style={styles.foot}>
          Your portrait, tag, and appearance live here. Notifications, version info, and support are in Settings.
        </Text>
      </ScrollView>
    </View>
  );
}
