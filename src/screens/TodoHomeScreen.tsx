import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SectionList,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Animated,
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { TodoHomeProps } from "../navigation/types";
import { useAppData } from "../context/AppDataContext";
import { useToolTheme } from "../hooks/useToolTheme";
import type { AppThemeColors } from "../theme/colors";
import { ToolHomeFooterListScrim } from "../components/ToolHomeFooterListScrim";
import {
  toolHomeFloatingAddButtonDarkLift,
  toolHomeFloatingAddButtonUpwardGlowWrap,
  toolHomeListFadeBottomOffset,
} from "../theme/toolHomeFloatingAddButton";
import type { TodoList } from "../types";

type ListSection = {
  title: string;
  data: TodoList[];
};

function byUpdatedDesc(a: TodoList, b: TodoList): number {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

function createStyles(c: AppThemeColors, isDark: boolean) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    header: {
      paddingHorizontal: 20,
      paddingBottom: 12,
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
    },
    headerTextCol: { flex: 1, minWidth: 0 },
    headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
    backRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6 },
    backTextSmall: { fontSize: 14, fontWeight: "600", color: c.linkBlue },
    title: { fontSize: 28, fontWeight: "800", color: c.text },
    subtitle: { marginTop: 4, fontSize: 15, color: c.textTertiary },
    iconBtn: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: c.historyBtnBg,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    listContent: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
    sectionHeader: { paddingHorizontal: 4, paddingTop: 4, paddingBottom: 2 },
    sectionTitle: {
      fontSize: 12,
      fontWeight: "800",
      color: c.textTertiary,
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    sectionRule: { height: StyleSheet.hairlineWidth, backgroundColor: c.borderMuted, marginTop: 8 },
    card: {
      backgroundColor: c.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    cardPressed: { opacity: 0.92 },
    cardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    pinIcon: { marginRight: -4 },
    cardIconBlob: {
      width: 48,
      height: 46,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 14,
      borderBottomLeftRadius: 18,
      borderBottomRightRadius: 26,
      backgroundColor: c.iconBlobBg,
      alignItems: "center",
      justifyContent: "center",
    },
    cardBody: { flex: 1, minWidth: 0 },
    cardTitleRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
    },
    cardTitle: { fontSize: 17, fontWeight: "700", color: c.text, flex: 1, minWidth: 0 },
    importedPill: {
      flexShrink: 0,
      marginTop: 2,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      backgroundColor: c.iconBlobBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    importedPillText: {
      fontSize: 11,
      fontWeight: "800",
      color: c.primaryDark,
      letterSpacing: 0.4,
      textTransform: "uppercase",
    },
    cardMeta: { marginTop: 4, fontSize: 13, color: c.placeholder },
    empty: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 24 },
    emptyTitle: { marginTop: 12, fontSize: 18, fontWeight: "700", color: c.textTertiary },
    emptyText: { marginTop: 6, fontSize: 14, color: c.placeholder, textAlign: "center" },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    footer: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 6,
      paddingHorizontal: 16,
      paddingTop: 6,
      backgroundColor: "transparent",
    },
    primaryBtn: {
      backgroundColor: c.primary,
      borderRadius: 16,
      paddingVertical: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      ...toolHomeFloatingAddButtonDarkLift(isDark, c),
    },
    primaryBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
    menuBackdrop: { flex: 1, backgroundColor: c.overlayStrong },
    menuBackdropInner: { flex: 1, justifyContent: "center", padding: 24 },
    menuCardWrap: { alignSelf: "stretch" },
    menuCard: {
      backgroundColor: c.card,
      borderRadius: 18,
      padding: 8,
      gap: 4,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    menuHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      paddingTop: 8,
      paddingBottom: 12,
      gap: 8,
    },
    menuListName: { flex: 1, fontSize: 18, fontWeight: "800", color: c.text },
    menuClose: { padding: 4 },
    menuRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: c.inputBg,
    },
    menuRowText: { fontSize: 16, fontWeight: "700", color: c.text },
    menuRowDanger: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: c.trashBg,
    },
    menuRowTextDanger: { fontSize: 16, fontWeight: "700", color: c.danger },
  });
}

