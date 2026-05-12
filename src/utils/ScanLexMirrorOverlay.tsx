import React from "react";
import { Animated, Platform, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

const mirrorTextMetrics =
  Platform.OS === "android" ? ({ includeFontPadding: false } satisfies TextStyle) : null;

export type ScanLexSpan = { start: number; end: number };

function clampSpan(textLen: number, span: ScanLexSpan): ScanLexSpan {
  const start = Math.max(0, Math.min(span.start, textLen));
  const end = Math.max(start, Math.min(span.end, textLen));
  return { start, end };
}

type Props = {
  text: string;
  suggestSpan: ScanLexSpan | null;
  flashSpan: ScanLexSpan | null;
  flashOpacity: Animated.Value;
  /** Match multiline `TextInput` `contentOffset.y` so the mirror shows the same lines as the field. */
  contentScrollY: number;
  overlayStyle: StyleProp<ViewStyle>;
  textStyle: StyleProp<TextStyle>;
  suggestMarkStyle: StyleProp<TextStyle>;
  successMarkStyle: StyleProp<TextStyle>;
};

export function ScanLexMirrorOverlay({
  text,
  suggestSpan,
  flashSpan,
  flashOpacity,
  contentScrollY,
  overlayStyle,
  textStyle,
  suggestMarkStyle,
  successMarkStyle,
}: Props) {
  const shiftStyle = { transform: [{ translateY: -contentScrollY }] };

  if (suggestSpan) {
    const { start, end } = clampSpan(text.length, suggestSpan);
    const before = text.slice(0, start);
    const mid = text.slice(start, end);
    const after = text.slice(end);
    return (
      <View pointerEvents="none" style={overlayStyle}>
        <View style={shiftStyle}>
          <Text style={[textStyle, mirrorTextMetrics]} selectable={false}>
            {before}
            <Text style={[textStyle, mirrorTextMetrics, suggestMarkStyle]}>{mid}</Text>
            {after}
          </Text>
        </View>
      </View>
    );
  }
  if (flashSpan) {
    const { start, end } = clampSpan(text.length, flashSpan);
    const before = text.slice(0, start);
    const mid = text.slice(start, end);
    const after = text.slice(end);
    return (
      <View pointerEvents="none" style={overlayStyle}>
        <View style={shiftStyle}>
          <Text style={[textStyle, mirrorTextMetrics]} selectable={false}>
            {before}
            <Animated.Text style={[textStyle, mirrorTextMetrics, successMarkStyle, { opacity: flashOpacity }]}>
              {mid}
            </Animated.Text>
            {after}
          </Text>
        </View>
      </View>
    );
  }
  return null;
}
