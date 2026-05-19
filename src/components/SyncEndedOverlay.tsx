import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Modal, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../context/ThemeContext";

const DURATION_MS = 2400;

type Props = {
  visible: boolean;
  onFinish: () => void;
};

export default function SyncEndedOverlay({ visible, onFinish }: Props) {
  const { colors } = useTheme();
  const backdrop = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.9)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0.6)).current;
  const leftShift = useRef(new Animated.Value(0)).current;
  const rightShift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    backdrop.setValue(0);
    cardScale.setValue(0.9);
    cardOpacity.setValue(0);
    iconScale.setValue(0.6);
    leftShift.setValue(0);
    rightShift.setValue(0);

    const anim = Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(cardScale, {
        toValue: 1,
        friction: 7,
        tension: 90,
        useNativeDriver: true,
      }),
      Animated.spring(iconScale, {
        toValue: 1,
        friction: 6,
        tension: 100,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(180),
        Animated.parallel([
          Animated.timing(leftShift, {
            toValue: -14,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(rightShift, {
            toValue: 14,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]);

    anim.start();

    const done = setTimeout(() => {
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) onFinish();
      });
    }, DURATION_MS);

    return () => {
      anim.stop();
      clearTimeout(done);
    };
  }, [visible, backdrop, cardOpacity, cardScale, iconScale, leftShift, onFinish, rightShift]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.52)",
          alignItems: "center",
          justifyContent: "center",
          padding: 28,
        },
        card: {
          width: "100%",
          maxWidth: 320,
          backgroundColor: colors.card,
          borderRadius: 22,
          paddingVertical: 28,
          paddingHorizontal: 22,
          alignItems: "center",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        iconRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          marginBottom: 18,
        },
        deviceBubble: {
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: colors.inputBg,
          borderWidth: 2,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
        },
        unlinkWrap: {
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: "rgba(220, 38, 38, 0.14)",
          alignItems: "center",
          justifyContent: "center",
        },
        title: {
          fontSize: 22,
          fontWeight: "800",
          color: colors.text,
          textAlign: "center",
        },
        sub: {
          marginTop: 10,
          fontSize: 15,
          fontWeight: "500",
          color: colors.textSecondary,
          textAlign: "center",
          lineHeight: 22,
        },
      }),
    [colors]
  );

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onFinish}>
      <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
        <Animated.View
          style={[styles.card, { opacity: cardOpacity, transform: [{ scale: cardScale }] }]}
        >
          <View style={styles.iconRow}>
            <Animated.View style={{ transform: [{ translateX: leftShift }] }}>
              <View style={styles.deviceBubble}>
                <Ionicons name="phone-portrait-outline" size={24} color={colors.textSecondary} />
              </View>
            </Animated.View>

            <Animated.View style={[styles.unlinkWrap, { transform: [{ scale: iconScale }] }]}>
              <Ionicons name="unlink-outline" size={30} color={colors.danger} />
            </Animated.View>

            <Animated.View style={{ transform: [{ translateX: rightShift }] }}>
              <View style={styles.deviceBubble}>
                <Ionicons name="phone-portrait-outline" size={24} color={colors.textSecondary} />
              </View>
            </Animated.View>
          </View>

          <Text style={styles.title}>Sync ended</Text>
          <Text style={styles.sub}>You are no longer synced.</Text>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
