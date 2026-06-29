import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { FaqProps } from "../navigation/types";
import { useTheme } from "../context/ThemeContext";
import { useAppStyles } from "../hooks/useAppStyles";
import type { AppThemeColors } from "../theme/colors";
import { APP_DISPLAY_NAME } from "../constants/appBranding";
import { FAQ_INTRO, FAQ_LAST_UPDATED, FAQ_SECTIONS } from "../constants/faqContent";
import type { FaqItem } from "../constants/faqContent";
import { SUPPORT_EMAIL } from "../constants/supportContact";

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
    category: { marginBottom: 20, gap: 10 },
    categoryTitle: {
      fontSize: 12,
      fontWeight: "800",
      color: c.textTertiary,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      marginBottom: 2,
    },
    qaCard: {
      backgroundColor: c.card,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      overflow: "hidden",
    },
    qaHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 14,
    },
    qaHeaderPressed: { opacity: 0.88 },
    question: { flex: 1, fontSize: 15, fontWeight: "800", color: c.text, lineHeight: 21 },
    qaBody: {
      paddingHorizontal: 14,
      paddingBottom: 14,
      gap: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.borderMuted,
    },
    answer: { fontSize: 14, color: c.textSecondary, lineHeight: 21, paddingTop: 10 },
    bulletRow: { flexDirection: "row", gap: 8, paddingLeft: 2 },
    bulletDot: { fontSize: 14, lineHeight: 21, color: c.primaryDark, fontWeight: "700" },
    bulletText: { flex: 1, fontSize: 14, color: c.textSecondary, lineHeight: 21 },
    footer: {
      marginTop: 4,
      fontSize: 13,
      color: c.placeholder,
      lineHeight: 20,
      textAlign: "center",
    },
  });
}

function faqItemKey(sectionTitle: string, item: FaqItem): string {
  return `${sectionTitle}::${item.question}`;
}

function FaqAccordionItem({
  itemKey,
  item,
  open,
  onToggle,
  styles,
  colors,
}: {
  itemKey: string;
  item: FaqItem;
  open: boolean;
  onToggle: (key: string) => void;
  styles: ReturnType<typeof createStyles>;
  colors: AppThemeColors;
}) {
  return (
    <View style={styles.qaCard}>
      <Pressable
        style={({ pressed }) => [styles.qaHeader, pressed && styles.qaHeaderPressed]}
        onPress={() => onToggle(itemKey)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={item.question}
      >
        <Text style={styles.question}>{item.question}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.textTertiary} />
      </Pressable>
      {open ? (
        <View style={styles.qaBody}>
          <Text style={styles.answer}>{item.answer}</Text>
          {item.bullets?.map((b) => (
            <View key={b} style={styles.bulletRow}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>{b}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function FaqScreen({ navigation }: FaqProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useAppStyles(createStyles);
  const [openKeys, setOpenKeys] = useState<ReadonlySet<string>>(() => new Set());

  const toggleItem = useCallback((key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

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
          FAQ
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
            <Ionicons name="help-circle" size={28} color={colors.primaryDark} />
            <Text style={styles.leadTitle}>{APP_DISPLAY_NAME} help</Text>
          </View>
          <Text style={styles.updated}>Last updated {FAQ_LAST_UPDATED}</Text>
          <Text style={styles.intro}>{FAQ_INTRO}</Text>
        </View>

        {FAQ_SECTIONS.map((section) => (
          <View key={section.title} style={styles.category}>
            <Text style={styles.categoryTitle}>{section.title}</Text>
            {section.items.map((item) => {
              const key = faqItemKey(section.title, item);
              return (
                <FaqAccordionItem
                  key={key}
                  itemKey={key}
                  item={item}
                  open={openKeys.has(key)}
                  onToggle={toggleItem}
                  styles={styles}
                  colors={colors}
                />
              );
            })}
          </View>
        ))}

        <Text style={styles.footer}>Questions? {SUPPORT_EMAIL}</Text>
      </ScrollView>
    </View>
  );
}
