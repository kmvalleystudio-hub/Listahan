import React, { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Pressable,
  Animated,
  BackHandler,
  Platform,
  useWindowDimensions,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { TOOLS_CATALOG, type ToolDefinition, type ToolId } from "../constants/toolsCatalog";
import { useTheme } from "../context/ThemeContext";
import type { AppThemeColors } from "../theme/colors";
import { usePrivateVault } from "../context/PrivateVaultContext";
import { APP_DISPLAY_NAME } from "../constants/appBranding";
import { loadToolOrder, saveToolOrder } from "../utils/toolsDashboardOrder";
import ToolsDashboardReorderGrid from "../components/ToolsDashboardReorderGrid";

export type ToolsDashboardProps = NativeStackScreenProps<RootStackParamList, "ToolsDashboard">;

const GRID_H_PAD = 16;
const GRID_COL_GAP = 12;

/** Light UI: default horizontal mark. Dark UI: light-ink artwork (`-light` source SVG). */
const LISTAHAN_HEADER_LOGO_LIGHT_UI = require("../../assets/branding/listahan-logo-horizontal.png");
const LISTAHAN_HEADER_LOGO_DARK_UI = require("../../assets/branding/listahan-logo-horizontal-on-dark.png");
const LISTAHAN_HEADER_LOGO_ASPECT_FALLBACK = 2316.07 / 506.96;
/** Dashboard header mark height (80% of prior 38px). */
const HEADER_LOGO_HEIGHT = 30;

/** TODO: remove before release — shortcut to username onboarding for QA/builds. */
const SHOW_USERNAME_SETUP_DEV_BUTTON = true;

function createDashboardStyles(c: AppThemeColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.background,
    },
    header: {
      paddingHorizontal: GRID_H_PAD,
      paddingBottom: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    headerBrandCol: {
      flex: 1,
      minWidth: 0,
      alignItems: "flex-start",
    },
    headerLogoSvgWrap: {
      alignSelf: "flex-start",
      height: HEADER_LOGO_HEIGHT,
      maxWidth: "100%",
    },
    headerLogoImage: {
      width: "100%",
      height: "100%",
    },
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    headerIconBtn: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    doneBtn: {
      paddingHorizontal: 14,
      height: 44,
      borderRadius: 14,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    doneBtnText: {
      fontSize: 16,
      fontWeight: "800",
      color: "#fff",
    },
    devBtn: {
      marginHorizontal: GRID_H_PAD,
      marginBottom: 10,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.inputBg,
      alignItems: "center",
    },
    devBtnText: {
      fontSize: 13,
      fontWeight: "700",
      color: c.placeholder,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: GRID_H_PAD,
      paddingTop: 10,
      gap: GRID_COL_GAP,
    },
    card: {
      backgroundColor: c.card,
      borderRadius: 20,
      padding: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borderMuted,
      gap: 8,
      overflow: "hidden",
      ...Platform.select({
        ios: {
          shadowColor: c.shadow,
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: 0.07,
          shadowRadius: 14,
        },
        android: { elevation: 3 },
        default: {},
      }),
    },
    cardPressed: {
      opacity: 0.92,
    },
    /** Reorder mode: lifted tiles — same border as browse (no muted gray ring). */
    cardReorderLift: {
      backgroundColor: c.card,
      borderRadius: 20,
      padding: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borderMuted,
      gap: 8,
      overflow: "hidden",
      ...Platform.select({
        ios: {
          shadowColor: c.shadow,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
        },
        android: {
          elevation: 5,
        },
        default: {},
      }),
    },
    cardTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    iconBlob: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    cardTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: "800",
      color: c.text,
    },
    cardDesc: {
      fontSize: 13,
      color: c.placeholder,
      lineHeight: 18,
    },
    /** Square tile: hero icon, title, description (left-aligned). */
    cardSquareRoot: {
      flex: 1,
      minHeight: 0,
      alignItems: "stretch",
      justifyContent: "flex-start",
    },
    squareHero: {
      alignItems: "flex-start",
      alignSelf: "stretch",
      paddingTop: 2,
    },
    cardTitleSquare: {
      fontSize: 15,
      fontWeight: "800",
      color: c.text,
      textAlign: "left",
      letterSpacing: -0.2,
      marginTop: 8,
      paddingHorizontal: 0,
    },
    cardDescSquare: {
      fontSize: 12,
      color: c.textSecondary,
      lineHeight: 17,
      textAlign: "left",
    },
    squareDescWell: {
      flex: 1,
      minHeight: 0,
      justifyContent: "flex-start",
      marginTop: 6,
      paddingHorizontal: 0,
    },
    /** Fills the trailing empty cell when there is an odd number of tools. */
    gridHintTile: {
      flex: 1,
      alignSelf: "stretch",
      borderRadius: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.inputBg,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 10,
      gap: 6,
    },
    gridHintText: {
      fontSize: 11,
      fontWeight: "600",
      color: c.textTertiary,
      textAlign: "center",
      lineHeight: 15,
    },
  });
}

