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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { HomeProps } from "../navigation/types";
import { useAppData } from "../context/AppDataContext";
import { useTheme } from "../context/ThemeContext";
import type { AppThemeColors } from "../theme/colors";
import type { GroceryList } from "../types";

type ListSection = {
  title: string;
  data: GroceryList[];
};

function byUpdatedDesc(a: GroceryList, b: GroceryList): number {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

function createHomeStyles(c: AppThemeColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.background,
    },
    header: {
      paddingHorizontal: 20,
      paddingBottom: 12,
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
    },
    headerTextCol: {
      flex: 1,
      minWidth: 0,
    },
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    title: {
      fontSize: 28,
      fontWeight: "800",
      color: c.text,
    },
    subtitle: {
      marginTop: 4,
      fontSize: 15,
      color: c.textTertiary,
    },
    iconBtn: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: c.historyBtnBg,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: c.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingTop: 8,
      gap: 12,
    },
    sectionHeader: {
      paddingHorizontal: 4,
      paddingTop: 4,
      paddingBottom: 2,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: "800",
      color: c.textTertiary,
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    sectionRule: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.borderMuted,
      marginTop: 8,
    },
    card: {
      backgroundColor: c.card,
      borderRadius: 16,
      padding: 16,
      shadowColor: c.shadow,
      shadowOpacity: 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    cardPressed: {
      opacity: 0.92,
    },
    cardRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    pinIcon: {
      marginRight: -4,
    },
    cardIconBlob: {
      width: 48,
      height: 46,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 14,
      borderBottomLeftRadius: 18,
      borderBottomRightRadius: 26,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: c.primaryDark,
      shadowOpacity: 0.35,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3,
    },
    cardBody: {
      flex: 1,
      minWidth: 0,
    },
    cardTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: c.text,
    },
    cardMeta: {
      marginTop: 4,
      fontSize: 13,
      color: c.placeholder,
    },
    empty: {
      alignItems: "center",
      paddingVertical: 48,
      paddingHorizontal: 24,
    },
    emptyTitle: {
      marginTop: 12,
      fontSize: 18,
      fontWeight: "700",
      color: c.textTertiary,
    },
    emptyText: {
      marginTop: 6,
      fontSize: 14,
      color: c.placeholder,
      textAlign: "center",
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    footer: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 16,
      paddingTop: 10,
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
      shadowColor: c.primaryDark,
      shadowOpacity: 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    primaryBtnText: {
      color: "#fff",
      fontSize: 17,
      fontWeight: "700",
    },
    menuBackdrop: {
      flex: 1,
      backgroundColor: c.overlayStrong,
    },
    menuBackdropInner: {
      flex: 1,
      justifyContent: "center",
      padding: 24,
    },
    menuCardWrap: {
      alignSelf: "stretch",
    },
    menuCard: {
      backgroundColor: c.card,
      borderRadius: 18,
      padding: 8,
      gap: 4,
      shadowColor: c.shadow,
      shadowOpacity: 0.12,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
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
    menuListName: {
      flex: 1,
      fontSize: 18,
      fontWeight: "800",
      color: c.text,
    },
    menuClose: {
      padding: 4,
    },
    menuRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: c.inputBg,
    },
    menuRowText: {
      fontSize: 16,
      fontWeight: "700",
      color: c.text,
    },
    menuRowDanger: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: c.trashBg,
    },
    menuRowTextDanger: {
      fontSize: 16,
      fontWeight: "700",
      color: c.danger,
    },
  });
}

export default function HomeScreen({ navigation }: HomeProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark, toggleScheme } = useTheme();
  const styles = useMemo(() => createHomeStyles(colors), [colors]);
  const { lists, loading, removeList, upsertList } = useAppData();
  const [menuList, setMenuList] = useState<GroceryList | null>(null);
  const menuFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!menuList) {
      menuFade.setValue(0);
      return;
    }
    menuFade.setValue(0);
    Animated.timing(menuFade, {
      toValue: 1,
      duration: 110,
      useNativeDriver: true,
    }).start();
  }, [menuList]);

  const sections = useMemo((): ListSection[] => {
    const pinned = lists.filter((l) => l.pinned).sort(byUpdatedDesc);
    const normal = lists.filter((l) => !l.pinned).sort(byUpdatedDesc);
    const out: ListSection[] = [];
    if (pinned.length) out.push({ title: "Pinned", data: pinned });
    if (normal.length) out.push({ title: pinned.length ? "Lists" : "", data: normal });
    return out;
  }, [lists]);

  const closeMenu = () => setMenuList(null);

  const openEditFromMenu = () => {
    if (!menuList) return;
    const id = menuList.id;
    closeMenu();
    navigation.navigate("ListDetail", { listId: id });
  };

  const prioritizeFromMenu = () => {
    if (!menuList) return;
    void upsertList({ ...menuList, pinned: true });
    closeMenu();
  };

  const deleteFromMenu = () => {
    if (!menuList) return;
    const target = menuList;
    closeMenu();
    Alert.alert("Delete list", `Remove "${target.name}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => void removeList(target.id),
      },
    ]);
  };

  const renderItem = ({ item }: { item: GroceryList }) => (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => navigation.navigate("ListDetail", { listId: item.id })}
      onLongPress={() => setMenuList(item)}
      delayLongPress={800}
      accessibilityHint="Hold briefly to open list options"
    >
      <View style={styles.cardRow}>
        <View style={styles.cardIconBlob}>
          <Ionicons name="cart" size={22} color="#fff" />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.cardMeta}>
            {item.items.length} item{item.items.length === 1 ? "" : "s"} · Updated{" "}
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
          <Text style={styles.title}>SayCart</Text>
          <Text style={styles.subtitle}>Your grocery lists</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={toggleScheme}
            accessibilityRole="button"
            accessibilityLabel={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate("History")}
            accessibilityRole="button"
            accessibilityLabel="Open completed lists"
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
        <SectionList
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
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 120 },
          ]}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="basket-outline" size={48} color={colors.borderMuted} />
              <Text style={styles.emptyTitle}>No lists yet</Text>
              <Text style={styles.emptyText}>Create your first grocery list below.</Text>
            </View>
          }
          SectionSeparatorComponent={() => <View style={{ height: 4 }} />}
        />
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => navigation.navigate("CreateList")}
          activeOpacity={0.9}
        >
          <Ionicons name="add-circle-outline" size={22} color="#fff" />
          <Text style={styles.primaryBtnText}>Create New List</Text>
        </TouchableOpacity>
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
                  <TouchableOpacity
                    onPress={closeMenu}
                    style={styles.menuClose}
                    accessibilityRole="button"
                    accessibilityLabel="Close menu"
                  >
                    <Ionicons name="close" size={26} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.menuRow} onPress={openEditFromMenu} activeOpacity={0.85}>
                  <Ionicons name="open-outline" size={22} color={colors.primary} />
                  <Text style={styles.menuRowText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.menuRow}
                  onPress={prioritizeFromMenu}
                  activeOpacity={0.85}
                >
                  <Ionicons name="arrow-up-circle-outline" size={22} color={colors.primary} />
                  <Text style={styles.menuRowText}>Prioritize</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.menuRowDanger}
                  onPress={deleteFromMenu}
                  activeOpacity={0.85}
                >
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
