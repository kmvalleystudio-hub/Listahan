import React, { useCallback, useMemo, useRef, useState } from "react";
import { LayoutChangeEvent, PanResponder, Pressable, StyleSheet, View } from "react-native";
import type { AppThemeColors } from "../theme/colors";
import {
  DEFAULT_FONT_SIZE_LEVEL,
  FONT_SIZE_LEVEL_MAX,
  FONT_SIZE_LEVEL_MIN,
} from "../theme/appearanceStorage";

const THUMB_SIZE = 28;
const TRACK_HEIGHT = 4;
const TICK_HEIGHT = 10;

type Props = {
  colors: AppThemeColors;
  value: number;
  onValueChange: (level: number) => void;
  disabled?: boolean;
};

function clampOffset(offset: number, travel: number): number {
  return Math.min(travel, Math.max(0, offset));
}

function offsetForLevel(level: number, travel: number): number {
  if (travel <= 0) return 0;
  const ratio = (level - FONT_SIZE_LEVEL_MIN) / (FONT_SIZE_LEVEL_MAX - FONT_SIZE_LEVEL_MIN);
  return ratio * travel;
}

function levelFromOffset(offsetX: number, travel: number): number {
  if (travel <= 0) return DEFAULT_FONT_SIZE_LEVEL;
  const ratio = Math.min(1, Math.max(0, offsetX / travel));
  return (
    FONT_SIZE_LEVEL_MIN +
    Math.round(ratio * (FONT_SIZE_LEVEL_MAX - FONT_SIZE_LEVEL_MIN))
  );
}

export default function FontSizeStepSlider({ colors, value, onValueChange, disabled = false }: Props) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dragThumbLeft, setDragThumbLeft] = useState(0);

  const level = Math.min(FONT_SIZE_LEVEL_MAX, Math.max(FONT_SIZE_LEVEL_MIN, Math.round(value)));
  const travel = Math.max(0, trackWidth - THUMB_SIZE);
  const dragStartOffset = useRef(0);
  const levelRef = useRef(level);
  levelRef.current = level;

  const restingThumbLeft = useMemo(
    () => offsetForLevel(level, travel),
    [level, travel]
  );

  const thumbLeft = dragging ? dragThumbLeft : restingThumbLeft;
  const previewLevel = dragging ? levelFromOffset(thumbLeft, travel) : level;

  const commitLevel = useCallback(
    (offset: number) => {
      if (disabled) return;
      onValueChange(levelFromOffset(offset, travel));
    },
    [disabled, onValueChange, travel]
  );

  const onTrackLayout = useCallback((e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  }, []);

  const handleTrackPress = useCallback(
    (x: number) => {
      if (disabled || trackWidth <= 0) return;
      const offset = clampOffset(x - THUMB_SIZE / 2, travel);
      commitLevel(offset);
    },
    [commitLevel, disabled, trackWidth, travel]
  );

  const panHandlers = useMemo(() => {
    if (disabled) return {};
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        const start = offsetForLevel(levelRef.current, travel);
        dragStartOffset.current = start;
        setDragThumbLeft(start);
        setDragging(true);
      },
      onPanResponderMove: (_, gesture) => {
        setDragThumbLeft(clampOffset(dragStartOffset.current + gesture.dx, travel));
      },
      onPanResponderRelease: (_, gesture) => {
        const offset = clampOffset(dragStartOffset.current + gesture.dx, travel);
        setDragging(false);
        commitLevel(offset);
      },
      onPanResponderTerminate: (_, gesture) => {
        const offset = clampOffset(dragStartOffset.current + gesture.dx, travel);
        setDragging(false);
        commitLevel(offset);
      },
    }).panHandlers;
  }, [commitLevel, disabled, travel]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          width: "100%",
          alignSelf: "stretch",
          opacity: disabled ? 0.45 : 1,
        },
        trackArea: {
          width: "100%",
          height: THUMB_SIZE + 8,
          justifyContent: "center",
        },
        trackPress: {
          width: "100%",
          height: THUMB_SIZE + 20,
          justifyContent: "center",
        },
        trackLine: {
          height: TRACK_HEIGHT,
          borderRadius: TRACK_HEIGHT / 2,
          backgroundColor: colors.border,
        },
        trackFill: {
          position: "absolute",
          left: 0,
          top: (THUMB_SIZE + 8 - TRACK_HEIGHT) / 2,
          height: TRACK_HEIGHT,
          borderRadius: TRACK_HEIGHT / 2,
          backgroundColor: colors.primary,
          width: thumbLeft + THUMB_SIZE / 2,
        },
        tickRow: {
          position: "absolute",
          left: THUMB_SIZE / 2,
          right: THUMB_SIZE / 2,
          top: (THUMB_SIZE + 8 - TICK_HEIGHT) / 2 - 3,
          flexDirection: "row",
          justifyContent: "space-between",
        },
        tick: {
          width: 2,
          height: TICK_HEIGHT,
          borderRadius: 1,
          backgroundColor: colors.border,
        },
        tickActive: { backgroundColor: colors.primaryDark },
        thumb: {
          position: "absolute",
          top: 4,
          left: thumbLeft,
          width: THUMB_SIZE,
          height: THUMB_SIZE,
          borderRadius: THUMB_SIZE / 2,
          backgroundColor: colors.card,
          borderWidth: 2,
          borderColor: colors.primary,
          shadowColor: "#000",
          shadowOpacity: 0.12,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
          elevation: 4,
          zIndex: 2,
        },
      }),
    [colors, thumbLeft]
  );

  return (
    <View style={styles.root} accessibilityRole="adjustable" accessibilityState={{ disabled }}>
      <View style={styles.trackArea}>
        <View
          style={styles.trackPress}
          onLayout={onTrackLayout}
          accessibilityLabel={`Text size level ${previewLevel} of ${FONT_SIZE_LEVEL_MAX}`}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            disabled={disabled || dragging}
            onPress={(e) => handleTrackPress(e.nativeEvent.locationX)}
            accessibilityRole="adjustable"
          />
          <View style={styles.trackLine} pointerEvents="none" />
          {!disabled && previewLevel > FONT_SIZE_LEVEL_MIN ? (
            <View style={styles.trackFill} pointerEvents="none" />
          ) : null}
          <View style={styles.tickRow} pointerEvents="none">
            {Array.from({ length: FONT_SIZE_LEVEL_MAX }, (_, i) => i + 1).map((step) => (
              <View
                key={step}
                style={[styles.tick, step <= previewLevel && !disabled && styles.tickActive]}
              />
            ))}
          </View>
          <View
            style={[styles.thumb, disabled && { borderColor: colors.border }]}
            {...(disabled ? {} : panHandlers)}
            accessibilityRole="adjustable"
            accessibilityLabel={`Text size ${previewLevel}`}
            accessibilityValue={{
              min: FONT_SIZE_LEVEL_MIN,
              max: FONT_SIZE_LEVEL_MAX,
              now: previewLevel,
            }}
          />
        </View>
      </View>
    </View>
  );
}

export { DEFAULT_FONT_SIZE_LEVEL };
