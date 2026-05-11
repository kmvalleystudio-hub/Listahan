import React from "react";
import { Animated, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

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
  overlayStyle,
  textStyle,
  suggestMarkStyle,
  successMarkStyle,
}: Props) {
  if (suggestSpan) {
    const { start, end } = clampSpan(text.length, suggestSpan);
    const before = text.slice(0, start);
    const mid = text.slice(start, end);
    const after = text.slice(end);
    return (
      <View pointerEvents="none" style={overlayStyle}>
        <Text style={textStyle} selectable={false}>
          {before}
          <Text style={[textStyle, suggestMarkStyle]}>{mid}</Text>
          {after}
        </Text>
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
        <Text style={textStyle} selectable={false}>
          {before}
          <Animated.Text style={[textStyle, successMarkStyle, { opacity: flashOpacity }]}>{mid}</Animated.Text>
          {after}
        </Text>
      </View>
    );
  }
  return null;
}
