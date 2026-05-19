import React, { useEffect, useMemo, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { AllDoneProps } from "../navigation/types";
import { useToolTheme, useToolStyles, useToolStylesWithArgs } from "../hooks/useToolTheme";
import type { ToolId } from "../constants/toolsCatalog";

export default function AllDoneScreen({ navigation, route }: AllDoneProps) {
  const insets = useSafeAreaInsets();
  const tool: ToolId = route.params.tool === "todo" ? "todo" : "grocery";
  const { colors } = useToolTheme(tool);

  const subtitle = useMemo(
    () =>
      tool === "todo"
        ? "Nice work — everything is checked off."
        : "Nice work — enjoy unpacking.",
    [tool]
  );

  const homeName = tool === "todo" ? "TodoHome" : "GroceryHome";
  const autoNavRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goHome = () => {
    if (autoNavRef.current) {
      clearTimeout(autoNavRef.current);
      autoNavRef.current = null;
    }
    navigation.navigate(homeName);
  };

  useEffect(() => {
    autoNavRef.current = setTimeout(() => {
      autoNavRef.current = null;
      navigation.navigate(homeName);
    }, 2800);
    return () => {
      if (autoNavRef.current) clearTimeout(autoNavRef.current);
    };
  }, [navigation, homeName]);

  return (
    <View
      style={[
        styles.screen,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom + 16,
          backgroundColor: colors.primaryDark,
        },
      ]}
    >
      <View style={[styles.topBar, { paddingHorizontal: 8 }]}>
        <TouchableOpacity
          style={styles.backRow}
          onPress={goHome}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color="rgba(255,255,255,0.95)" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.center}>
        <View style={styles.iconWrap}>
          <Ionicons name="checkmark" size={72} color="#fff" />
        </View>
        <Text style={styles.title}>All Done!</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <TouchableOpacity style={styles.btn} onPress={goHome}>
        <Text style={[styles.btnText, { color: colors.primaryDark }]}>
          {tool === "todo" ? "Back to To-dos" : "Back to Groceries"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 24,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 4,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  backText: {
    fontSize: 16,
    fontWeight: "600",
    color: "rgba(255,255,255,0.95)",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.55)",
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#fff",
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
  },
  btn: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  btnText: {
    fontSize: 17,
    fontWeight: "700",
  },
});
