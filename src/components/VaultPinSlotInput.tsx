import React, { useCallback, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type StyleProp,
  type TextInputKeyPressEventData,
  type ViewStyle,
} from "react-native";
import type { AppThemeColors } from "../theme/colors";
import { PIN_LENGTH_MAX } from "../utils/privateVaultPin";

export type VaultPinSlotInputProps = {
  value: string;
  onChangeValue: (value: string) => void;
  colors: AppThemeColors;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  onSubmitEditing?: () => void;
  style?: StyleProp<ViewStyle>;
};

export default function VaultPinSlotInput({
  value,
  onChangeValue,
  colors,
  placeholder = "Vault PIN",
  disabled = false,
  autoFocus = false,
  onFocus,
  onBlur,
  onSubmitEditing,
  style,
}: VaultPinSlotInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  const handlePinChange = useCallback(
    (text: string) => {
      const digits = text.replace(/\D/g, "");
      if (!digits) {
        onChangeValue(value.slice(0, -1));
        return;
      }
      if (digits.length === 1) {
        onChangeValue(value.length < PIN_LENGTH_MAX ? value + digits : value);
        return;
      }
      onChangeValue(digits.slice(0, PIN_LENGTH_MAX));
    },
    [onChangeValue, value]
  );

  const handlePinKeyPress = useCallback(
    (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      if (event.nativeEvent.key === "Backspace") {
        onChangeValue(value.slice(0, -1));
      }
    },
    [onChangeValue, value]
  );

  const styles = StyleSheet.create({
    field: {
      position: "relative",
      minHeight: 52,
      justifyContent: "center",
    },
    pinRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
    },
    pinSlot: {
      width: 40,
      height: 48,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.inputBg,
      alignItems: "center",
      justifyContent: "center",
    },
    pinSlotFocused: {
      borderColor: colors.primary,
      borderWidth: 1.5,
    },
    pinDot: {
      fontSize: 28,
      fontWeight: "700",
      color: colors.text,
      lineHeight: 32,
    },
    pinCursor: {
      width: 2,
      height: 24,
      borderRadius: 1,
      backgroundColor: colors.primary,
    },
    pinPlaceholder: {
      textAlign: "center",
      fontSize: 15,
      fontWeight: "500",
      color: colors.placeholder,
      marginBottom: 8,
    },
    pinInputHidden: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      opacity: 0,
      fontSize: 1,
      color: "transparent",
      ...(Platform.OS === "android" ? { underlineColorAndroid: "transparent" } : {}),
    },
  });

  return (
    <Pressable
      style={[styles.field, style]}
      onPress={() => !disabled && inputRef.current?.focus()}
      disabled={disabled}
    >
      {value.length === 0 && !focused ? (
        <Text style={styles.pinPlaceholder}>{placeholder}</Text>
      ) : null}
      <View style={styles.pinRow} pointerEvents="none">
        {Array.from({ length: PIN_LENGTH_MAX }, (_, index) => {
          const filled = index < value.length;
          const showCursor = focused && index === value.length;
          return (
            <View key={index} style={[styles.pinSlot, showCursor ? styles.pinSlotFocused : null]}>
              {filled ? (
                <Text style={styles.pinDot}>•</Text>
              ) : showCursor ? (
                <View style={styles.pinCursor} />
              ) : null}
            </View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        value=""
        onChangeText={handlePinChange}
        onKeyPress={handlePinKeyPress}
        style={styles.pinInputHidden}
        keyboardType="number-pad"
        editable={!disabled}
        onFocus={() => {
          setFocused(true);
          onFocus?.();
        }}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
        onSubmitEditing={onSubmitEditing}
        autoFocus={autoFocus}
        autoComplete="off"
        textContentType="none"
        importantForAutofill="no"
        autoCorrect={false}
        spellCheck={false}
        contextMenuHidden
        caretHidden
        showSoftInputOnFocus
      />
    </Pressable>
  );
}
