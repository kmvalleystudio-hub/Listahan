import { Platform, type ViewStyle } from "react-native";
import type { AppThemeColors } from "./colors";

export const TOOL_HOME_FLOATING_ADD_BTN_RADIUS = 16;

/** Used to align the list fade overlay with the top edge of the Add CTA (paddingVertical 16 + text/icon row). */
export const TOOL_HOME_FOOTER_ADD_CTA_HEIGHT = 54;

/**
 * Pull the fade overlay slightly closer to the screen bottom than the raw CTA height math so the
 * gradient meets the pill with no hairline gap (font scale / platform layout variance).
 */
export const TOOL_HOME_FOOTER_LIST_FADE_PULLDOWN = 10;

/** `bottom` style for {@link ToolHomeFooterListScrim}: flush with Add pill top. */
export function toolHomeListFadeBottomOffset(insetsBottom: number): number {
  return insetsBottom + 16 + TOOL_HOME_FOOTER_ADD_CTA_HEIGHT - TOOL_HOME_FOOTER_LIST_FADE_PULLDOWN;
}

/**
 * Wrapper for the bottom Add pill in dark mode: upward-biased primary glow on iOS
 * so the CTA reads above the list where they meet (Android relies on elevation + list scrim).
 */
export function toolHomeFloatingAddButtonUpwardGlowWrap(isDark: boolean, c: AppThemeColors): ViewStyle {
  if (!isDark) return {};
  if (Platform.OS === "android") {
    return { alignSelf: "stretch", borderRadius: TOOL_HOME_FLOATING_ADD_BTN_RADIUS };
  }
  return {
    alignSelf: "stretch",
    borderRadius: TOOL_HOME_FLOATING_ADD_BTN_RADIUS,
    shadowColor: c.primary,
    shadowOpacity: 0.4,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: -10 },
  };
}

/**
 * Subtle neutral drop shadow under the Add CTA in dark mode (avoids a heavy colored halo
 * pooling on the system nav bar). Primary “lift” is handled by {@link toolHomeFloatingAddButtonUpwardGlowWrap}.
 */
export function toolHomeFloatingAddButtonDarkLift(isDark: boolean, c: AppThemeColors): ViewStyle {
  if (!isDark) return {};
  /** Keep downward shadow subtle and neutral so it does not pool under the system nav bar. */
  return {
    shadowColor: c.shadow,
    shadowOpacity: Platform.OS === "android" ? 0.22 : 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: Platform.OS === "android" ? 10 : 10,
  };
}
