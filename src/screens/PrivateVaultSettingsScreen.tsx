import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Switch,
  Alert,
  Modal,
  TextInput,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
} from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { PrivateVaultSettingsProps } from "../navigation/types";
import { useToolTheme } from "../hooks/useToolTheme";
import type { AppThemeColors } from "../theme/colors";
import PrivateVaultGate from "../components/PrivateVaultGate";
import RecoveryQuestionPicker from "../components/RecoveryQuestionPicker";
import { RECOVERY_PRESETS } from "../constants/privateVaultRecovery";
import {
  getStoredPin,
  setStoredPin,
  isValidPinFormat,
  getBiometricsPreference,
  setBiometricsPreference,
  getRecoveryQuestion,
  setRecoverySecret,
  PIN_LENGTH_MIN,
  PIN_LENGTH_MAX,
} from "../utils/privateVaultPin";

function createStyles(c: AppThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingBottom: 12,
      gap: 12,
    },
    backBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 8 },
    backText: { fontSize: 16, fontWeight: "600", color: c.linkBlue },
    /** Do not use flex:1 on Text here — it causes broken glyph layout on some Android builds. */
    title: {
      fontSize: 22,
      fontWeight: "800",
      color: c.text,
      paddingHorizontal: 20,
      paddingBottom: 10,
    },
    section: { paddingHorizontal: 20, marginTop: 20 },
    sectionTitle: {
      fontSize: 12,
      fontWeight: "800",
      color: c.textTertiary,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      marginBottom: 10,
    },
    card: {
      backgroundColor: c.card,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      padding: 16,
      gap: 4,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingVertical: 8,
    },
    rowLabel: { fontSize: 16, fontWeight: "600", color: c.text, flex: 1 },
    rowHint: { fontSize: 13, color: c.placeholder, marginTop: 2 },
    btn: {
      marginTop: 12,
      backgroundColor: c.primaryDark,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
    },
    btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
    btnGhost: {
      marginTop: 10,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.inputBg,
    },
    btnGhostText: { fontSize: 16, fontWeight: "700", color: c.text },
    foot: { fontSize: 12, color: c.placeholder, marginTop: 24, paddingHorizontal: 20, lineHeight: 18 },
    modalRoot: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    modalCard: {
      backgroundColor: c.card,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      padding: 20,
      paddingBottom: 28,
    },
    modalTitle: { fontSize: 18, fontWeight: "800", color: c.text, marginBottom: 8 },
    input: {
      marginTop: 10,
      backgroundColor: c.inputBg,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: c.text,
    },
    pinInput: {
      marginTop: 10,
      backgroundColor: c.inputBg,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 20,
      letterSpacing: 3,
      color: c.text,
      textAlign: "center",
    },
  });
}

