import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { RECOVERY_PRESETS } from "../constants/privateVaultRecovery";
import type { AppThemeColors } from "../theme/colors";

type Props = {
  colors: AppThemeColors;
  /** Field label above the dropdown */
  label?: string;
  useCustom: boolean;
  presetIndex: number;
  customQuestion: string;
  onSelectPreset: (index: number) => void;
  onSelectCustomMode: () => void;
  onChangeCustomQuestion: (q: string) => void;
  placeholderTextColor: string;
  /** When the custom-question field is focused (e.g. scroll parent above keyboard). */
  onCustomQuestionFocus?: () => void;
};

export default function RecoveryQuestionPicker({
  colors,
  label = "Question",
  useCustom,
  presetIndex,
  customQuestion,
  onSelectPreset,
  onSelectCustomMode,
  onChangeCustomQuestion,
  placeholderTextColor,
  onCustomQuestionFocus,
}: Props) {
  const [open, setOpen] = useState(false);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        sectionLabel: {
          marginTop: 4,
          fontSize: 12,
          fontWeight: "800",
          color: colors.textTertiary,
          textTransform: "uppercase",
          letterSpacing: 0.6,
        },
        dropdown: {
          marginTop: 10,
          minHeight: 48,
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.inputBg,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        },
        dropdownText: {
          flex: 1,
          fontSize: 15,
          fontWeight: "600",
          color: colors.text,
        },
        customInput: {
          marginTop: 10,
          backgroundColor: colors.inputBg,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontSize: 16,
          color: colors.text,
        },
        sheetBackdrop: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: "flex-end",
        },
        sheet: {
          backgroundColor: colors.card,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          maxHeight: "70%",
          paddingBottom: 20,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        sheetTitle: {
          paddingHorizontal: 18,
          paddingTop: 16,
          paddingBottom: 8,
          fontSize: 16,
          fontWeight: "800",
          color: colors.text,
        },
        optionRow: {
          paddingHorizontal: 18,
          paddingVertical: 14,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.borderMuted,
        },
        optionText: { fontSize: 16, color: colors.text, fontWeight: "500" },
        optionAccent: { fontSize: 16, color: colors.primaryDark, fontWeight: "700" },
      }),
    [colors]
  );

  const summary = useCustom
    ? customQuestion.trim() || "Custom question…"
    : RECOVERY_PRESETS[presetIndex] ?? RECOVERY_PRESETS[0];

  return (
    <View>
      <Text style={styles.sectionLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.dropdown}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Choose security question"
      >
        <Text style={styles.dropdownText} numberOfLines={3}>
          {summary}
        </Text>
        <Ionicons name="chevron-down" size={22} color={colors.textTertiary} />
      </TouchableOpacity>

      {useCustom ? (
        <TextInput
          value={customQuestion}
          onChangeText={onChangeCustomQuestion}
          style={styles.customInput}
          placeholder="Type your custom question"
          placeholderTextColor={placeholderTextColor}
          onFocus={() => onCustomQuestionFocus?.()}
        />
      ) : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.sheetBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Security question</Text>
            <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
              {RECOVERY_PRESETS.map((p, i) => (
                <TouchableOpacity
                  key={p}
                  style={styles.optionRow}
                  onPress={() => {
                    onSelectPreset(i);
                    setOpen(false);
                  }}
                >
                  <Text style={styles.optionText}>{p}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.optionRow}
                onPress={() => {
                  onSelectCustomMode();
                  setOpen(false);
                }}
              >
                <Text style={styles.optionAccent}>Custom question…</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
