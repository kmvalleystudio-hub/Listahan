import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Modal, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../context/ThemeContext";
import { APP_DISPLAY_NAME } from "../constants/appBranding";

const DURATION_MS = 2400;

type Props = {
  visible: boolean;
  partnerLabel: string;
  onFinish: () => void;
};

export default function SyncConnectedOverlay({ visible, partnerLabel, onFinish }: Props) {
  const { colors } = useTheme();
  const backdrop = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.88)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const leftShift = useRef(new Animated.Value(-12)).current;
  const rightShift = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    if (!visible) return;

    backdrop.setValue(0);
    cardScale.setValue(0.88);
    cardOpacity.setValue(0);
    spin.setValue(0);
    pulse.setValue(0);
    leftShift.setValue(-12);
    rightShift.setValue(12);

    const anim = Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(cardScale, {
        toValue: 1,
        friction: 7,
        tension: 90,
        useNativeDriver: true,
      }),
      Animated.timing(leftShift, {
        toValue: 0,
        duration: 520,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }),
      Animated.timing(rightShift, {
        toValue: 0,
        duration: 520,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1,
            duration: 700,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 0,
            duration: 700,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.timing(spin, {
          toValue: 1,
          duration: 2200,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ),
    ]);

    anim.start();

    const done = setTimeout(() => {
      Animated.parallel([
        Animated.timing(backdrop, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) onFinish();
      });
    }, DURATION_MS);

    return () => {
      anim.stop();
      clearTimeout(done);
    };
  }, [
    visible,
    backdrop,
    cardOpacity,
    cardScale,
    leftShift,
    onFinish,
    partnerLabel,
    pulse,
    rightShift,
    spin,
  ]);

  const spinDeg = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });

  const pulseOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0],
  });

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
          gap: 10,
          marginBottom: 18,
        },
        deviceBubble: {
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: colors.inputBg,
          borderWidth: 2,
          borderColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
        },
        linkWrap: {
          width: 44,
          height: 44,
          alignItems: "center",
          justifyContent: "center",
        },
        pulseRing: {
          position: "absolute",
          width: 56,
          height: 56,
          borderRadius: 28,
          borderWidth: 2,
          borderColor: colors.primary,
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
          style={[
            styles.card,
            {
              opacity: cardOpacity,
              transform: [{ scale: cardScale }],
            },
          ]}
        >
          <View style={styles.iconRow}>
            <Animated.View style={{ transform: [{ translateX: leftShift }] }}>
              <View style={styles.deviceBubble}>
                <Ionicons name="phone-portrait-outline" size={26} color={colors.primaryDark} />
              </View>
            </Animated.View>

            <View style={styles.linkWrap}>
              <Animated.View
                style={[
                  styles.pulseRing,
                  {
                    opacity: pulseOpacity,
                    transform: [{ scale: pulseScale }],
                  },
                ]}
              />
              <Animated.View style={{ transform: [{ rotate: spinDeg }] }}>
                <Ionicons name="sync" size={32} color={colors.primary} />
              </Animated.View>
            </View>

            <Animated.View style={{ transform: [{ translateX: rightShift }] }}>
              <View style={styles.deviceBubble}>
                <Ionicons name="phone-portrait-outline" size={26} color={colors.primaryDark} />
              </View>
            </Animated.View>
          </View>

          <Text style={styles.title}>You're synced</Text>
          <Text style={styles.sub}>
            {partnerLabel} and you are now sharing {APP_DISPLAY_NAME} on both devices.
          </Text>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
