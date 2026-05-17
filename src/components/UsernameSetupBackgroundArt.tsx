import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { Caveat_400Regular, Caveat_700Bold, useFonts } from "@expo-google-fonts/caveat";
import {
  ONBOARDING_BACKGROUND_WORDS,
  ONBOARDING_FLOATING_WORD_COUNT,
} from "../constants/onboardingBackgroundWords";

const WORD_COLOR = "#E8E4DC";
const PAD = 20;
const WRITE_MS_MIN = 720;
const WRITE_MS_MAX = 1400;
const ERASE_MS_MIN = 480;
const ERASE_MS_MAX = 900;
const HOLD_MS_MIN = 900;
const HOLD_MS_MAX = 2200;
const BETWEEN_MS_MIN = 350;
const BETWEEN_MS_MAX = 1100;
const FONT_SIZE_MIN = 18;
const FONT_SIZE_MAX = 36;
const ROTATION_MIN = -26;
const ROTATION_MAX = 26;

type Props = {
  /** 0–1; default 0.055 */
  opacity?: number;
};

type WordLayout = {
  x: number;
  y: number;
  rotationDeg: number;
  fontSize: number;
  fontFamily: string;
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

function animateShared(
  value: SharedValue<number>,
  to: number,
  duration: number,
  easing: (t: number) => number
): Promise<void> {
  return new Promise((resolve) => {
    value.value = withTiming(to, { duration, easing }, (finished) => {
      if (finished) runOnJS(resolve)();
    });
  });
}

function pickLayout(
  canvasW: number,
  canvasH: number,
  textW: number,
  textH: number
): Omit<WordLayout, "fontFamily"> {
  const maxX = Math.max(PAD, canvasW - textW - PAD);
  const maxY = Math.max(PAD, canvasH - textH - PAD);
  return {
    x: randBetween(PAD, maxX),
    y: randBetween(PAD, maxY),
    rotationDeg: randBetween(ROTATION_MIN, ROTATION_MAX),
    fontSize: randBetween(FONT_SIZE_MIN, FONT_SIZE_MAX),
  };
}

const SCRIBBLE_EASE = Easing.bezier(0.42, 0.02, 0.25, 1);

function ScribbleWord({
  canvasW,
  canvasH,
  baseOpacity,
  startDelayMs,
  fonts,
}: {
  canvasW: number;
  canvasH: number;
  baseOpacity: number;
  startDelayMs: number;
  fonts: { regular: string; bold: string };
}) {
  const [word, setWord] = useState(() => pickWord());
  const [layout, setLayout] = useState<WordLayout>(() => ({
    ...pickLayout(canvasW, canvasH, 72, 28),
    fontFamily: fonts.regular,
  }));
  const [textWidth, setTextWidth] = useState(72);

  const reveal = useSharedValue(0);
  const drift = useSharedValue(0);
  const cancelledRef = useRef(false);

  const clipStyle = useAnimatedStyle(() => ({
    width: Math.max(1, reveal.value * textWidth),
    opacity: 0.35 + reveal.value * 0.65,
    transform: [{ translateX: drift.value * 3 }],
  }));

  useEffect(() => {
    cancelledRef.current = false;

    const run = async () => {
      await sleep(startDelayMs, () => cancelledRef.current);
      let prev = word;

      while (!cancelledRef.current) {
        const next = pickWord(prev);
        const useBold = Math.random() > 0.55;
        const fontSize = randBetween(FONT_SIZE_MIN, FONT_SIZE_MAX);
        const fontFamily = useBold ? fonts.bold : fonts.regular;
        const estW = Math.max(36, next.length * fontSize * 0.42);
        const estH = fontSize * 1.15;
        prev = next;
        setWord(next);
        setLayout({
          ...pickLayout(canvasW, canvasH, estW, estH),
          fontSize,
          fontFamily,
        });
        reveal.value = 0;
        drift.value = 0;

        await sleep(48, () => cancelledRef.current);

        const writeMs = randBetween(WRITE_MS_MIN, WRITE_MS_MAX);
        drift.value = withTiming(1, { duration: writeMs, easing: SCRIBBLE_EASE });
        await animateShared(reveal, 1, writeMs, SCRIBBLE_EASE);

        await sleep(randBetween(HOLD_MS_MIN, HOLD_MS_MAX), () => cancelledRef.current);

        const eraseMs = randBetween(ERASE_MS_MIN, ERASE_MS_MAX);
        await animateShared(reveal, 0, eraseMs, Easing.in(Easing.quad));

        await sleep(randBetween(BETWEEN_MS_MIN, BETWEEN_MS_MAX), () => cancelledRef.current);
      }
    };

    void run();
    return () => {
      cancelledRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one loop per instance
  }, [canvasW, canvasH, fonts.bold, fonts.regular]);

  return (
    <>
      <Text
        style={[
          styles.measure,
          {
            fontSize: layout.fontSize,
            fontFamily: layout.fontFamily,
          },
        ]}
        onLayout={(e) => {
          const { width } = e.nativeEvent.layout;
          if (width > 0) setTextWidth(width);
        }}
      >
        {word}
      </Text>
      <View
        style={[
          styles.wordHost,
          {
            left: layout.x,
            top: layout.y,
            opacity: baseOpacity,
            transform: [{ rotate: `${layout.rotationDeg}deg` }],
          },
        ]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Animated.View style={[styles.clip, clipStyle]}>
          <Text
            style={[
              styles.word,
              {
                fontSize: layout.fontSize,
                fontFamily: layout.fontFamily,
                width: textWidth,
              },
            ]}
          >
            {word}
          </Text>
        </Animated.View>
      </View>
    </>
  );
}

/**
 * Faint list-themed words — cursive scribble reveal, random placement/size/angle each cycle.
 */
export default function UsernameSetupBackgroundArt({ opacity = 0.055 }: Props) {
  const { width, height } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState(false);

  const [fontsLoaded] = useFonts({
    CaveatRegular: Caveat_400Regular,
    CaveatBold: Caveat_700Bold,
  });

  const fonts = useMemo(
    () => ({ regular: "CaveatRegular", bold: "CaveatBold" }),
    []
  );

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

  const instances = useMemo(
    () =>
      Array.from({ length: ONBOARDING_FLOATING_WORD_COUNT }, (_, i) => ({
        id: `scribble-${i}`,
        delay: Math.round(randBetween(0, 2400) + i * 220),
      })),
    []
  );

  if (!fontsLoaded) return null;

  if (reduceMotion) {
    return (
      <View style={styles.root} pointerEvents="none">
        {instances.map((inst) => {
          const fontSize = randBetween(FONT_SIZE_MIN, FONT_SIZE_MAX);
          const rot = randBetween(ROTATION_MIN, ROTATION_MAX);
          const w = pickWord();
          const x = randBetween(PAD, Math.max(PAD, width - 100));
          const y = randBetween(PAD, Math.max(PAD, height - 40));
          return (
            <Text
              key={inst.id}
              style={[
                styles.word,
                {
                  left: x,
                  top: y,
                  fontSize,
                  opacity,
                  fontFamily: fonts.regular,
                  transform: [{ rotate: `${rot}deg` }],
                },
              ]}
            >
              {w}
            </Text>
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.root} pointerEvents="none">
      {instances.map((inst) => (
        <ScribbleWord
          key={inst.id}
          canvasW={width}
          canvasH={height}
          baseOpacity={opacity}
          startDelayMs={inst.delay}
          fonts={fonts}
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
  measure: {
    position: "absolute",
    left: -9999,
    top: -9999,
    opacity: 0,
    color: WORD_COLOR,
  },
  wordHost: {
    position: "absolute",
  },
  clip: {
    overflow: "hidden",
  },
  word: {
    color: WORD_COLOR,
  },
});
