import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Keyboard,
} from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { useToolTheme } from "../hooks/useToolTheme";
import type { AppThemeColors } from "../theme/colors";
import { usePrivateVault } from "../context/PrivateVaultContext";
import {
  getStoredPin,
  isValidPinFormat,
  setStoredPin,
  PIN_LENGTH_MAX,
  PIN_LENGTH_MIN,
  setRecoverySecret,
  getRecoveryQuestion,
  hasRecoverySecret,
  verifyRecoveryAnswer,
  getBiometricsPreference,
  setBiometricsPreference,
} from "../utils/privateVaultPin";
import { RECOVERY_PRESETS } from "../constants/privateVaultRecovery";
import RecoveryQuestionPicker from "./RecoveryQuestionPicker";

function createGateStyles(c: AppThemeColors) {
  return StyleSheet.create({
    root: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: c.background,
      zIndex: 9999,
      elevation: 9999,
    },
    keyboard: { flex: 1 },
    scrollContent: {
      flexGrow: 1,
      justifyContent: "flex-end",
      paddingHorizontal: 24,
    },
    iconWrap: {
      width: 72,
      height: 72,
      borderRadius: 22,
      backgroundColor: c.iconBlobBg,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "center",
      marginBottom: 20,
    },
    title: { fontSize: 22, fontWeight: "800", color: c.text, textAlign: "center" },
    subtitle: {
      marginTop: 8,
      fontSize: 15,
      color: c.textTertiary,
      textAlign: "center",
      lineHeight: 22,
    },
    pinInput: {
      marginTop: 12,
      backgroundColor: c.inputBg,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 22,
      letterSpacing: 4,
      color: c.text,
      textAlign: "center",
    },
    textInput: {
      marginTop: 10,
      backgroundColor: c.inputBg,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: c.text,
    },
    primaryBtn: {
      marginTop: 16,
      backgroundColor: c.primary,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: "center",
    },
    primaryBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
    secondaryBtn: {
      marginTop: 12,
      paddingVertical: 14,
      alignItems: "center",
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
    },
    secondaryBtnText: { fontSize: 16, fontWeight: "700", color: c.text },
    hint: { marginTop: 16, fontSize: 13, color: c.placeholder, textAlign: "center", lineHeight: 18 },
    rowGap: { marginTop: 8 },
    linkBtn: { marginTop: 14, paddingVertical: 8, alignItems: "center" },
    linkText: { fontSize: 15, fontWeight: "700", color: c.primary },
    sectionLabel: {
      marginTop: 14,
      fontSize: 12,
      fontWeight: "800",
      color: c.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
  });
}

async function authenticateWithBiometrics(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const has = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!has || !enrolled) return false;
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock private lists",
      fallbackLabel: "Use PIN",
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
    });
    return r.success;
  } catch {
    return false;
  }
}

type Props = {
  children: React.ReactNode;
};

type ForgotPhase = "idle" | "answer" | "reset";

