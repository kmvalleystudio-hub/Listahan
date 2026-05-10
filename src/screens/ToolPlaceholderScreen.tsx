import React, { useMemo, type ComponentProps } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { ToolPlaceholderProps } from "../navigation/types";
import { TOOLS_CATALOG } from "../constants/toolsCatalog";
import { useToolTheme } from "../hooks/useToolTheme";
import type { AppThemeColors } from "../theme/colors";

function createStyles(c: AppThemeColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.background,
      paddingHorizontal: 24,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingBottom: 8,
      gap: 8,
    },
    back: {
      flexDirection: "row",
      alignItems: "center",
      padding: 8,
      marginLeft: -8,
    },
    backText: {
      fontSize: 16,
      fontWeight: "600",
      color: c.text,
    },
    blob: {
      width: 72,
      height: 72,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "center",
      marginTop: 32,
    },
    title: {
      marginTop: 20,
      fontSize: 26,
      fontWeight: "800",
      color: c.text,
      textAlign: "center",
    },
    body: {
      marginTop: 12,
      fontSize: 16,
      color: c.textTertiary,
      textAlign: "center",
      lineHeight: 22,
    },
    btn: {
      marginTop: 32,
      backgroundColor: c.primary,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: "center",
    },
    btnText: {
      color: "#fff",
      fontSize: 17,
      fontWeight: "700",
    },
  });
}

export default function ToolPlaceholderScreen({ navigation, route }: ToolPlaceholderProps) {
  const insets = useSafeAreaInsets();
  const toolId = route.params.toolId;
  const { colors } = useToolTheme(toolId);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const def = TOOLS_CATALOG.find((t) => t.id === toolId);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.blob, { backgroundColor: def?.dashboardIconBg ?? colors.iconBlobBg }]}>
        <Ionicons
          name={(def?.icon ?? "cube") as ComponentProps<typeof Ionicons>["name"]}
          size={36}
          color={def?.dashboardIconFg ?? colors.iconBlobFg}
        />
      </View>
      <Text style={styles.title}>{def?.title ?? "Coming soon"}</Text>
      <Text style={styles.body}>
        {def?.tagline ?? "This tool is on the roadmap."} We will ship it when the experience feels
        great end-to-end.
      </Text>

      <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()} activeOpacity={0.9}>
        <Text style={styles.btnText}>Back to tools</Text>
      </TouchableOpacity>
    </View>
  );
}
