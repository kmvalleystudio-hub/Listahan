import React, { useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { AllDoneProps } from "../navigation/types";

export default function AllDoneScreen({ navigation }: AllDoneProps) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const t = setTimeout(() => {
      navigation.navigate("Home");
    }, 2800);
    return () => clearTimeout(t);
  }, [navigation]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.center}>
        <View style={styles.iconWrap}>
          <Ionicons name="checkmark" size={72} color="#fff" />
        </View>
        <Text style={styles.title}>All Done!</Text>
        <Text style={styles.subtitle}>Nice work — enjoy unpacking.</Text>
      </View>

      <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate("Home")}>
        <Text style={styles.btnText}>Back to Lists</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#16a34a",
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
    color: "#15803d",
  },
});
