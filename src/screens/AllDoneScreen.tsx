import React, { useEffect, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { AllDoneProps } from "../navigation/types";
import { useToolTheme } from "../hooks/useToolTheme";
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

  useEffect(() => {
    const t = setTimeout(() => {
      navigation.navigate(homeName);
    }, 2800);
    return () => clearTimeout(t);
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
      <View style={styles.center}>
        <View style={styles.iconWrap}>
          <Ionicons name="checkmark" size={72} color="#fff" />
        </View>
        <Text style={styles.title}>All Done!</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <TouchableOpacity
        style={styles.btn}
        onPress={() => navigation.navigate(homeName)}
      >
        <Text style={[styles.btnText, { color: colors.primaryDark }]}>Back to Lists</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 24,
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
