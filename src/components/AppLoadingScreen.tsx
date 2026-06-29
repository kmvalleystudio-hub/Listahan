import React from "react";
import { View, Image, StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import { APP_DISPLAY_NAME } from "../constants/appBranding";
import { useImageAspectRatio } from "../hooks/useImageAspectRatio";

const LISTAHAN_LOGO_LIGHT = require("../../assets/branding/listahan-logo-horizontal.png");
const LISTAHAN_LOGO_DARK = require("../../assets/branding/listahan-logo-horizontal-on-dark.png");
const LOGO_ASPECT_FALLBACK = 2316.07 / 506.96;

/** Centered launch mark — readable on phones without dominating the screen. */
const LOGO_HEIGHT = 44;
const MAX_LOGO_WIDTH_RATIO = 0.78;

export default function AppLoadingScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const logoSource = isDark ? LISTAHAN_LOGO_DARK : LISTAHAN_LOGO_LIGHT;
  const logoAspect = useImageAspectRatio(logoSource, LOGO_ASPECT_FALLBACK);
  const logoWidth = Math.min(windowWidth * MAX_LOGO_WIDTH_RATIO, LOGO_HEIGHT * logoAspect);

  return (
    <View
      style={[styles.screen, { backgroundColor: colors.background, paddingBottom: insets.bottom }]}
      accessibilityRole="progressbar"
      accessibilityLabel={`Loading ${APP_DISPLAY_NAME}`}
    >
      <View style={[styles.logoWrap, { width: logoWidth, height: LOGO_HEIGHT }]}>
        <Image
          source={logoSource}
          style={styles.logo}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
          accessibilityLabel={`${APP_DISPLAY_NAME} logo`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrap: { opacity: 0.98 },
  logo: { width: "100%", height: "100%" },
});
