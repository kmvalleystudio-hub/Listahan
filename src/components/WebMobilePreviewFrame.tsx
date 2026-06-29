import React, { useMemo } from "react";
import { Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  type EdgeInsets,
  type Rect,
} from "react-native-safe-area-context";
import { PreviewViewportProvider } from "../context/PreviewViewportContext";

/** Clears the decorative notch and home indicator in the browser phone frame. */
export const WEB_PREVIEW_SAFE_INSETS: EdgeInsets = { top: 52, bottom: 28, left: 0, right: 0 };

/** Logical phone size (iPhone 14 class) for browser preview. */
const PHONE_WIDTH = 390;
const PHONE_HEIGHT = 844;
const BEZEL = 10;

type Props = {
  children: React.ReactNode;
};

/** Web SafeAreaProvider resets insets to 0 via CSS env(); pin preview values instead. */
function WebPreviewSafeAreaProvider({
  width,
  height,
  children,
}: {
  width: number;
  height: number;
  children: React.ReactNode;
}) {
  const frame = useMemo<Rect>(() => ({ x: 0, y: 0, width, height }), [width, height]);
  return (
    <SafeAreaFrameContext.Provider value={frame}>
      <SafeAreaInsetsContext.Provider value={WEB_PREVIEW_SAFE_INSETS}>
        {children}
      </SafeAreaInsetsContext.Provider>
    </SafeAreaFrameContext.Provider>
  );
}

/**
 * Centers the app in a phone-shaped frame when running `npm run preview` in the browser.
 * Native Android/iOS builds are unchanged.
 */
export default function WebMobilePreviewFrame({ children }: Props) {
  const { width: winW, height: winH } = useWindowDimensions();

  const frame = useMemo(() => {
    const padX = 24;
    const padY = 56;
    const w = Math.min(PHONE_WIDTH, Math.max(280, winW - padX * 2));
    const h = Math.min(PHONE_HEIGHT, Math.max(520, winH - padY));
    return { width: w, height: h };
  }, [winW, winH]);

  if (Platform.OS !== "web") {
    return <>{children}</>;
  }

  return (
    <View style={styles.shell}>
      <View
        style={[
          styles.phoneOuter,
          {
            width: frame.width + BEZEL * 2,
            height: frame.height + BEZEL * 2,
          },
        ]}
      >
        <View style={styles.dynamicIsland} />
        <PreviewViewportProvider width={frame.width} height={frame.height}>
          <WebPreviewSafeAreaProvider width={frame.width} height={frame.height}>
            <View style={[styles.screen, { width: frame.width, height: frame.height }]}>{children}</View>
          </WebPreviewSafeAreaProvider>
        </PreviewViewportProvider>
        <View style={styles.homeIndicator} />
      </View>
      <Text style={styles.caption}>Listahan — mobile preview ({Math.round(frame.width)}×{Math.round(frame.height)})</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1e293b",
    paddingVertical: 20,
    paddingHorizontal: 16,
    // @ts-expect-error web viewport units
    minHeight: "100vh",
    // @ts-expect-error web viewport units
    width: "100vw",
  },
  phoneOuter: {
    borderRadius: 44,
    padding: BEZEL,
    backgroundColor: "#0f172a",
    alignItems: "center",
    ...Platform.select({
      web: {
        boxShadow: "0 24px 48px rgba(0,0,0,0.45)",
      },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.4,
        shadowRadius: 28,
        elevation: 24,
      },
    }),
  },
  dynamicIsland: {
    position: "absolute",
    top: BEZEL + 10,
    alignSelf: "center",
    width: 96,
    height: 24,
    borderRadius: 14,
    backgroundColor: "#020617",
    zIndex: 2,
  },
  screen: {
    borderRadius: 34,
    overflow: "hidden",
    backgroundColor: "#f4f6f8",
  },
  homeIndicator: {
    position: "absolute",
    bottom: BEZEL + 8,
    alignSelf: "center",
    width: 112,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(148, 163, 184, 0.55)",
    zIndex: 2,
  },
  caption: {
    marginTop: 14,
    fontSize: 12,
    fontWeight: "600",
    color: "#94a3b8",
    textAlign: "center",
  },
});