function dashboardTileWidth(windowWidth: number): number {
  const inner = windowWidth - GRID_H_PAD * 2 - GRID_COL_GAP;
  return Math.max(120, Math.floor(inner / 2));
}

function toolsFromOrder(ids: ToolId[]): ToolDefinition[] {
  const byId = new Map(TOOLS_CATALOG.map((t) => [t.id, t]));
  const out: ToolDefinition[] = [];
  for (const id of ids) {
    const t = byId.get(id);
    if (t) out.push(t);
  }
  return out.length ? out : [...TOOLS_CATALOG];
}

function ToolCardInner({
  tool,
  styles,
  square = false,
  tileWidth,
}: {
  tool: ToolDefinition;
  styles: ReturnType<typeof createDashboardStyles>;
  square?: boolean;
  /** Passed when `square` — scales icon to tile for visual balance. */
  tileWidth?: number;
}) {
  if (square && tileWidth != null) {
    const blob = Math.round(Math.min(58, Math.max(44, tileWidth * 0.34)));
    const radius = Math.round(blob * 0.28);
    const glyph = Math.round(Math.min(30, Math.max(22, blob * 0.48)));
    return (
      <View style={styles.cardSquareRoot}>
        <View style={styles.squareHero}>
          <View
            style={[
              {
                width: blob,
                height: blob,
                borderRadius: radius,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: tool.dashboardIconBg,
              },
            ]}
          >
            <Ionicons
              name={tool.icon as ComponentProps<typeof Ionicons>["name"]}
              size={glyph}
              color={tool.dashboardIconFg}
            />
          </View>
        </View>
        <Text style={styles.cardTitleSquare} numberOfLines={2}>
          {tool.title}
        </Text>
        <View style={styles.squareDescWell}>
          <Text style={styles.cardDescSquare} numberOfLines={5}>
            {tool.description}
          </Text>
        </View>
      </View>
    );
  }

  const iconSize = 22;
  const body = (
    <>
      <View style={styles.cardTop}>
        <View style={[styles.iconBlob, { backgroundColor: tool.dashboardIconBg }]}>
          <Ionicons
            name={tool.icon as ComponentProps<typeof Ionicons>["name"]}
            size={iconSize}
            color={tool.dashboardIconFg}
          />
        </View>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {tool.title}
        </Text>
      </View>
      <Text style={styles.cardDesc} numberOfLines={2}>
        {tool.description}
      </Text>
    </>
  );

  return body;
}

