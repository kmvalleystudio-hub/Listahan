import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from "react-native";

type AnyStyle = ViewStyle | TextStyle | ImageStyle;
type StyleRecord = Record<string, AnyStyle>;

let fontMultiplier = 1;

export function setStyleSheetFontMultiplier(multiplier: number): void {
  fontMultiplier = multiplier;
}

function scaleLength(value: number, multiplier: number): number {
  return Math.round(value * multiplier);
}

function scaleStyle(style: AnyStyle, multiplier: number): AnyStyle {
  if (!style || typeof style !== "object" || Array.isArray(style)) {
    return style;
  }

  const next: TextStyle & ViewStyle = { ...style };
  const text = style as TextStyle;
  if (typeof text.fontSize === "number") {
    next.fontSize = scaleLength(text.fontSize, multiplier);
  }
  if (typeof text.lineHeight === "number") {
    next.lineHeight = scaleLength(text.lineHeight, multiplier);
  }
  return next;
}

function scaleStyleRecord(styles: StyleRecord, multiplier: number): StyleRecord {
  const scaled: StyleRecord = {};
  for (const [key, value] of Object.entries(styles)) {
    scaled[key] = scaleStyle(value, multiplier);
  }
  return scaled;
}

const originalCreate = StyleSheet.create.bind(StyleSheet);

StyleSheet.create = <T extends StyleSheet.NamedStyles<T>>(styles: T): T => {
  if (fontMultiplier === 1) {
    return originalCreate(styles);
  }
  return originalCreate(scaleStyleRecord(styles as StyleRecord, fontMultiplier) as T);
};
