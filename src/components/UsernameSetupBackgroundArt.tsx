import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  ONBOARDING_BACKGROUND_WORDS,
  ONBOARDING_WORD_SLOTS,
} from "../constants/onboardingBackgroundWords";

const WORD_COLOR = "#E8E4DC";
const TYPING_MS_MIN = 42;
const TYPING_MS_MAX = 78;
const HOLD_MS_MIN = 1400;
const HOLD_MS_MAX = 2800;
const BETWEEN_CYCLES_MS_MIN = 400;
const BETWEEN_CYCLES_MS_MAX = 1200;

type Props = {
  /** 0–1; default 0.06 */
  opacity?: number;
};

function pickWord(exclude?: string): string {
  const pool = ONBOARDING_BACKGROUND_WORDS;
  let w = pool[Math.floor(Math.random() * pool.length)]!;
  if (exclude && pool.length > 1) {
    let guard = 0;
    while (w === exclude && guard++ < 8) {
      w = pool[Math.floor(Math.random() * pool.length)]!;
    }
  }
  return w;
}

function randBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function sleep(ms: number, cancelled: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(() => {
      clearTimeout(t);
      if (!cancelled()) resolve();
    }, ms);
  });
}

function FloatingWord({
  x,
  y,
  rotationDeg,
  fontSize,
  baseOpacity,
  startDelayMs,
}: {
  x: number;
  y: number;
  rotationDeg: number;
  fontSize: number;
  baseOpacity: number;
  startDelayMs: number;
}) {
  const [word, setWord] = useState(() => pickWord());
  const [visibleCount, setVisibleCount] = useState(0);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    const run = async () => {
      await sleep(startDelayMs, () => cancelledRef.current);
      let prev = word;

      while (!cancelledRef.current) {
        const next = pickWord(prev);
        prev = next;
        setWord(next);
        setVisibleCount(0);

        for (let i = 1; i <= next.length; i++) {
          if (cancelledRef.current) return;
          setVisibleCount(i);
          await sleep(randBetween(TYPING_MS_MIN, TYPING_MS_MAX), () => cancelledRef.current);
        }

        await sleep(randBetween(HOLD_MS_MIN, HOLD_MS_MAX), () => cancelledRef.current);

        for (let i = next.length; i >= 0; i--) {
          if (cancelledRef.current) return;
          setVisibleCount(i);
          await sleep(randBetween(18, 32), () => cancelledRef.current);
        }

        await sleep(randBetween(BETWEEN_CYCLES_MS_MIN, BETWEEN_CYCLES_MS_MAX), () => cancelledRef.current);
      }
    };

    void run();
    return () => {
      cancelledRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once per slot
  }, []);

  const shown = word.slice(0, visibleCount);

  return (
    <Text
      style={[
        styles.word,
        {
          left: x,
          top: y,
          fontSize,
          opacity: baseOpacity,
          transform: [{ rotate: `${rotationDeg}deg` }],
        },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {shown}
      {visibleCount > 0 && visibleCount < word.length ? "|" : ""}
    </Text>
  );
}

/**
 * Full-screen faint list-themed words — random slots, parallel typewriter loops.
 */
export default function UsernameSetupBackgroundArt({ opacity = 0.06 }: Props) {
  const { width, height } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduceMotion(v);
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const slots = useMemo(
    () =>
      ONBOARDING_WORD_SLOTS.map((slot, i) => ({
        id: `slot-${i}`,
        x: Math.max(8, Math.min(width - 120, slot.x * width)),
        y: Math.max(8, Math.min(height - 40, slot.y * height)),
        rot: slot.rot,
        size: slot.size,
        delay: Math.round(randBetween(0, 2200) + i * 180),
      })),
    [width, height]
  );

  const staticLabels = useMemo(
    () => slots.map((slot) => ({ id: slot.id, text: pickWord() })),
    [slots]
  );

  if (reduceMotion) {
    return (
      <View style={styles.root} pointerEvents="none">
        {slots.map((slot, i) => (
          <Text
            key={slot.id}
            style={[
              styles.word,
              {
                left: slot.x,
                top: slot.y,
                fontSize: slot.size,
                opacity,
                transform: [{ rotate: `${slot.rot}deg` }],
              },
            ]}
          >
            {staticLabels[i]?.text ?? ""}
          </Text>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.root} pointerEvents="none">
      {slots.map((slot) => (
        <FloatingWord
          key={slot.id}
          x={slot.x}
          y={slot.y}
          rotationDeg={slot.rot}
          fontSize={slot.size}
          baseOpacity={opacity}
          startDelayMs={slot.delay}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  word: {
    position: "absolute",
    color: WORD_COLOR,
    fontWeight: "500",
    letterSpacing: 0.2,
  },
});
