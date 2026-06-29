import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { AppThemeColors } from "../theme/colors";
import {
  APP_FONT_FAMILY_OPTIONS,
  previewFontFamilyForId,
  type AppFontFamilyId,
} from "../theme/appFontFamilies";

type Props = {
  colors: AppThemeColors;
  value: AppFontFamilyId;
  onValueChange: (id: AppFontFamilyId) => void;
  disabled?: boolean;
};

function optionLabel(option: (typeof APP_FONT_FAMILY_OPTIONS)[number]): string {
  return `${option.label} (${option.hint})`;
}

export default function FontFamilyPicker({ colors, value, onValueChange, disabled = false }: Props) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const selected = APP_FONT_FAMILY_OPTIONS.find((o) => o.id === value) ?? APP_FONT_FAMILY_OPTIONS[0]!;
  const selectedPreview = previewFontFamilyForId(selected.id);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        trigger: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          borderRadius: 12,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: colors.inputBg,
          paddingHorizontal: 14,
          paddingVertical: 12,
          opacity: disabled ? 0.45 : 1,
        },
        triggerPressed: { opacity: 0.85 },
        triggerText: {
          flex: 1,
          minWidth: 0,
          fontSize: 16,
          fontWeight: "600",
          color: colors.text,
        },
        modalBackdrop: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: "rgba(0,0,0,0.45)",
        },
        modalSheet: {
          backgroundColor: colors.card,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          paddingTop: 18,
          paddingHorizontal: 16,
          maxHeight: "70%",
        },
        modalTitle: {
          fontSize: 18,
          fontWeight: "800",
          color: colors.text,
          marginBottom: 12,
        },
        option: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          paddingVertical: 14,
          paddingHorizontal: 12,
          borderRadius: 12,
          marginBottom: 6,
        },
        optionActive: {
          backgroundColor: colors.inputBg,
        },
        optionText: {
          flex: 1,
          fontSize: 16,
          fontWeight: "600",
          color: colors.text,
        },
        optionTextActive: {
          color: colors.linkBlue,
        },
      }),
    [colors]
  );

  return (
    <>
      <Pressable
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, pressed && !disabled && styles.triggerPressed]}
        accessibilityRole="button"
        accessibilityLabel={`Font, ${optionLabel(selected)}`}
        accessibilityState={{ expanded: open, disabled }}
      >
        <Text
          style={[styles.triggerText, selectedPreview ? { fontFamily: selectedPreview } : null]}
          numberOfLines={1}
        >
          {optionLabel(selected)}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.linkBlue} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1 }}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss font picker"
          />
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.modalTitle}>Choose font</Text>
            <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
              {APP_FONT_FAMILY_OPTIONS.map((option) => {
                const isSelected = option.id === value;
                const previewFamily = previewFontFamilyForId(option.id);
                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[styles.option, isSelected && styles.optionActive]}
                    onPress={() => {
                      onValueChange(option.id);
                      setOpen(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        previewFamily ? { fontFamily: previewFamily } : null,
                        isSelected && styles.optionTextActive,
                      ]}
                    >
                      {optionLabel(option)}
                    </Text>
                    {isSelected ? (
                      <Ionicons name="checkmark" size={22} color={colors.linkBlue} />
                    ) : (
                      <View style={{ width: 22 }} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
