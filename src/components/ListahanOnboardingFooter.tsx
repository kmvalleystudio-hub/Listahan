import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Image, useWindowDimensions, Platform } from "react-native";
import type { AppThemeColors } from "../theme/colors";
import { APP_DISPLAY_NAME } from "../constants/appBranding";

const LISTAHAN_LOGO_ON_DARK = require("../../assets/branding/listahan-logo-horizontal-on-dark.png");
const LISTAHAN_LOGO_ON_LIGHT = require("../../assets/branding/listahan-logo-horizontal.png");
const LISTAHAN_LOGO_ASPECT_FALLBACK = 2316.07 / 506.96;

/** Readable footer mark on onboarding screens (username setup, welcome). */
export const ONBOARDING_FOOTER_LOGO_HEIGHT = 32.4;

const GRID_PAD = 20;

function createStyles(c: AppThemeColors) {
  return StyleSheet.create({
    footer: {
      alignItems: "center",
      paddingHorizontal: GRID_PAD + 8,
      paddingTop: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.borderMuted,
      gap: 10,
    },
    footerLogoWrap: { opacity: 0.94 },
    footerLogoImage: { width: "100%", height: "100%" },
    footerTagline: {
      fontSize: 13,
      color: c.textSecondary,
      textAlign: "center",
      lineHeight: 19,
      paddingHorizontal: 8,
    },
    footerMicro: {
      fontSize: 11,
      color: c.placeholder,
      textAlign: "center",
    },
  });
}

type Props = {
  colors: AppThemeColors;
  variant?: "dark" | "light";
  logoHeight?: number;
  paddingBottom?: number;
};

export default function ListahanOnboardingFooter({
  colors,
  variant = "dark",
  logoHeight = ONBOARDING_FOOTER_LOGO_HEIGHT,
  paddingBottom = 18,
}: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const logoSource = variant === "dark" ? LISTAHAN_LOGO_ON_DARK : LISTAHAN_LOGO_ON_LIGHT;

  const [logoAspect, setLogoAspect] = useState(LISTAHAN_LOGO_ASPECT_FALLBACK);
  useEffect(() => {
    const src = Image.resolveAssetSource(logoSource);
    const uri = src?.uri;
    if (!uri) return;
    Image.getSize(
      uri,
      (w, h) => {
        if (w > 0 && h > 0) setLogoAspect(w / h);
      },
      () => {}
    );
  }, [logoSource]);

  const footerLogoWidth = Math.min(windowWidth - GRID_PAD * 2 - 16, logoHeight * logoAspect);

  return (
    <View style={[styles.footer, { paddingBottom: Math.max(paddingBottom, 12) }]}>
      <View style={[styles.footerLogoWrap, { width: footerLogoWidth, height: logoHeight }]}>
        <Image
          source={logoSource}
          style={styles.footerLogoImage}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
          accessibilityLabel={`${APP_DISPLAY_NAME} logo`}
        />
      </View>
      <Text style={styles.footerTagline}>
        Groceries, to-dos & reminders — private by default, yours on every device you choose later.
      </Text>
      <Text style={styles.footerMicro}>
        {APP_DISPLAY_NAME} © {new Date().getFullYear()}
      </Text>
    </View>
  );
}