export default function ToolsDashboardScreen({ navigation }: ToolsDashboardProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const tileWidth = useMemo(() => dashboardTileWidth(windowWidth), [windowWidth]);
  const gridInnerWidth = useMemo(() => windowWidth - GRID_H_PAD * 2, [windowWidth]);
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createDashboardStyles(colors), [colors]);
  const { lock } = usePrivateVault();

  const [orderedTools, setOrderedTools] = useState<ToolDefinition[]>(() => [...TOOLS_CATALOG]);
  const orderedToolsRef = useRef(orderedTools);
  orderedToolsRef.current = orderedTools;

  const [reorderMode, setReorderMode] = useState(false);
  const [enterReorderBusy, setEnterReorderBusy] = useState(false);
  const preEditOrderRef = useRef<ToolId[]>([]);

  const headerLogoSource = isDark ? LISTAHAN_HEADER_LOGO_DARK_UI : LISTAHAN_HEADER_LOGO_LIGHT_UI;

  const [logoAspect, setLogoAspect] = useState(LISTAHAN_HEADER_LOGO_ASPECT_FALLBACK);
  useEffect(() => {
    const src = Image.resolveAssetSource(headerLogoSource);
    const uri = src?.uri;
    if (!uri) return;
    Image.getSize(
      uri,
      (w, h) => {
        if (w > 0 && h > 0) setLogoAspect(w / h);
      },
      () => {}
    );
  }, [headerLogoSource]);

  const wiggleAnim = useRef(new Animated.Value(0)).current;
  const wiggleRotate = useMemo(
    () =>
      wiggleAnim.interpolate({
        inputRange: [-1, 1],
        outputRange: ["-4deg", "4deg"],
      }),
    [wiggleAnim]
  );

  useFocusEffect(
    useCallback(() => {
      lock();
      if (reorderMode) return;
      let cancelled = false;
      void loadToolOrder().then((ids) => {
        if (!cancelled) setOrderedTools(toolsFromOrder(ids));
      });
      return () => {
        cancelled = true;
      };
    }, [lock, reorderMode])
  );

  useEffect(() => {
    if (!reorderMode) return;
    const onBack = () => {
      setOrderedTools(toolsFromOrder(preEditOrderRef.current));
      setReorderMode(false);
      return true;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
    return () => sub.remove();
  }, [reorderMode]);

  const onToolPress = useCallback(
    (tool: ToolDefinition) => {
      if (enterReorderBusy || reorderMode) return;
      if (tool.status !== "live") {
        navigation.navigate("ToolPlaceholder", { toolId: tool.id });
        return;
      }
      if (tool.id === "grocery") navigation.navigate("GroceryHome");
      if (tool.id === "todo") navigation.navigate("TodoHome");
      if (tool.id === "private_list") navigation.navigate("PrivateHome");
      if (tool.id === "notes") navigation.navigate("NotesHome");
      if (tool.id === "reminder") navigation.navigate("ReminderHome");
    },
    [enterReorderBusy, navigation, reorderMode]
  );

  const finishReorder = useCallback(() => {
    const ids = orderedToolsRef.current.map((t) => t.id);
    void saveToolOrder(ids);
    setReorderMode(false);
  }, []);

  const playWiggleThenEnterReorder = useCallback(() => {
    if (reorderMode || enterReorderBusy) return;
    setEnterReorderBusy(true);
    wiggleAnim.setValue(0);
    const wobble = (ms: number) =>
      Animated.sequence([
        Animated.timing(wiggleAnim, { toValue: 1, duration: ms, useNativeDriver: true }),
        Animated.timing(wiggleAnim, { toValue: -1, duration: ms, useNativeDriver: true }),
      ]);
    Animated.sequence([
      wobble(55),
      wobble(55),
      wobble(55),
      Animated.timing(wiggleAnim, { toValue: 0, duration: 70, useNativeDriver: true }),
    ]).start(() => {
      preEditOrderRef.current = orderedToolsRef.current.map((t) => t.id);
      setReorderMode(true);
      setEnterReorderBusy(false);
    });
  }, [enterReorderBusy, reorderMode, wiggleAnim]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <View style={styles.headerBrandCol}>
          <View style={[styles.headerLogoSvgWrap, { aspectRatio: logoAspect }]}>
            <Image
              source={headerLogoSource}
              style={styles.headerLogoImage}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
              accessibilityLabel={`${APP_DISPLAY_NAME} logo`}
            />
          </View>
        </View>
        {reorderMode ? (
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={finishReorder}
            accessibilityRole="button"
            accessibilityLabel="Done reordering tools"
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => navigation.navigate("Profile")}
              accessibilityRole="button"
              accessibilityLabel="Profile"
            >
              <Ionicons name="person-outline" size={24} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => navigation.navigate("Settings")}
              accessibilityRole="button"
              accessibilityLabel="Settings"
            >
              <Ionicons name="settings-outline" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {!reorderMode ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingBottom: insets.bottom + 24,
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={false}
        >
          {SHOW_USERNAME_SETUP_DEV_BUTTON ? (
            <Pressable
              style={({ pressed }) => [styles.devBtn, pressed && { opacity: 0.85 }]}
              onPress={() => navigation.navigate("UsernameSetup")}
              accessibilityRole="button"
              accessibilityLabel="Open username setup (development only)"
            >
              <Text style={styles.devBtnText}>Dev: Username setup</Text>
            </Pressable>
          ) : null}
          <View style={styles.grid}>
            {orderedTools.map((tool) => (
              <Pressable
                key={tool.id}
                style={({ pressed }) => [
                  { width: tileWidth, height: tileWidth, alignSelf: "flex-start" },
                  pressed && styles.cardPressed,
                  enterReorderBusy && { opacity: 0.88 },
                ]}
                onPress={() => onToolPress(tool)}
                onLongPress={playWiggleThenEnterReorder}
                delayLongPress={Platform.OS === "ios" ? 420 : 380}
              >
                <Animated.View
                  style={[
                    styles.card,
                    { width: tileWidth, height: tileWidth, transform: [{ rotate: wiggleRotate }] },
                  ]}
                >
                  <ToolCardInner tool={tool} styles={styles} square tileWidth={tileWidth} />
                </Animated.View>
              </Pressable>
            ))}
            {orderedTools.length % 2 === 1 ? (
              <View
                style={{ width: tileWidth, height: tileWidth, alignSelf: "flex-start" }}
                pointerEvents="none"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <View style={styles.gridHintTile}>
                  <Ionicons name="hand-left-outline" size={22} color={colors.textTertiary} />
                  <Text style={styles.gridHintText}>Long-press to reorder</Text>
                </View>
              </View>
            ) : null}
          </View>
        </ScrollView>
      ) : (
        <ToolsDashboardReorderGrid
          items={orderedTools}
          onItemsChange={setOrderedTools}
          tileWidth={tileWidth}
          tileSize={tileWidth}
          containerWidth={gridInnerWidth}
          horizontalPad={GRID_H_PAD}
          columnGap={GRID_COL_GAP}
          paddingBottom={insets.bottom + 24}
          cardStyle={[styles.cardReorderLift, { width: tileWidth, height: tileWidth }]}
          renderItem={(item) => <ToolCardInner tool={item} styles={styles} square tileWidth={tileWidth} />}
          trailingSlot={
            orderedTools.length % 2 === 1 ? (
              <View style={styles.gridHintTile}>
                <Ionicons name="hand-left-outline" size={22} color={colors.textTertiary} />
                <Text style={styles.gridHintText}>Long-press to reorder</Text>
              </View>
            ) : undefined
          }
        />
      )}
    </View>
  );
}
