import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Alert,
  Platform,
  Linking,
} from "react-native";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { SettingsProps } from "../navigation/types";
import { useTheme } from "../context/ThemeContext";
import { useAppStyles } from "../hooks/useAppStyles";
import type { AppThemeColors } from "../theme/colors";
import { APP_DISPLAY_NAME } from "../constants/appBranding";
import { openSupportEmail } from "../utils/openSupportEmail";
import ProSubscriptionSettingsCard, {
  createProSubscriptionStyles,
} from "../components/ProSubscriptionSettingsCard";

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
    headerEdge: {
      flex: 1,
      minWidth: 0,
    },
    headerEdgeLeft: {
      alignItems: "flex-start",
    },
    headerEdgeRight: {
      alignItems: "flex-end",
    },
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
    scrollContent: { paddingHorizontal: GRID_PAD, paddingBottom: 32, gap: 22 },
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
    rowLast: {
      borderBottomWidth: 0,
    },
    rowBody: { flex: 1, minWidth: 0 },
    rowTitle: { fontSize: 16, fontWeight: "600", color: c.text },
    rowSubtitle: { fontSize: 13, color: c.placeholder, marginTop: 4, lineHeight: 18 },
    foot: {
      marginTop: 8,
      fontSize: 12,
      color: c.placeholder,
      lineHeight: 18,
      paddingHorizontal: 4,
    },
    ...createProSubscriptionStyles(c),
  });
}

export default function SettingsScreen({ navigation }: SettingsProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useAppStyles(createStyles);

  const appVersion =
    Constants.expoConfig?.version ?? (Constants as unknown as { nativeAppVersion?: string }).nativeAppVersion ?? "—";

  const openSystemSettings = () => {
    if (Platform.OS === "web") {
      Alert.alert("Notifications", "Use your browser and OS settings to control site permissions.");
      return;
    }
    void Linking.openSettings();
  };

  const rowChevron = () => <Ionicons name="chevron-forward" size={20} color={colors.placeholder} />;

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
          Settings
        </Text>
        <View style={[styles.headerEdge, styles.headerEdgeRight]} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Listahan Pro</Text>
        <ProSubscriptionSettingsCard colors={colors} styles={styles} />

        <Text style={styles.sectionTitle}>General</Text>
        <View style={styles.card}>
          <Pressable
            style={({ pressed }) => [styles.row, styles.rowLast, pressed && { opacity: 0.85 }]}
            onPress={openSystemSettings}
            accessibilityRole="button"
            accessibilityLabel="Open system notification settings"
          >
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Notifications</Text>
              <Text style={styles.rowSubtitle}>Open system settings for alerts and permission prompts.</Text>
            </View>
            {rowChevron()}
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Legal</Text>
        <View style={styles.card}>
          <Pressable
            style={({ pressed }) => [styles.row, styles.rowLast, pressed && { opacity: 0.85 }]}
            onPress={() => navigation.navigate("PrivacyPolicy")}
            accessibilityRole="button"
            accessibilityLabel="Open privacy policy"
          >
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Privacy policy</Text>
              <Text style={styles.rowSubtitle}>What we store, sync, and how you stay in control.</Text>
            </View>
            {rowChevron()}
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Support</Text>
        <View style={styles.card}>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
            onPress={() => navigation.navigate("Faq")}
            accessibilityRole="button"
            accessibilityLabel="Open frequently asked questions"
          >
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>FAQ</Text>
              <Text style={styles.rowSubtitle}>Sync, voice, import, vault, and troubleshooting.</Text>
            </View>
            {rowChevron()}
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
            onPress={() => void openSupportEmail({ kind: "problem" })}
            accessibilityRole="button"
            accessibilityLabel="Report a problem by email"
          >
            <Text style={[styles.rowTitle, styles.rowBody]}>Report a problem</Text>
            <Ionicons name="mail-outline" size={20} color={colors.placeholder} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.row, styles.rowLast, pressed && { opacity: 0.85 }]}
            onPress={() => void openSupportEmail({ kind: "feedback" })}
            accessibilityRole="button"
            accessibilityLabel="Send general feedback by email"
          >
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>General feedback</Text>
              <Text style={styles.rowSubtitle}>Ideas and suggestions welcome.</Text>
            </View>
            <Ionicons name="mail-outline" size={20} color={colors.placeholder} />
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>App</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={[styles.rowTitle, styles.rowBody]}>Version</Text>
            <Text style={{ fontSize: 15, fontWeight: "600", color: colors.textTertiary }}>{appVersion}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.row, styles.rowLast, pressed && { opacity: 0.85 }]}
            onPress={() =>
              Alert.alert(
                "Rate on the store",
                `When ${APP_DISPLAY_NAME} is published, a link to rate the app will appear here.`
              )
            }
            accessibilityRole="button"
          >
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Rate us on the store</Text>
              <Text style={styles.rowSubtitle}>Great ratings help others discover the app.</Text>
            </View>
            {rowChevron()}
          </Pressable>
        </View>

        <Text style={styles.foot}>
          Notifications and support live here. Dark mode, text size, your portrait, and imports are on Profile.
        </Text>
      </ScrollView>
    </View>
  );
}