export default function TodoHomeScreen({ navigation }: TodoHomeProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useToolTheme("todo");
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const { todoLists, loading, removeTodoList, upsertTodoList } = useAppData();
  const [menuList, setMenuList] = useState<TodoList | null>(null);
  const menuFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!menuList) {
      menuFade.setValue(0);
      return;
    }
    menuFade.setValue(0);
    Animated.timing(menuFade, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [menuList]);

  const sections = useMemo((): ListSection[] => {
    const pinned = todoLists.filter((l) => l.pinned).sort(byUpdatedDesc);
    const normal = todoLists.filter((l) => !l.pinned).sort(byUpdatedDesc);
    const out: ListSection[] = [];
    if (pinned.length) out.push({ title: "Pinned", data: pinned });
    if (normal.length) out.push({ title: pinned.length ? "More" : "", data: normal });
    return out;
  }, [todoLists]);

  const closeMenu = () => setMenuList(null);

  const openEditFromMenu = () => {
    if (!menuList) return;
    const id = menuList.id;
    closeMenu();
    navigation.navigate("TodoListDetail", { listId: id });
  };

  const shareFromMenu = () => {
    if (!menuList) return;
    const id = menuList.id;
    closeMenu();
    navigation.navigate("ShareExport", { tool: "todo", listId: id });
  };

  const prioritizeFromMenu = () => {
    if (!menuList) return;
    void upsertTodoList({ ...menuList, pinned: true });
    closeMenu();
  };

  const deleteFromMenu = () => {
    if (!menuList) return;
    const target = menuList;
    closeMenu();
    Alert.alert("Remove to-dos?", `Remove "${target.name}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => void removeTodoList(target.id),
      },
    ]);
  };

  const renderItem = ({ item }: { item: TodoList }) => (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => navigation.navigate("TodoListDetail", { listId: item.id })}
      onLongPress={() => setMenuList(item)}
      delayLongPress={400}
      accessibilityHint="Hold briefly to open options"
    >
      <View style={styles.cardRow}>
        <View style={styles.cardIconBlob}>
          <Ionicons name="checkmark-circle" size={22} color={colors.iconBlobFg} />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.name}
            </Text>
            {item.importedFromShare ? (
              <View style={styles.importedPill} accessibilityLabel="Imported list">
                <Text style={styles.importedPillText}>Imported</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.cardMeta}>
            {item.items.length} task{item.items.length === 1 ? "" : "s"} · Updated{" "}
            {new Date(item.updatedAt).toLocaleDateString()}
          </Text>
        </View>
        {item.pinned ? (
          <Ionicons name="pin" size={18} color={colors.pin} style={styles.pinIcon} />
        ) : null}
        <Ionicons name="chevron-forward" size={20} color={colors.placeholder} />
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <View style={styles.headerTextCol}>
          <TouchableOpacity
            style={styles.backRow}
            onPress={() => navigation.navigate("ToolsDashboard")}
            accessibilityRole="button"
            accessibilityLabel="Back to tools"
          >
            <Ionicons name="chevron-back" size={18} color={colors.linkBlue} />
            <Text style={styles.backTextSmall}>Tools</Text>
          </TouchableOpacity>
          <Text style={styles.title}>To-dos</Text>
          <Text style={styles.subtitle}>Simple tasks — check them off when done</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate("ShareImport", { expectingTool: "todo" })}
            accessibilityRole="button"
            accessibilityLabel="Import shared data"
          >
            <Ionicons name="download-outline" size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate("TodoRecent")}
            accessibilityRole="button"
            accessibilityLabel="Recent completed to-dos"
          >
            <Ionicons name="time-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View style={{ flex: 1, position: "relative" }}>
          <SectionList
            style={{ flex: 1 }}
            sections={sections}
            keyExtractor={(l) => l.id}
            renderItem={renderItem}
            renderSectionHeader={({ section }) =>
              section.title ? (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <View style={styles.sectionRule} />
                </View>
              ) : null
            }
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 120 }]}
            stickySectionHeadersEnabled={false}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="checkbox-outline" size={48} color={colors.borderMuted} />
                <Text style={styles.emptyTitle}>Nothing here yet</Text>
                <Text style={styles.emptyText}>Tap below to add your first to-dos.</Text>
              </View>
            }
            SectionSeparatorComponent={() => <View style={{ height: 4 }} />}
          />
          <ToolHomeFooterListScrim
            isDark={isDark}
            backgroundColor={colors.background}
            bottomOffset={toolHomeListFadeBottomOffset(insets.bottom)}
          />
        </View>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <View style={toolHomeFloatingAddButtonUpwardGlowWrap(isDark, colors)}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate("TodoCreateList")}
            activeOpacity={0.9}
          >
            <Ionicons name="add-circle-outline" size={22} color="#fff" />
            <Text style={styles.primaryBtnText}>Add to-dos</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={!!menuList} transparent animationType="none" onRequestClose={closeMenu}>
        <Animated.View style={[styles.menuBackdrop, { opacity: menuFade }]}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={closeMenu} />
          <View pointerEvents="box-none" style={styles.menuBackdropInner}>
            <Pressable style={styles.menuCardWrap} onPress={() => {}}>
              <View style={styles.menuCard}>
                <View style={styles.menuHeader}>
                  <Text style={styles.menuListName} numberOfLines={2}>
                    {menuList?.name}
                  </Text>
                  <TouchableOpacity onPress={closeMenu} style={styles.menuClose}>
                    <Ionicons name="close" size={26} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.menuRow} onPress={openEditFromMenu} activeOpacity={0.85}>
                  <Ionicons name="open-outline" size={22} color={colors.primary} />
                  <Text style={styles.menuRowText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuRow} onPress={shareFromMenu} activeOpacity={0.85}>
                  <Ionicons name="share-outline" size={22} color={colors.primary} />
                  <Text style={styles.menuRowText}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuRow} onPress={prioritizeFromMenu} activeOpacity={0.85}>
                  <Ionicons name="arrow-up-circle-outline" size={22} color={colors.primary} />
                  <Text style={styles.menuRowText}>Prioritize</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuRowDanger} onPress={deleteFromMenu} activeOpacity={0.85}>
                  <Ionicons name="trash-outline" size={22} color={colors.danger} />
                  <Text style={styles.menuRowTextDanger}>Delete</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </View>
        </Animated.View>
      </Modal>
    </View>
  );
}
