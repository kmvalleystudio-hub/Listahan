import React, { useCallback, useMemo, useRef } from "react";
import { View, Text, StyleSheet, Pressable, Animated, StatusBar as RNStatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { WelcomeProps } from "../navigation/types";
import { useTheme } from "../context/ThemeContext";
import type { AppThemeColors } from "../theme/colors";
import { APP_DISPLAY_NAME } from "../constants/appBranding";
import ListahanOnboardingFooter from "../components/ListahanOnboardingFooter";
import { useAppStyles } from "../hooks/useAppStyles";

const GRID_PAD = 24;

function createStyles(c: AppThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    body: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: GRID_PAD,
      gap: 16,
    },
    iconCircle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: c.iconBlobBg,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      marginBottom: 4,
    },
    iconInner: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      fontSize: 28,
      fontWeight: "800",
      color: c.text,
      textAlign: "center",
    },
    username: { color: c.primaryDark },
    subtitle: {
      fontSize: 16,
      color: c.placeholder,
      textAlign: "center",
      lineHeight: 24,
      maxWidth: 340,
    },
    cta: {
      marginTop: 8,
      alignSelf: "stretch",
      maxWidth: 320,
      borderRadius: 16,
      paddingVertical: 16,
      paddingHorizontal: 24,
      backgroundColor: c.primary,
      alignItems: "center",
    },
    ctaPressed: { opacity: 0.9 },
    ctaLabel: { color: "#fff", fontSize: 17, fontWeight: "800" },
  });
}

export default function WelcomeScreen({ navigation, route }: WelcomeProps) {
  const insets = useSafeAreaInsets();
  const { colors, scheme } = useTheme();
  const styles = useAppStyles(createStyles);
  const username = route.params.username.trim();

  const ringScale = useRef(new Animated.Value(0)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;

  const playWelcomeCheckAnimation = useCallback(() => {
    ringScale.setValue(0);
    ringOpacity.setValue(0);
    checkScale.setValue(0);
    Animated.sequence([
      Animated.parallel([
        Animated.spring(ringScale, {
          toValue: 1,
          tension: 58,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(ringOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]),
      Animated.spring(checkScale, {
        toValue: 1,
        tension: 72,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [checkScale, ringOpacity, ringScale]);

  useFocusEffect(
    useCallback(() => {
      RNStatusBar.setBarStyle(scheme === "dark" ? "light-content" : "dark-content");
      playWelcomeCheckAnimation();
    }, [scheme, playWelcomeCheckAnimation])
  );

  const goToDashboard = () => {
    navigation.reset({ index: 0, routes: [{ name: "ToolsDashboard" }] });
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
      <View style={styles.body}>
        <Animated.View
          style={[
            styles.iconCircle,
            { opacity: ringOpacity, transform: [{ scale: ringScale }] },
          ]}
        >
          <Animated.View
            style={[
              styles.iconInner,
              { backgroundColor: colors.primary, transform: [{ scale: checkScale }] },
            ]}
          >
            <Ionicons name="checkmark" size={34} color="#fff" />
          </Animated.View>
        </Animated.View>
        <Text style={styles.title} accessibilityRole="header">
          Welcome{username ? ", " : ""}
          {username ? <Text style={styles.username}>{username}</Text> : null}
        </Text>
        <Text style={styles.subtitle}>
          You&apos;re set up on {APP_DISPLAY_NAME}. Start with groceries, to-dos, notes, or reminders — everything stays
          on this device until you choose to share.
        </Text>
        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          onPress={goToDashboard}
          accessibilityRole="button"
          accessibilityLabel="Get started"
        >
          <Text style={styles.ctaLabel}>Get started</Text>
        </Pressable>
      </View>

      <ListahanOnboardingFooter
        colors={colors}
        variant="light"
        paddingBottom={Math.max(insets.bottom, 18)}
      />
    </View>
  );
}
