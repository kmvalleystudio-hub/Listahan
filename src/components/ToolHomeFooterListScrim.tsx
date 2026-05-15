import { useId } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from "react-native-svg";

const DEFAULT_FADE_HEIGHT = 128;

/** Solid #RRGGBB for SVG stops — alpha must use `stopOpacity` (rgba in stopColor is unreliable on Android). */
function hexRgbForGradient(hex: string): string {
  const h = hex.trim();
  if (h.startsWith("#") && h.length === 7) return h;
  return "#0b1220";
}

type Props = {
  isDark: boolean;
  /** Screen background (matches scroll area behind the list). */
  backgroundColor: string;
  /**
   * Distance from the **parent** bottom to the **bottom** edge of this overlay
   * (align with the top of the Add CTA): `insets.bottom + footerPadding + buttonHeight`.
   */
  bottomOffset: number;
  /** Vertical extent of the fade; taller = softer handoff. */
  fadeHeight?: number;
};

/**
 * Absolute overlay on top of the scrollable list: **transparent at the top** (0% opacity),
 * fading to **solid screen background at the bottom** (100% opacity) so rows dissolve
 * under the floating Add pill instead of a hard cut-off. (Dark mode only.)
 */
export function ToolHomeFooterListScrim({
  isDark,
  backgroundColor,
  bottomOffset,
  fadeHeight = DEFAULT_FADE_HEIGHT,
}: Props) {
  const reactId = useId();
  const gradId = `footerListScrim-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const base = hexRgbForGradient(backgroundColor);

  if (!isDark) return null;

  return (
    <View
      pointerEvents="none"
      style={[styles.overlay, { height: fadeHeight, bottom: bottomOffset }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <SvgLinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
            <Stop offset="0" stopColor={base} stopOpacity={0} />
            <Stop offset="0.42" stopColor={base} stopOpacity={0.22} />
            <Stop offset="0.72" stopColor={base} stopOpacity={0.62} />
            <Stop offset="1" stopColor={base} stopOpacity={1} />
          </SvgLinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradId})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 4,
  },
});
