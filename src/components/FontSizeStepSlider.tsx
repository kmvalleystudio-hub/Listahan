import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type GestureResponderEvent,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
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

function touchXInTrack(event: GestureResponderEvent, trackPageX: number): number {
  const { pageX, locationX } = event.nativeEvent;
  if (typeof pageX === "number" && Number.isFinite(pageX)) {
    return pageX - trackPageX;
  }
  if (typeof locationX === "number" && Number.isFinite(locationX)) {
    return locationX;
  }
  return 0;
}

export default function FontSizeStepSlider({ colors, value, onValueChange, disabled = false }: Props) {
  const trackRef = useRef<View>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dragThumbLeft, setDragThumbLeft] = useState(0);

  const trackPageXRef = useRef(0);
  const travelRef = useRef(0);
  const dragStartOffset = useRef(0);
  const levelRef = useRef(value);

  const level = Math.min(FONT_SIZE_LEVEL_MAX, Math.max(FONT_SIZE_LEVEL_MIN, Math.round(value)));
  levelRef.current = level;

  const travel = Math.max(0, trackWidth - THUMB_SIZE);
  travelRef.current = travel;

  const restingThumbLeft = useMemo(() => offsetForLevel(level, travel), [level, travel]);
  const thumbLeft = dragging ? dragThumbLeft : restingThumbLeft;
  const previewLevel = dragging ? levelFromOffset(thumbLeft, travel) : level;

  useEffect(() => {
    setDragging(false);
  }, [value]);

  const measureTrack = useCallback((cb?: (pageX: number) => void) => {
    trackRef.current?.measureInWindow((pageX) => {
      trackPageXRef.current = pageX;
      cb?.(pageX);
    });
  }, []);

  const commitLevel = useCallback(
    (offset: number) => {
      if (disabled) return;
      const t = travelRef.current;
      if (t <= 0) return;
      onValueChange(levelFromOffset(offset, t));
    },
    [disabled, onValueChange]
  );

  const onTrackLayout = useCallback(
    (e: LayoutChangeEvent) => {
      setTrackWidth(e.nativeEvent.layout.width);
      measureTrack();
    },
    [measureTrack]
  );

  const handleTrackPress = useCallback(
    (event: GestureResponderEvent) => {
      if (disabled || trackWidth <= 0) return;
      measureTrack((trackPageX) => {
        const x = touchXInTrack(event, trackPageX);
        const offset = clampOffset(x - THUMB_SIZE / 2, travelRef.current);
        commitLevel(offset);
      });
    },
    [commitLevel, disabled, measureTrack, trackWidth]
  );

  const panHandlers = useMemo(() => {
    if (disabled) return {};
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        const t = travelRef.current;
        const start = offsetForLevel(levelRef.current, t);
        dragStartOffset.current = start;
        setDragThumbLeft(start);
        setDragging(true);
      },
      onPanResponderMove: (_, gesture) => {
        const t = travelRef.current;
        setDragThumbLeft(clampOffset(dragStartOffset.current + gesture.dx, t));
      },
      onPanResponderRelease: (_, gesture) => {
        const t = travelRef.current;
        const offset = clampOffset(dragStartOffset.current + gesture.dx, t);
        setDragging(false);
        commitLevel(offset);
      },
      onPanResponderTerminate: (_, gesture) => {
        const t = travelRef.current;
        const offset = clampOffset(dragStartOffset.current + gesture.dx, t);
        setDragging(false);
        commitLevel(offset);
      },
    }).panHandlers;
  }, [commitLevel, disabled]);

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
    [colors]
  );

  return (
    <View style={styles.root} accessibilityRole="adjustable" accessibilityState={{ disabled }}>
      <View style={styles.trackArea}>
        <Pressable
          ref={trackRef}
          style={styles.trackPress}
          onLayout={onTrackLayout}
          disabled={disabled || dragging}
          onPress={handleTrackPress}
          accessibilityRole="adjustable"
          accessibilityLabel={`Text size level ${previewLevel} of ${FONT_SIZE_LEVEL_MAX}`}
        >
          <View style={styles.trackLine} pointerEvents="none" />
          {!disabled && previewLevel > FONT_SIZE_LEVEL_MIN ? (
            <View
              style={[styles.trackFill, { width: thumbLeft + THUMB_SIZE / 2 }]}
              pointerEvents="none"
            />
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
            style={[
              styles.thumb,
              { left: thumbLeft },
              disabled && { borderColor: colors.border },
            ]}
            {...(disabled ? {} : panHandlers)}
            accessibilityRole="adjustable"
            accessibilityLabel={`Text size ${previewLevel}`}
            accessibilityValue={{
              min: FONT_SIZE_LEVEL_MIN,
              max: FONT_SIZE_LEVEL_MAX,
              now: previewLevel,
            }}
          />
        </Pressable>
      </View>
    </View>
  );
}

export { DEFAULT_FONT_SIZE_LEVEL };
