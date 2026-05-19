import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppThemeColors } from "../theme/colors";
import { getStoredPin, isValidPinFormat, PIN_LENGTH_MAX } from "../utils/privateVaultPin";
import VaultPinSlotInput from "./VaultPinSlotInput";

type Props = {
  visible: boolean;
  colors: AppThemeColors;
  onClose: () => void;
  onVerified: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
};

export default function VaultSyncPinConfirmModal({
  visible,
  colors,
  onClose,
  onVerified,
  title = "Confirm with PIN",
  message = "Enter your vault PIN to include Vault sheets in this sync. Biometrics cannot be used for this step.",
  confirmLabel = "Continue",
}: Props) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [kbInset, setKbInset] = useState(0);

  useEffect(() => {
    if (!visible) {
      setPin("");
      setBusy(false);
      return;
    }
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => setKbInset(e.endCoordinates.height)
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKbInset(0)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, [visible]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const handleClose = useCallback(() => {
    if (busy) return;
    setPin("");
    onClose();
  }, [busy, onClose]);

  const submit = useCallback(async () => {
    if (pin.length !== PIN_LENGTH_MAX || !isValidPinFormat(pin)) {
      Alert.alert("PIN", `Enter all ${PIN_LENGTH_MAX} digits of your vault PIN.`);
      return;
    }
    setBusy(true);
    try {
      const stored = await getStoredPin();
      if (stored !== pin) {
        Alert.alert("Incorrect PIN", "Enter your vault PIN to include Vault in this sync.");
        return;
      }
      setPin("");
      onVerified();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not verify PIN.");
    } finally {
      setBusy(false);
    }
  }, [onVerified, pin]);

  const styles = StyleSheet.create({
    root: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
    card: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      paddingHorizontal: 20,
      paddingTop: 20,
    },
    title: { fontSize: 18, fontWeight: "800", color: colors.text },
    hint: {
      marginTop: 10,
      fontSize: 14,
      fontWeight: "500",
      color: colors.textSecondary,
      lineHeight: 20,
    },
    btn: {
      marginTop: 16,
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
    },
    btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
    btnGhost: {
      marginTop: 10,
      paddingVertical: 12,
      alignItems: "center",
    },
    btnGhostText: { color: colors.textSecondary, fontSize: 15, fontWeight: "600" },
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={handleClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 8 : 0}
        >
          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.card, { paddingBottom: insets.bottom + 24 + kbInset }]}
          >
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.hint}>{message}</Text>
            <VaultPinSlotInput
              value={pin}
              onChangeValue={setPin}
              colors={colors}
              placeholder="Vault PIN"
              disabled={busy}
              autoFocus={visible}
              onFocus={scrollToEnd}
              style={{ marginTop: 16 }}
            />
            <TouchableOpacity
              style={[styles.btn, busy && { opacity: 0.7 }]}
              onPress={() => void submit()}
              disabled={busy}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{confirmLabel}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnGhost} onPress={handleClose} disabled={busy}>
              <Text style={styles.btnGhostText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
