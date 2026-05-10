import React, { useMemo, useState } from "react";
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
import type { TodoCreateListProps } from "../navigation/types";
import { useAppData } from "../context/AppDataContext";
import { useToolTheme } from "../hooks/useToolTheme";
import type { AppThemeColors } from "../theme/colors";

function createStyles(c: AppThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    headerTitle: { fontSize: 17, fontWeight: "700", color: c.text },
    link: { fontSize: 16, color: c.linkBlue, fontWeight: "600", width: 56 },
    body: { padding: 20, gap: 12 },
    label: { fontSize: 14, fontWeight: "600", color: c.textSecondary },
    input: {
      backgroundColor: c.card,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: c.text,
      borderWidth: 1,
      borderColor: c.border,
    },
    primaryBtn: {
      marginTop: 8,
      backgroundColor: c.primary,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: "center",
    },
    primaryBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  });
}

export default function TodoCreateListScreen({ navigation }: TodoCreateListProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useToolTheme("todo");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { createTodoList } = useAppData();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const onCreate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const list = await createTodoList(name);
      navigation.replace("TodoListDetail", { listId: list.id, autoOpenAdd: true });
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
        <Text style={styles.headerTitle}>New to-do list</Text>
        <View style={{ width: 56 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.label}>List name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Weekend errands"
          placeholderTextColor={colors.placeholder}
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