export default function PrivateVaultSettingsScreen({ navigation }: PrivateVaultSettingsProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useToolTheme("private_list");
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const [bioPref, setBioPref] = useState(true);
  const [bioHardware, setBioHardware] = useState(false);
  const [loadingPref, setLoadingPref] = useState(true);

  const [pinModal, setPinModal] = useState(false);
  const [curPin, setCurPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newPin2, setNewPin2] = useState("");
  const [pinBusy, setPinBusy] = useState(false);

  const [recModal, setRecModal] = useState(false);
  const [recCurPin, setRecCurPin] = useState("");
  const [recUseCustom, setRecUseCustom] = useState(false);
  const [recPresetIdx, setRecPresetIdx] = useState(0);
  const [recCustomQ, setRecCustomQ] = useState("");
  const [recAns, setRecAns] = useState("");
  const [recAns2, setRecAns2] = useState("");
  const [recBusy, setRecBusy] = useState(false);
  const [recoveryPreview, setRecoveryPreview] = useState<string | null>(null);

  const pinScrollRef = useRef<ScrollView>(null);
  const recScrollRef = useRef<ScrollView>(null);
  /** Shared keyboard inset while either settings modal is open (only one at a time). */
  const [modalKbInset, setModalKbInset] = useState(0);

  const modalKeyboardOpen = pinModal || recModal;

  useEffect(() => {
    if (!modalKeyboardOpen || Platform.OS === "web") {
      setModalKbInset(0);
      return;
    }
    const showEv = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEv = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const subShow = Keyboard.addListener(showEv, (e) => setModalKbInset(e.endCoordinates.height));
    const subHide = Keyboard.addListener(hideEv, () => setModalKbInset(0));
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [modalKeyboardOpen]);

  const scrollPinModalToEnd = useCallback(() => {
    requestAnimationFrame(() => pinScrollRef.current?.scrollToEnd({ animated: true }));
    setTimeout(() => pinScrollRef.current?.scrollToEnd({ animated: true }), 320);
  }, []);

  const scrollRecModalToEnd = useCallback(() => {
    requestAnimationFrame(() => recScrollRef.current?.scrollToEnd({ animated: true }));
    setTimeout(() => recScrollRef.current?.scrollToEnd({ animated: true }), 320);
  }, []);

  const loadPrefs = useCallback(async () => {
    setLoadingPref(true);
    try {
      const [pref, has, enrolled] = await Promise.all([
        getBiometricsPreference(),
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      setBioPref(pref);
      setBioHardware(Boolean(has && enrolled));
      const rq = await getRecoveryQuestion();
      setRecoveryPreview(rq);
    } finally {
      setLoadingPref(false);
    }
  }, []);

  useEffect(() => {
    void loadPrefs();
  }, [loadPrefs]);

  const onToggleBio = useCallback(
    async (next: boolean) => {
      if (!bioHardware && next) {
        Alert.alert("Not available", "Set up Face ID, Touch ID, or screen lock on this device first.");
        return;
      }
      setBioPref(next);
      await setBiometricsPreference(next);
    },
    [bioHardware]
  );

  const openPinModal = useCallback(() => {
    setCurPin("");
    setNewPin("");
    setNewPin2("");
    setPinModal(true);
  }, []);

  const submitPinChange = useCallback(async () => {
    const stored = await getStoredPin();
    if (stored !== curPin) {
      Alert.alert("Incorrect PIN", "Current PIN does not match.");
      return;
    }
    if (!isValidPinFormat(newPin)) {
      Alert.alert("PIN", `New PIN must be ${PIN_LENGTH_MIN}–${PIN_LENGTH_MAX} digits.`);
      return;
    }
    if (newPin !== newPin2) {
      Alert.alert("Mismatch", "New PIN entries must match.");
      return;
    }
    setPinBusy(true);
    try {
      await setStoredPin(newPin);
      Alert.alert("PIN updated", "Use your new PIN the next time the vault locks.");
      setPinModal(false);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not update PIN.");
    } finally {
      setPinBusy(false);
    }
  }, [curPin, newPin, newPin2]);

  const openRecModal = useCallback(() => {
    setRecCurPin("");
    setRecUseCustom(false);
    setRecPresetIdx(0);
    setRecCustomQ("");
    setRecAns("");
    setRecAns2("");
    setRecModal(true);
  }, []);

  const submitRecoveryUpdate = useCallback(async () => {
    const stored = await getStoredPin();
    if (stored !== recCurPin) {
      Alert.alert("Incorrect PIN", "Enter your current vault PIN to continue.");
      return;
    }
    const q = recUseCustom ? recCustomQ.trim() : RECOVERY_PRESETS[recPresetIdx] ?? RECOVERY_PRESETS[0];
    if (q.length < 4) {
      Alert.alert("Question", "Question must be at least 4 characters.");
      return;
    }
    if (recAns.trim().length < 2 || recAns !== recAns2) {
      Alert.alert("Answer", "Answers must match and be at least 2 characters.");
      return;
    }
    setRecBusy(true);
    try {
      await setRecoverySecret(q, recAns);
      setRecoveryPreview(q);
      Alert.alert("Saved", "Your recovery phrase was updated.");
      setRecModal(false);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not save.");
    } finally {
      setRecBusy(false);
    }
  }, [recCurPin, recUseCustom, recCustomQ, recPresetIdx, recAns, recAns2]);

  if (Platform.OS === "web") {
    return (
      <PrivateVaultGate>
        <View style={[styles.screen, { paddingTop: insets.top + 12, paddingHorizontal: 20 }]}>
          <Text style={styles.title}>Vault settings</Text>
          <Text style={{ marginTop: 12, color: colors.textTertiary }}>Private vault is not available on web.</Text>
          <TouchableOpacity style={[styles.btnGhost, { marginTop: 24 }]} onPress={() => navigation.goBack()}>
            <Text style={styles.btnGhostText}>Back</Text>
          </TouchableOpacity>
        </View>
      </PrivateVaultGate>
    );
  }

  return (
    <PrivateVaultGate>
      <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={22} color={colors.linkBlue} />
            <Text style={styles.backText}>Private lists</Text>
          </TouchableOpacity>
        </View>
        <Text
          style={styles.title}
          {...(Platform.OS === "android" ? { includeFontPadding: false } : {})}
        >
          Vault settings
        </Text>

        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Unlock</Text>
            <View style={styles.card}>
              {loadingPref ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>Face ID / Touch ID / device lock</Text>
                    <Text style={styles.rowHint}>
                      {bioHardware
                        ? "When off, only your app PIN unlocks private lists."
                        : "Biometrics are not available on this device."}
                    </Text>
                  </View>
                  <Switch
                    value={bioPref && bioHardware}
                    onValueChange={(v) => void onToggleBio(v)}
                    disabled={!bioHardware}
                  />
                </View>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PIN</Text>
            <View style={styles.card}>
              <Text style={styles.rowHint}>
                Change your vault PIN. You will need your current PIN. If you forgot it, use “Forgot PIN?” on the lock
                screen (recovery phrase required).
              </Text>
              <TouchableOpacity style={styles.btn} onPress={openPinModal} activeOpacity={0.9}>
                <Text style={styles.btnText}>Change PIN</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Forgot PIN</Text>
            <View style={styles.card}>
              <Text style={styles.rowHint}>
                {recoveryPreview
                  ? `Recovery is set: “${recoveryPreview.slice(0, 48)}${recoveryPreview.length > 48 ? "…" : ""}”`
                  : "No recovery phrase is stored yet. Set one below so you can reset your PIN from the lock screen."}
              </Text>
              <TouchableOpacity style={styles.btnGhost} onPress={openRecModal} activeOpacity={0.9}>
                <Text style={styles.btnGhostText}>Update recovery phrase</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.foot}>
            Private lists are stored on this device only. Your PIN and recovery answer are stored in the device keychain
            when supported, with a fallback store when not.
          </Text>
        </ScrollView>
      </View>

      <Modal visible={pinModal} transparent animationType="slide" onRequestClose={() => setPinModal(false)}>
        <View
          style={[
            styles.modalRoot,
            modalKbInset > 0 && { justifyContent: "flex-start", paddingTop: insets.top + 8 },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => !pinBusy && setPinModal(false)} />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 8 : 0}
            style={{ width: "100%", flex: 1, maxHeight: "100%" }}
          >
            <ScrollView
              ref={pinScrollRef}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.modalCard,
                { paddingBottom: insets.bottom + 28 + modalKbInset, flexGrow: 1 },
              ]}
            >
              <Text style={styles.modalTitle}>Change PIN</Text>
              <TextInput
                value={curPin}
                onChangeText={(t) => setCurPin(t.replace(/\D/g, "").slice(0, PIN_LENGTH_MAX))}
                style={styles.pinInput}
                placeholder="Current PIN"
                placeholderTextColor={colors.placeholder}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={PIN_LENGTH_MAX}
                editable={!pinBusy}
                onFocus={scrollPinModalToEnd}
              />
              <TextInput
                value={newPin}
                onChangeText={(t) => setNewPin(t.replace(/\D/g, "").slice(0, PIN_LENGTH_MAX))}
                style={styles.pinInput}
                placeholder="New PIN"
                placeholderTextColor={colors.placeholder}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={PIN_LENGTH_MAX}
                editable={!pinBusy}
                onFocus={scrollPinModalToEnd}
              />
              <TextInput
                value={newPin2}
                onChangeText={(t) => setNewPin2(t.replace(/\D/g, "").slice(0, PIN_LENGTH_MAX))}
                style={styles.pinInput}
                placeholder="Confirm new PIN"
                placeholderTextColor={colors.placeholder}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={PIN_LENGTH_MAX}
                editable={!pinBusy}
                onFocus={scrollPinModalToEnd}
              />
              <TouchableOpacity
                style={[styles.btn, { marginTop: 16 }, pinBusy && { opacity: 0.7 }]}
                onPress={() => void submitPinChange()}
                disabled={pinBusy}
              >
                <Text style={styles.btnText}>Save PIN</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnGhost} onPress={() => setPinModal(false)} disabled={pinBusy}>
                <Text style={styles.btnGhostText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={recModal} transparent animationType="slide" onRequestClose={() => setRecModal(false)}>
        <View
          style={[
            styles.modalRoot,
            modalKbInset > 0 && { justifyContent: "flex-start", paddingTop: insets.top + 8 },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => !recBusy && setRecModal(false)} />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 8 : 0}
            style={{ width: "100%", flex: 1, maxHeight: "100%" }}
          >
            <ScrollView
              ref={recScrollRef}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.modalCard,
                { paddingBottom: insets.bottom + 28 + modalKbInset, flexGrow: 1 },
              ]}
            >
              <Text style={styles.modalTitle}>Update recovery phrase</Text>
              <Text style={styles.rowHint}>Enter your current vault PIN first.</Text>
              <TextInput
                value={recCurPin}
                onChangeText={(t) => setRecCurPin(t.replace(/\D/g, "").slice(0, PIN_LENGTH_MAX))}
                style={styles.pinInput}
                placeholder="Current PIN"
                placeholderTextColor={colors.placeholder}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={PIN_LENGTH_MAX}
                editable={!recBusy}
                onFocus={scrollRecModalToEnd}
              />
              <RecoveryQuestionPicker
                colors={colors}
                label="New question"
                useCustom={recUseCustom}
                presetIndex={recPresetIdx}
                customQuestion={recCustomQ}
                onSelectPreset={(i) => {
                  setRecUseCustom(false);
                  setRecPresetIdx(i);
                }}
                onSelectCustomMode={() => setRecUseCustom(true)}
                onChangeCustomQuestion={setRecCustomQ}
                placeholderTextColor={colors.placeholder}
                onCustomQuestionFocus={scrollRecModalToEnd}
              />
              <Text style={[styles.sectionTitle, { marginTop: 12 }]}>New answer</Text>
              <TextInput
                value={recAns}
                onChangeText={setRecAns}
                style={styles.input}
                placeholder="Answer"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="none"
                editable={!recBusy}
                onFocus={scrollRecModalToEnd}
              />
              <TextInput
                value={recAns2}
                onChangeText={setRecAns2}
                style={styles.input}
                placeholder="Confirm answer"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="none"
                editable={!recBusy}
                onFocus={scrollRecModalToEnd}
              />
              <TouchableOpacity
                style={[styles.btn, { marginTop: 16 }, recBusy && { opacity: 0.7 }]}
                onPress={() => void submitRecoveryUpdate()}
                disabled={recBusy}
              >
                <Text style={styles.btnText}>Save recovery phrase</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnGhost} onPress={() => setRecModal(false)} disabled={recBusy}>
                <Text style={styles.btnGhostText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </PrivateVaultGate>
  );
}