export default function PrivateVaultGate({ children }: Props) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { colors } = useToolTheme("private_list");
  const styles = React.useMemo(() => createGateStyles(colors), [colors]);
  const { ready, hasPin, unlocked, unlock, refreshHasPin } = usePrivateVault();

  const [setupStep, setSetupStep] = useState<1 | 2 | 3>(1);
  const [createPin, setCreatePin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [recoveryPresetIdx, setRecoveryPresetIdx] = useState(0);
  const [recoveryUseCustom, setRecoveryUseCustom] = useState(false);
  const [recoveryCustomQ, setRecoveryCustomQ] = useState("");
  const [recoveryAnswer, setRecoveryAnswer] = useState("");
  const [recoveryConfirm, setRecoveryConfirm] = useState("");

  const [unlockPin, setUnlockPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [prefBioUnlock, setPrefBioUnlock] = useState<boolean | null>(null);

  const [forgotPhase, setForgotPhase] = useState<ForgotPhase>("idle");
  const [forgotAnswer, setForgotAnswer] = useState("");
  const [recoveryQDisplay, setRecoveryQDisplay] = useState<string | null>(null);

  const [frPin, setFrPin] = useState("");
  const [frConfirm, setFrConfirm] = useState("");
  const [frUseCustom, setFrUseCustom] = useState(false);
  const [frPresetIdx, setFrPresetIdx] = useState(0);
  const [frCustomQ, setFrCustomQ] = useState("");
  const [frAns, setFrAns] = useState("");
  const [frAns2, setFrAns2] = useState("");

  const scrollRef = useRef<ScrollView>(null);
  const [kbPad, setKbPad] = useState(0);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const showEv = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEv = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const subShow = Keyboard.addListener(showEv, (e) => setKbPad(e.endCoordinates.height));
    const subHide = Keyboard.addListener(hideEv, () => setKbPad(0));
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  const scrollFormToEnd = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 280);
  }, []);

  useEffect(() => {
    if (Platform.OS === "web" || !ready) return;
    let cancelled = false;
    void (async () => {
      const has = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!cancelled) setBioAvailable(Boolean(has && enrolled));
    })();
    return () => {
      cancelled = true;
    };
  }, [ready]);

  useEffect(() => {
    if (!ready || !hasPin || Platform.OS === "web") {
      setPrefBioUnlock(null);
      return;
    }
    let cancelled = false;
    void getBiometricsPreference().then((v) => {
      if (!cancelled) setPrefBioUnlock(v);
    });
    return () => {
      cancelled = true;
    };
  }, [ready, hasPin]);

  const resetCreateForm = useCallback(() => {
    setSetupStep(1);
    setCreatePin("");
    setConfirmPin("");
    setRecoveryPresetIdx(0);
    setRecoveryUseCustom(false);
    setRecoveryCustomQ("");
    setRecoveryAnswer("");
    setRecoveryConfirm("");
  }, []);

  const resetForgotForm = useCallback(() => {
    setForgotPhase("idle");
    setForgotAnswer("");
    setRecoveryQDisplay(null);
    setFrPin("");
    setFrConfirm("");
    setFrUseCustom(false);
    setFrPresetIdx(0);
    setFrCustomQ("");
    setFrAns("");
    setFrAns2("");
  }, []);

  const tryBiometricUnlock = useCallback(async () => {
    if (busy || !hasPin) return;
    const pref = await getBiometricsPreference();
    if (!pref) {
      Alert.alert("Biometrics off", "Turn on Face ID / Touch ID in Private lists → Settings.");
      return;
    }
    setBusy(true);
    try {
      const ok = await authenticateWithBiometrics();
      if (ok) unlock();
    } finally {
      setBusy(false);
    }
  }, [busy, hasPin, unlock]);

  /** Auto biometric only when preference allows and user is not in forgot-PIN flow. */
  useEffect(() => {
    if (
      !isFocused ||
      !ready ||
      unlocked ||
      !hasPin ||
      Platform.OS === "web" ||
      forgotPhase !== "idle" ||
      prefBioUnlock !== true
    ) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const ok = await authenticateWithBiometrics();
      if (!cancelled && ok) unlock();
    })();
    return () => {
      cancelled = true;
    };
  }, [isFocused, ready, unlocked, hasPin, unlock, forgotPhase, prefBioUnlock]);

  const effectiveRecoveryQuestion = useCallback(() => {
    if (recoveryUseCustom) return recoveryCustomQ.trim();
    return RECOVERY_PRESETS[recoveryPresetIdx] ?? RECOVERY_PRESETS[0];
  }, [recoveryUseCustom, recoveryCustomQ, recoveryPresetIdx]);

  const continueSetupFromPin = useCallback(() => {
    if (!isValidPinFormat(createPin)) {
      Alert.alert("PIN length", `Use ${PIN_LENGTH_MIN}–${PIN_LENGTH_MAX} digits (numbers only).`);
      return;
    }
    if (createPin !== confirmPin) {
      Alert.alert("PIN mismatch", "Both PIN entries must match.");
      return;
    }
    setSetupStep(2);
  }, [createPin, confirmPin]);

  const finalizeVaultSetup = useCallback(
    async (enableBiometrics: boolean) => {
      setBusy(true);
      try {
        const q = effectiveRecoveryQuestion();
        await setStoredPin(createPin);
        await setRecoverySecret(q, recoveryAnswer);
        await setBiometricsPreference(Boolean(enableBiometrics && bioAvailable));
        await refreshHasPin();
        resetCreateForm();
        unlock();
      } catch (e) {
        Alert.alert("Could not save vault", e instanceof Error ? e.message : "Try again.");
      } finally {
        setBusy(false);
      }
    },
    [
      createPin,
      recoveryAnswer,
      effectiveRecoveryQuestion,
      bioAvailable,
      refreshHasPin,
      unlock,
      resetCreateForm,
    ]
  );

  const continueSetupFromRecovery = useCallback(() => {
    const q = effectiveRecoveryQuestion();
    if (q.length < 4) {
      Alert.alert("Question", "Pick a preset or enter a custom question (at least 4 characters).");
      return;
    }
    if (recoveryAnswer.trim().length < 2) {
      Alert.alert("Answer", "Answer must be at least 2 characters.");
      return;
    }
    if (recoveryAnswer !== recoveryConfirm) {
      Alert.alert("Answer mismatch", "Both answer fields must match.");
      return;
    }
    if (bioAvailable) setSetupStep(3);
    else void finalizeVaultSetup(false);
  }, [effectiveRecoveryQuestion, recoveryAnswer, recoveryConfirm, bioAvailable, finalizeVaultSetup]);

  const onStartForgot = useCallback(async () => {
    const has = await hasRecoverySecret();
    if (!has) {
      Alert.alert(
        "No recovery phrase",
        "You have not set a secret question yet. Open Private lists (after unlocking with your PIN if you remember it), go to Settings, and add recovery there—or you will need to clear app data to reset the vault."
      );
      return;
    }
    const q = await getRecoveryQuestion();
    setRecoveryQDisplay(q);
    setForgotPhase("answer");
    setForgotAnswer("");
  }, []);

  const onVerifyForgotAnswer = useCallback(async () => {
    const ok = await verifyRecoveryAnswer(forgotAnswer);
    if (!ok) {
      Alert.alert("Incorrect answer", "Try again or cancel and use your PIN.");
      return;
    }
    setForgotPhase("reset");
    setFrPin("");
    setFrConfirm("");
    setFrUseCustom(false);
    setFrPresetIdx(0);
    setFrCustomQ("");
    setFrAns("");
    setFrAns2("");
  }, [forgotAnswer]);

  const effectiveForgotRecoveryQuestion = useCallback(() => {
    if (frUseCustom) return frCustomQ.trim();
    return RECOVERY_PRESETS[frPresetIdx] ?? RECOVERY_PRESETS[0];
  }, [frUseCustom, frCustomQ, frPresetIdx]);

  const onCompleteForgotReset = useCallback(async () => {
    if (!isValidPinFormat(frPin)) {
      Alert.alert("PIN length", `Use ${PIN_LENGTH_MIN}–${PIN_LENGTH_MAX} digits (numbers only).`);
      return;
    }
    if (frPin !== frConfirm) {
      Alert.alert("PIN mismatch", "Both new PIN entries must match.");
      return;
    }
    const q = effectiveForgotRecoveryQuestion();
    if (q.length < 4) {
      Alert.alert("Question", "Pick a preset or enter a custom question (at least 4 characters).");
      return;
    }
    if (frAns.trim().length < 2) {
      Alert.alert("Answer", "Answer must be at least 2 characters.");
      return;
    }
    if (frAns !== frAns2) {
      Alert.alert("Answer mismatch", "Both answer fields must match.");
      return;
    }
    setBusy(true);
    try {
      await setStoredPin(frPin);
      await setRecoverySecret(q, frAns);
      await refreshHasPin();
      resetForgotForm();
      setUnlockPin("");
      unlock();
    } catch (e) {
      Alert.alert("Could not reset PIN", e instanceof Error ? e.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }, [frPin, frConfirm, frAns, frAns2, effectiveForgotRecoveryQuestion, refreshHasPin, unlock, resetForgotForm]);

  const onUnlockWithPin = useCallback(async () => {
    if (!isValidPinFormat(unlockPin)) {
      Alert.alert("PIN", `Enter your ${PIN_LENGTH_MIN}–${PIN_LENGTH_MAX} digit PIN.`);
      return;
    }
    setBusy(true);
    try {
      const stored = await getStoredPin();
      if (stored === unlockPin) {
        setUnlockPin("");
        unlock();
      } else {
        Alert.alert("Incorrect PIN", "Try again or use biometrics if enabled.");
      }
    } finally {
      setBusy(false);
    }
  }, [unlockPin, unlock]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (Platform.OS === "web") {
    return <>{children}</>;
  }

  const showCreate = !hasPin;

  const headerTitle = (() => {
    if (showCreate) {
      if (setupStep === 1) return "Create a vault PIN";
      if (setupStep === 2) return "Secret question";
      return "Quick unlock";
    }
    if (forgotPhase === "answer") return "Forgot PIN";
    if (forgotPhase === "reset") return "Choose a new PIN";
    return "Private lists locked";
  })();

  const headerSubtitle = (() => {
    if (showCreate) {
      if (setupStep === 1) {
        return `Step 1 of ${bioAvailable ? 3 : 2}: choose a ${PIN_LENGTH_MIN}–${PIN_LENGTH_MAX} digit PIN (numbers only).`;
      }
      if (setupStep === 2) {
        return "Step 2: if you forget your PIN, you can reset it with this answer. Answers are not case-sensitive.";
      }
      return "Step 3: use Face ID, Touch ID, or device passcode to unlock faster when available.";
    }
    if (forgotPhase === "answer") {
      return "Answer your recovery question to set a new PIN and a new recovery phrase.";
    }
    if (forgotPhase === "reset") {
      return "Pick a new PIN and a new secret question for next time.";
    }
    return "Confirm your identity to view passwords and private notes stored on this device.";
  })();

  const lockLayer = isFocused && !unlocked ? (
    <View style={styles.root} pointerEvents="auto">
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior="padding"
        keyboardVerticalOffset={insets.top}
      >
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + 16,
              paddingBottom: insets.bottom + 24 + kbPad,
              justifyContent: kbPad > 0 ? ("flex-start" as const) : ("flex-end" as const),
            },
          ]}
        >
          <View style={{ alignItems: "center", marginBottom: 20 }}>
            <View style={styles.iconWrap}>
              <Ionicons name="lock-closed" size={36} color={colors.iconBlobFg} />
            </View>
            <Text style={styles.title}>{headerTitle}</Text>
            <Text style={styles.subtitle}>{headerSubtitle}</Text>
          </View>

          {showCreate && setupStep === 1 ? (
            <View>
              <TextInput
                value={createPin}
                onChangeText={(t) => setCreatePin(t.replace(/\D/g, "").slice(0, PIN_LENGTH_MAX))}
                style={[styles.pinInput, { marginTop: 0 }]}
                placeholder={`${PIN_LENGTH_MIN}–${PIN_LENGTH_MAX} digits`}
                placeholderTextColor={colors.placeholder}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={PIN_LENGTH_MAX}
                editable={!busy}
              />
              <Text style={[styles.hint, styles.rowGap]}>Confirm PIN</Text>
              <TextInput
                value={confirmPin}
                onChangeText={(t) => setConfirmPin(t.replace(/\D/g, "").slice(0, PIN_LENGTH_MAX))}
                style={styles.pinInput}
                placeholder="Re-enter PIN"
                placeholderTextColor={colors.placeholder}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={PIN_LENGTH_MAX}
                editable={!busy}
              />
              <TouchableOpacity
                style={[styles.primaryBtn, busy && { opacity: 0.7 }]}
                onPress={continueSetupFromPin}
                disabled={busy}
              >
                <Text style={styles.primaryBtnText}>Continue</Text>
              </TouchableOpacity>
              {busy ? <ActivityIndicator style={{ marginTop: 16 }} color={colors.primary} /> : null}
            </View>
          ) : null}

          {showCreate && setupStep === 2 ? (
            <View>
              <RecoveryQuestionPicker
                colors={colors}
                useCustom={recoveryUseCustom}
                presetIndex={recoveryPresetIdx}
                customQuestion={recoveryCustomQ}
                onSelectPreset={(i) => {
                  setRecoveryUseCustom(false);
                  setRecoveryPresetIdx(i);
                }}
                onSelectCustomMode={() => setRecoveryUseCustom(true)}
                onChangeCustomQuestion={setRecoveryCustomQ}
                placeholderTextColor={colors.placeholder}
                onCustomQuestionFocus={scrollFormToEnd}
              />
              <Text style={styles.sectionLabel}>Your answer</Text>
              <TextInput
                value={recoveryAnswer}
                onChangeText={setRecoveryAnswer}
                style={styles.textInput}
                placeholder="Answer (not case-sensitive)"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy}
                onFocus={scrollFormToEnd}
              />
              <Text style={[styles.hint, styles.rowGap]}>Confirm answer</Text>
              <TextInput
                value={recoveryConfirm}
                onChangeText={setRecoveryConfirm}
                style={styles.textInput}
                placeholder="Re-enter answer"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy}
                onFocus={scrollFormToEnd}
              />
              <TouchableOpacity
                style={[styles.primaryBtn, busy && { opacity: 0.7 }]}
                onPress={() => void continueSetupFromRecovery()}
                disabled={busy}
              >
                <Text style={styles.primaryBtnText}>{bioAvailable ? "Continue" : "Save and continue"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => setSetupStep(1)}
                disabled={busy}
              >
                <Text style={styles.secondaryBtnText}>Back</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {showCreate && setupStep === 3 ? (
            <View>
              <Text style={styles.hint}>
                Allow Face ID, Touch ID, or your device passcode to unlock private lists? You can change this later
                in Settings.
              </Text>
              <TouchableOpacity
                style={[styles.primaryBtn, busy && { opacity: 0.7 }]}
                onPress={() => void finalizeVaultSetup(true)}
                disabled={busy}
              >
                <Text style={styles.primaryBtnText}>Yes, use biometrics</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryBtn, busy && { opacity: 0.7 }]}
                onPress={() => void finalizeVaultSetup(false)}
                disabled={busy}
              >
                <Text style={styles.secondaryBtnText}>Not now</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setSetupStep(2)} disabled={busy}>
                <Text style={styles.secondaryBtnText}>Back</Text>
              </TouchableOpacity>
              {busy ? <ActivityIndicator style={{ marginTop: 16 }} color={colors.primary} /> : null}
            </View>
          ) : null}

          {!showCreate && forgotPhase === "answer" ? (
            <View>
              <Text style={[styles.hint, { textAlign: "left", marginTop: 0 }]}>
                {recoveryQDisplay ?? "Your question"}
              </Text>
              <TextInput
                value={forgotAnswer}
                onChangeText={setForgotAnswer}
                style={styles.textInput}
                placeholder="Your answer"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy}
                onFocus={scrollFormToEnd}
              />
              <TouchableOpacity
                style={[styles.primaryBtn, busy && { opacity: 0.7 }]}
                onPress={() => void onVerifyForgotAnswer()}
                disabled={busy}
              >
                <Text style={styles.primaryBtnText}>Verify</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.linkBtn} onPress={resetForgotForm} disabled={busy}>
                <Text style={styles.linkText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {!showCreate && forgotPhase === "reset" ? (
            <View>
              <Text style={styles.sectionLabel}>New PIN</Text>
              <TextInput
                value={frPin}
                onChangeText={(t) => setFrPin(t.replace(/\D/g, "").slice(0, PIN_LENGTH_MAX))}
                style={[styles.pinInput, { marginTop: 4 }]}
                placeholder={`${PIN_LENGTH_MIN}–${PIN_LENGTH_MAX} digits`}
                placeholderTextColor={colors.placeholder}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={PIN_LENGTH_MAX}
                editable={!busy}
              />
              <Text style={[styles.hint, styles.rowGap]}>Confirm new PIN</Text>
              <TextInput
                value={frConfirm}
                onChangeText={(t) => setFrConfirm(t.replace(/\D/g, "").slice(0, PIN_LENGTH_MAX))}
                style={styles.pinInput}
                placeholder="Re-enter new PIN"
                placeholderTextColor={colors.placeholder}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={PIN_LENGTH_MAX}
                editable={!busy}
              />
              <RecoveryQuestionPicker
                colors={colors}
                label="New question"
                useCustom={frUseCustom}
                presetIndex={frPresetIdx}
                customQuestion={frCustomQ}
                onSelectPreset={(i) => {
                  setFrUseCustom(false);
                  setFrPresetIdx(i);
                }}
                onSelectCustomMode={() => setFrUseCustom(true)}
                onChangeCustomQuestion={setFrCustomQ}
                placeholderTextColor={colors.placeholder}
                onCustomQuestionFocus={scrollFormToEnd}
              />
              <Text style={styles.sectionLabel}>New answer</Text>
              <TextInput
                value={frAns}
                onChangeText={setFrAns}
                style={styles.textInput}
                placeholder="Answer"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy}
                onFocus={scrollFormToEnd}
              />
              <Text style={[styles.hint, styles.rowGap]}>Confirm answer</Text>
              <TextInput
                value={frAns2}
                onChangeText={setFrAns2}
                style={styles.textInput}
                placeholder="Re-enter answer"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy}
                onFocus={scrollFormToEnd}
              />
              <TouchableOpacity
                style={[styles.primaryBtn, busy && { opacity: 0.7 }]}
                onPress={() => void onCompleteForgotReset()}
                disabled={busy}
              >
                <Text style={styles.primaryBtnText}>Save new PIN</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.linkBtn} onPress={resetForgotForm} disabled={busy}>
                <Text style={styles.linkText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {!showCreate && forgotPhase === "idle" ? (
            <View>
              {bioAvailable && prefBioUnlock ? (
                <TouchableOpacity
                  style={[styles.primaryBtn, { marginTop: 0 }, busy && { opacity: 0.7 }]}
                  onPress={() => void tryBiometricUnlock()}
                  disabled={busy}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Ionicons name="finger-print" size={22} color="#fff" />
                    <Text style={styles.primaryBtnText}>Use biometrics / device lock</Text>
                  </View>
                </TouchableOpacity>
              ) : null}
              <Text style={[styles.hint, bioAvailable && prefBioUnlock ? { marginTop: 16 } : { marginTop: 0 }]}>
                {bioAvailable && prefBioUnlock ? "Or enter your app PIN:" : "Enter your app PIN:"}
              </Text>
              <TextInput
                value={unlockPin}
                onChangeText={(t) => setUnlockPin(t.replace(/\D/g, "").slice(0, PIN_LENGTH_MAX))}
                style={styles.pinInput}
                placeholder={`${PIN_LENGTH_MIN}–${PIN_LENGTH_MAX} digits`}
                placeholderTextColor={colors.placeholder}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={PIN_LENGTH_MAX}
                editable={!busy}
                onSubmitEditing={() => void onUnlockWithPin()}
              />
              <TouchableOpacity
                style={[styles.primaryBtn, busy && { opacity: 0.7 }]}
                onPress={() => void onUnlockWithPin()}
                disabled={busy}
              >
                <Text style={styles.primaryBtnText}>Unlock</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.linkBtn} onPress={() => void onStartForgot()} disabled={busy}>
                <Text style={styles.linkText}>Forgot PIN?</Text>
              </TouchableOpacity>
              {busy ? <ActivityIndicator style={{ marginTop: 16 }} color={colors.primary} /> : null}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  ) : null;

  return (
    <View style={{ flex: 1 }}>
      {children}
      {lockLayer}
    </View>
  );
}
