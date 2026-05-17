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
import Ionicons from "@expo/vector-icons/Ionicons";
import type { PrivateCreateListProps } from "../navigation/types";
import { useAppData } from "../context/AppDataContext";
import { useToolTheme } from "../hooks/useToolTheme";
import type { AppThemeColors } from "../theme/colors";
import PrivateVaultGate from "../components/PrivateVaultGate";

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
    headerBack: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      minWidth: 72,
    },
    headerTitle: { fontSize: 17, fontWeight: "700", color: c.text },
    link: { fontSize: 16, color: c.linkBlue, fontWeight: "600" },
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
    hint: { fontSize: 13, color: c.placeholder, lineHeight: 18 },
  });
}

export default function PrivateCreateListScreen({ navigation }: PrivateCreateListProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useToolTheme("private_list");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { createPrivateList } = useAppData();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const onCreate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const list = await createPrivateList(name);
      navigation.replace("PrivateListDetail", { listId: list.id, autoOpenAdd: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PrivateVaultGate>
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={styles.headerBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.linkBlue} />
          <Text style={styles.link}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New sheet</Text>
        <View style={{ width: 72 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Passwords, PINs, Recovery codes"
          placeholderTextColor={colors.placeholder}
          style={styles.input}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={onCreate}
        />
        <Text style={styles.hint}>
          Each entry can have a label, optional username or email, an optional secret (hidden), and optional
          notes. Data stays on this device.
        </Text>
        <TouchableOpacity
          style={[styles.primaryBtn, busy && { opacity: 0.7 }]}
          onPress={onCreate}
          disabled={busy}
        >
          <Text style={styles.primaryBtnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
    </PrivateVaultGate>
  );
}
