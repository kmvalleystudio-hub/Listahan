import React, { useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { AppThemeColors } from "../theme/colors";

export type ListDetailAddFabItem = {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
};

type ListDetailExpandableAddFabProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ListDetailAddFabItem[];
  colors: AppThemeColors;
  onVoicePress?: () => void;
  voiceAccessibilityLabel?: string;
  micIconSize?: number;
  buttonStyle?: StyleProp<ViewStyle>;
  addAccessibilityLabel?: string;
  closeAccessibilityLabel?: string;
};

const FAB_SIZE = 56;
const PILL_HEIGHT = 44;
const GAP = 10;
const MENU_PANEL_WIDTH = 268;

function createStyles(c: AppThemeColors) {
  return StyleSheet.create({
    root: {
      position: "relative",
      alignItems: "flex-end",
      justifyContent: "flex-end",
      overflow: "visible",
    },
    menuPill: {
      height: PILL_HEIGHT,
      paddingHorizontal: 16,
      borderRadius: 22,
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: c.shadow,
      shadowOpacity: 0.16,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    menuPillText: {
      fontSize: 15,
      fontWeight: "700",
      color: c.text,
    },
    menuSlot: {
      position: "absolute",
      right: 0,
      maxWidth: MENU_PANEL_WIDTH,
      alignItems: "flex-end",
    },
    fabRow: {
      position: "absolute",
      right: 0,
      bottom: 0,
      width: FAB_SIZE,
      height: FAB_SIZE,
      alignItems: "center",
      justifyContent: "center",
    },
    voiceBtnSlot: {
      position: "absolute",
      right: FAB_SIZE + GAP,
      bottom: 0,
    },
    fabBtn: {
      width: FAB_SIZE,
      height: FAB_SIZE,
      borderRadius: FAB_SIZE / 2,
      alignItems: "center",
      justifyContent: "center",
      shadowOpacity: 0.24,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 8,
    },
    fabBtnOpen: {
      backgroundColor: c.danger,
      shadowColor: c.danger,
    },
    fabBtnClosed: {
      backgroundColor: c.primary,
      shadowColor: c.primaryDark,
    },
    fabIconWrap: {
      width: 24,
      height: 24,
      alignItems: "center",
      justifyContent: "center",
    },
    voiceBtn: {
      width: FAB_SIZE,
      height: FAB_SIZE,
      borderRadius: FAB_SIZE / 2,
      backgroundColor: c.micFabBg,
      borderWidth: 1.5,
      borderColor: c.micFabBorder,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      shadowColor: c.shadow,
      shadowOpacity: 0.14,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
      elevation: 6,
    },
    voiceBtnBase: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: c.micFabBase,
    },
    voiceBtnRing: {
      position: "absolute",
      left: 6,
      right: 6,
      top: 6,
      bottom: 6,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: c.micFabRing,
    },
  });
}

/** Voice label on top; other items below, closest to + at the bottom. */
function stackItemsAbove(items: ListDetailAddFabItem[]): ListDetailAddFabItem[] {
  const voice = items.filter((i) => i.key === "voice");
  const rest = items.filter((i) => i.key !== "voice");
  return [...rest, ...voice];
}

function itemReveal(openAnim: Animated.Value, index: number, total: number) {
  const start = index * 0.06;
  const end = Math.min(0.35 + index * (0.55 / Math.max(total, 1)), 1);
  return openAnim.interpolate({
    inputRange: [0, start, end, 1],
    outputRange: [0, 0, 1, 1],
    extrapolate: "clamp",
  });
}

type MenuPillProps = {
  item: ListDetailAddFabItem;
  open: boolean;
  reveal: Animated.AnimatedInterpolation<number>;
  bottom: number;
  tuckTranslateY: Animated.AnimatedInterpolation<number>;
  pillStyle: ReturnType<typeof createStyles>["menuPill"];
  textStyle: ReturnType<typeof createStyles>["menuPillText"];
  slotStyle: ReturnType<typeof createStyles>["menuSlot"];
};

