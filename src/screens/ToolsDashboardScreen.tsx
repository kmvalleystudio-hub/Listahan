import React, { useMemo, type ComponentProps } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { TOOLS_CATALOG, type ToolDefinition } from "../constants/toolsCatalog";
import { useTheme } from "../context/ThemeContext";
import type { AppThemeColors } from "../theme/colors";
import { rgbaFromHex } from "../theme/toolTheme";

export type ToolsDashboardProps = NativeStackScreenProps<RootStackParamList, "ToolsDashboard">;

function createDashboardStyles(c: AppThemeColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.background,
    },
    header: {
      paddingHorizontal: 20,
      paddingBottom: 8,
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
    },
    headerTextCol: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontSize: 28,
      fontWeight: "800",
      color: c.text,
    },
    subtitle: {
      marginTop: 4,
      fontSize: 15,
      color: c.textTertiary,
      lineHeight: 20,
    },
    iconBtn: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: c.historyBtnBg,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: 16,
      paddingTop: 8,
      gap: 12,
      justifyContent: "space-between",
    },
    card: {
      width: "47.5%",
      backgroundColor: c.card,
      borderRadius: 16,
      padding: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      gap: 10,
      minHeight: 132,
    },
    cardPressed: {
      opacity: 0.92,
    },
    cardTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    iconBlob: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    cardTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: "800",
      color: c.text,
    },
    cardDesc: {
      fontSize: 13,
      color: c.placeholder,
      lineHeight: 18,
    },
    badge: {
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    badgeReady: {},
    badgeReadyText: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.4,
    },
    badgeSoon: {
      backgroundColor: c.inputBg,
    },
    badgeSoonText: {
      fontSize: 11,
      fontWeight: "800",
      color: c.textTertiary,
      letterSpacing: 0.4,
    },
  });
}

export default function ToolsDashboardScreen({ navigation }: ToolsDashboardProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark, toggleScheme } = useTheme();
  const styles = useMemo(() => createDashboardStyles(colors), [colors]);

  const onToolPress = (tool: ToolDefinition) => {
    if (tool.status !== "live") {
      navigation.navigate("ToolPlaceholder", { toolId: tool.id });
      return;
    }
    if (tool.id === "grocery") navigation.navigate("GroceryHome");
    if (tool.id === "todo") navigation.navigate("TodoHome");
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <View style={styles.headerTextCol}>
          <Text style={styles.title}>SayCart</Text>
          <Text style={styles.subtitle}>
            Choose a tool — matcha calm, orange energy for bulk moments.
          </Text>
        </View>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={toggleScheme}
          accessibilityRole="button"
          accessibilityLabel={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {TOOLS_CATALOG.map((tool) => (
            <Pressable
              key={tool.id}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => onToolPress(tool)}
            >
              <View style={styles.cardTop}>
                <View style={[styles.iconBlob, { backgroundColor: tool.dashboardIconBg }]}>
                  <Ionicons
                    name={tool.icon as ComponentProps<typeof Ionicons>["name"]}
                    size={22}
                    color={tool.dashboardIconFg}
                  />
                </View>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {tool.title}
                </Text>
              </View>
              <Text style={styles.cardDesc} numberOfLines={2}>
                {tool.description}
              </Text>
              <View
                style={[
                  styles.badge,
                  tool.status === "live" ? styles.badgeReady : styles.badgeSoon,
                  tool.status === "live" && {
                    backgroundColor: rgbaFromHex(tool.dashboardIconFg, 0.14),
                  },
                ]}
              >
                <Text
                  style={[
                    tool.status === "live" ? styles.badgeReadyText : styles.badgeSoonText,
                    tool.status === "live" && { color: tool.dashboardIconFg },
                  ]}
                >
                  {tool.status === "live" ? "READY" : "SOON"}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
