import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { PrivacyPolicyProps } from "../navigation/types";
import { useTheme } from "../context/ThemeContext";
import { useAppStyles } from "../hooks/useAppStyles";
import type { AppThemeColors } from "../theme/colors";
import { APP_DISPLAY_NAME } from "../constants/appBranding";
import {
  PRIVACY_POLICY_FOOTER,
  PRIVACY_POLICY_INTRO,
  PRIVACY_POLICY_LAST_UPDATED,
  PRIVACY_POLICY_SECTIONS,
} from "../constants/privacyPolicyContent";

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
    scrollContent: { paddingHorizontal: GRID_PAD, paddingBottom: 32 },
    leadCard: {
      backgroundColor: c.card,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      padding: 16,
      marginBottom: 20,
      gap: 10,
    },
    leadIconRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    leadTitle: { fontSize: 17, fontWeight: "800", color: c.text, flex: 1 },
    updated: { fontSize: 12, fontWeight: "600", color: c.textTertiary },
    intro: { fontSize: 15, color: c.textSecondary, lineHeight: 22 },
    section: { marginBottom: 22, gap: 8 },
    sectionTitle: { fontSize: 16, fontWeight: "800", color: c.text },
    body: { fontSize: 15, color: c.textSecondary, lineHeight: 22 },
    bulletRow: { flexDirection: "row", gap: 8, paddingLeft: 4 },
    bulletDot: { fontSize: 15, lineHeight: 22, color: c.primaryDark, fontWeight: "700" },
    bulletText: { flex: 1, fontSize: 15, color: c.textSecondary, lineHeight: 22 },
    footer: {
      marginTop: 8,
      fontSize: 13,
      color: c.placeholder,
      lineHeight: 20,
      fontStyle: "italic",
    },
  });
}

export default function PrivacyPolicyScreen({ navigation }: PrivacyPolicyProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useAppStyles(createStyles);

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
          Privacy
        </Text>
        <View style={[styles.headerEdge, styles.headerEdgeRight]} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.leadCard}>
          <View style={styles.leadIconRow}>
            <Ionicons name="shield-checkmark" size={28} color={colors.primaryDark} />
            <Text style={styles.leadTitle}>{APP_DISPLAY_NAME} privacy</Text>
          </View>
          <Text style={styles.updated}>Last updated {PRIVACY_POLICY_LAST_UPDATED}</Text>
          <Text style={styles.intro}>{PRIVACY_POLICY_INTRO}</Text>
        </View>

        {PRIVACY_POLICY_SECTIONS.map((section) => {
          const bullets = section.bullets?.map((b) => (
            <View key={b} style={styles.bulletRow}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>{b}</Text>
            </View>
          ));
          const paragraphs = (section.paragraphs ?? []).map((p) => (
            <Text key={p} style={styles.body}>
              {p}
            </Text>
          ));
          return (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.bulletsFirst ? (
                <>
                  {bullets}
                  {paragraphs}
                </>
              ) : (
                <>
                  {paragraphs}
                  {bullets}
                </>
              )}
            </View>
          );
        })}

        <Text style={styles.footer}>{PRIVACY_POLICY_FOOTER}</Text>
      </ScrollView>
    </View>
  );
}