function MenuPill({
  item,
  open,
  reveal,
  bottom,
  tuckTranslateY,
  pillStyle,
  textStyle,
  slotStyle,
}: MenuPillProps) {
  return (
    <Animated.View
      pointerEvents={open ? "auto" : "none"}
      style={[
        slotStyle,
        { bottom },
        {
          opacity: reveal,
          transform: [
            { translateY: tuckTranslateY },
            {
              scale: reveal.interpolate({
                inputRange: [0, 1],
                outputRange: [0.45, 1],
              }),
            },
          ],
        },
      ]}
    >
      <TouchableOpacity
        style={pillStyle}
        activeOpacity={0.88}
        onPress={item.onPress}
        accessibilityRole="button"
        accessibilityLabel={item.label}
      >
        <Text style={textStyle} numberOfLines={1}>
          {item.label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ListDetailExpandableAddFab({
  open,
  onOpenChange,
  items,
  colors,
  onVoicePress,
  voiceAccessibilityLabel = "Add bulk by voice",
  micIconSize = 24,
  buttonStyle,
  addAccessibilityLabel = "Open add menu",
  closeAccessibilityLabel = "Close add menu",
}: ListDetailExpandableAddFabProps) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const openAnim = useRef(new Animated.Value(0)).current;

  const stackedItems = useMemo(() => stackItemsAbove(items), [items]);
  const drawerSlotCount = stackedItems.length + (onVoicePress ? 1 : 0);

  useEffect(() => {
    Animated.timing(openAnim, {
      toValue: open ? 1 : 0,
      duration: open ? 300 : 220,
      easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [open, openAnim]);

  const toggle = () => onOpenChange(!open);

  const iconSpin = openAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "90deg"],
  });

  const rootHeight =
    FAB_SIZE + GAP + stackedItems.length * (PILL_HEIGHT + GAP) + (stackedItems.length ? GAP : 0);

  const voiceReveal = itemReveal(openAnim, stackedItems.length, drawerSlotCount);

  const onVoiceTap = () => {
    onOpenChange(false);
    onVoicePress?.();
  };

  return (
    <View
      style={[
        styles.root,
        {
          width: MENU_PANEL_WIDTH,
          height: rootHeight,
          marginTop: -(rootHeight - FAB_SIZE),
        },
      ]}
      pointerEvents="box-none"
    >
      {stackedItems.map((item, index) => {
        const reveal = itemReveal(openAnim, index, drawerSlotCount);
        const openBottom = FAB_SIZE + GAP + index * (PILL_HEIGHT + GAP);
        const tuckY = openBottom - 4;
        return (
          <MenuPill
            key={item.key}
            item={item}
            open={open}
            reveal={reveal}
            bottom={openBottom}
            pillStyle={styles.menuPill}
            textStyle={styles.menuPillText}
            slotStyle={styles.menuSlot}
            tuckTranslateY={reveal.interpolate({
              inputRange: [0, 1],
              outputRange: [tuckY, 0],
            })}
          />
        );
      })}

      <View style={styles.fabRow} pointerEvents="box-none">
        {onVoicePress ? (
          <Animated.View
            pointerEvents={open ? "auto" : "none"}
            style={[
              styles.voiceBtnSlot,
              {
                opacity: voiceReveal,
                transform: [
                  {
                    translateX: voiceReveal.interpolate({
                      inputRange: [0, 1],
                      outputRange: [FAB_SIZE * 0.65, 0],
                    }),
                  },
                  {
                    scale: voiceReveal.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.35, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <TouchableOpacity
              style={styles.voiceBtn}
              onPress={onVoiceTap}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel={voiceAccessibilityLabel}
            >
              <View style={styles.voiceBtnBase} pointerEvents="none" />
              <View style={styles.voiceBtnRing} pointerEvents="none" />
              <Ionicons name="mic" size={micIconSize} color={colors.micIcon} />
            </TouchableOpacity>
          </Animated.View>
        ) : null}

        <TouchableOpacity
          style={[styles.fabBtn, open ? styles.fabBtnOpen : styles.fabBtnClosed, buttonStyle]}
          onPress={toggle}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={open ? closeAccessibilityLabel : addAccessibilityLabel}
        >
          <Animated.View style={[styles.fabIconWrap, { transform: [{ rotate: iconSpin }] }]}>
            <Ionicons name={open ? "close" : "add"} size={24} color="#fff" />
          </Animated.View>
        </TouchableOpacity>
      </View>
    </View>
  );
}
