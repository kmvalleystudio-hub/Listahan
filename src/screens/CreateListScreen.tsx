import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CreateListProps } from "../navigation/types";
import { useAppData } from "../context/AppDataContext";

export default function CreateListScreen({ navigation }: CreateListProps) {
  const insets = useSafeAreaInsets();
  const { createList } = useAppData();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const onCreate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const list = await createList(name);
      navigation.replace("ListDetail", { listId: list.id });
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.link}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New list</Text>
        <View style={{ width: 56 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.label}>List name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Weekend groceries"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={onCreate}
        />
        <TouchableOpacity
          style={[styles.primaryBtn, busy && { opacity: 0.7 }]}
          onPress={onCreate}
          disabled={busy}
        >
          <Text style={styles.primaryBtnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f4f6f8",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
  },
  link: {
    fontSize: 16,
    color: "#2563eb",
    fontWeight: "600",
    width: 56,
  },
  body: {
    padding: 20,
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#0f172a",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: "#2563eb",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
});
