import React, { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppThemeColors } from "../theme/colors";

type Props = {
  visible: boolean;
  colors: AppThemeColors;
  initialName: string;
  fallbackName: string;
  onClose: () => void;
  onSave: (name: string) => void | Promise<void>;
  title?: string;
};

export default function ListRenameModal({
  visible,
  colors,
  initialName,
  fallbackName,
  onClose,
  onSave,
  title = "Rename list",
}: Props) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) {
      setBusy(false);
      return;
    }
    setName(initialName);
    const t = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelection(0, initialName.length);
    }, 120);
    return () => clearTimeout(t);
  }, [visible, initialName]);

  const handleClose = () => {
    if (busy) return;
    Keyboard.dismiss();
    onClose();
  };

  const handleSave = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const trimmed = name.trim();
      await onSave(trimmed || fallbackName);
      Keyboard.dismiss();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const styles = StyleSheet.create({
    root: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlayStrong },
    card: {
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 20,
      gap: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    title: { fontSize: 19, fontWeight: "800", color: colors.text },
    input: {
      backgroundColor: colors.inputBg,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actions: { flexDirection: "row", gap: 10, marginTop: 4 },
    btn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: "center",
      borderWidth: StyleSheet.hairlineWidth,
    },
    btnGhost: { backgroundColor: colors.inputBg, borderColor: colors.border },
    btnGhostText: { fontSize: 16, fontWeight: "700", color: colors.text },
    btnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
    btnPrimaryText: { fontSize: 16, fontWeight: "800", color: "#fff" },
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={[styles.root, { paddingBottom: Math.max(insets.bottom, 16) }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={fallbackName}
            placeholderTextColor={colors.placeholder}
            returnKeyType="done"
            onSubmitEditing={() => void handleSave()}
            editable={!busy}
            maxLength={120}
            accessibilityLabel="List name"
          />
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.btnGhost]}
              onPress={handleClose}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Cancel rename"
            >
              <Text style={styles.btnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={() => void handleSave()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Save name"
            >
              <Text style={styles.btnPrimaryText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
