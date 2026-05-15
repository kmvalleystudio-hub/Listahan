import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { NotesHomeProps } from "../navigation/types";
import { useToolTheme } from "../hooks/useToolTheme";
import type { AppThemeColors } from "../theme/colors";
import { ToolHomeFooterListScrim } from "../components/ToolHomeFooterListScrim";
import {
  toolHomeFloatingAddButtonDarkLift,
  toolHomeFloatingAddButtonUpwardGlowWrap,
  toolHomeListFadeBottomOffset,
} from "../theme/toolHomeFloatingAddButton";
import {
  deleteQuickNote,
  loadQuickNotes,
  type QuickNote,
} from "../utils/quickNotesStorage";

function previewLine(body: string): string {
  const t = body.trim();
  if (!t) return "Empty note";
  const line = t.split(/\r?\n/)[0] ?? t;
  return line.length > 120 ? `${line.slice(0, 117)}…` : line;
}

function formatUpdated(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Mirrors `GroceryHomeScreen` / `TodoHomeScreen` — header + list + bottom primary CTA. */
function createStyles(c: AppThemeColors, isDark: boolean) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    /** Match `GroceryHomeScreen` / `TodoHomeScreen` — no header elevation (avoids shadow under title). */
    header: {
      paddingHorizontal: 20,
      paddingBottom: 12,
      flexShrink: 0,
    },
    bodyFill: {
      flex: 1,
      minHeight: 0,
    },
    /** No `flex:1` here — unlike grocery row, this is the only header column; flex would steal height on Android. */
    headerTextCol: { alignSelf: "stretch" },
    backRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6 },
    backTextSmall: { fontSize: 14, fontWeight: "600", color: c.linkBlue },
    title: { fontSize: 28, fontWeight: "800", color: c.text },
    subtitle: { marginTop: 4, fontSize: 15, color: c.textTertiary },
    listContent: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
    card: {
      backgroundColor: c.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    cardPressed: { opacity: 0.92 },
    rowTitle: { fontSize: 16, fontWeight: "700", color: c.text },
    rowMeta: { marginTop: 6, fontSize: 13, color: c.placeholder },
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
      shadowColor: c.primaryDark,
      shadowOpacity: 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
      ...toolHomeFloatingAddButtonDarkLift(isDark, c),
    },
    primaryBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  });
}

export default function NotesHomeScreen({ navigation }: NotesHomeProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useToolTheme("notes");
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [notes, setNotes] = useState<QuickNote[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const list = await loadQuickNotes();
    setNotes(list);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const onNew = useCallback(() => {
    navigation.navigate("NoteEditor", {});
  }, [navigation]);

  const onOpen = useCallback(
    (id: string) => {
      navigation.navigate("NoteEditor", { noteId: id });
    },
    [navigation]
  );

  const onDeleteNote = useCallback(
    (note: QuickNote) => {
      Alert.alert("Delete note?", "This cannot be undone.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              await deleteQuickNote(note.id);
              await refresh();
            })();
          },
        },
      ]);
    },
    [refresh]
  );

  const listBottomPad = insets.bottom + 120;

  if (loading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
        <View style={styles.header} collapsable={false}>
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
            <Text style={styles.title}>Notes</Text>
          </View>
        </View>
        <View style={[styles.bodyFill, styles.center]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header} collapsable={false}>
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
          <Text style={styles.title}>Notes</Text>
          <Text style={styles.subtitle}>Quick capture — use the button below. Long-press a note to delete.</Text>
        </View>
      </View>

      <View style={[styles.bodyFill, { position: "relative" }]}>
        {notes.length === 0 ? (
          <View style={[styles.empty, { paddingBottom: listBottomPad }]}>
            <Ionicons name="document-text-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No notes yet</Text>
            <Text style={styles.emptyText}>Tap below to add your first note.</Text>
          </View>
        ) : (
          <FlatList
            data={notes}
            keyExtractor={(item) => item.id}
            style={{ flex: 1 }}
            contentContainerStyle={[styles.listContent, { paddingBottom: listBottomPad }]}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                onPress={() => onOpen(item.id)}
                onLongPress={() => onDeleteNote(item)}
                accessibilityRole="button"
                accessibilityLabel={`Note: ${previewLine(item.body)}`}
              >
                <Text style={styles.rowTitle} numberOfLines={3}>
                  {previewLine(item.body)}
                </Text>
                <Text style={styles.rowMeta}>{formatUpdated(item.updatedAt)}</Text>
              </Pressable>
            )}
          />
        )}
        <ToolHomeFooterListScrim
          isDark={isDark}
          backgroundColor={colors.background}
          bottomOffset={toolHomeListFadeBottomOffset(insets.bottom)}
        />
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <View style={toolHomeFloatingAddButtonUpwardGlowWrap(isDark, colors)}>
          <TouchableOpacity style={styles.primaryBtn} onPress={onNew} activeOpacity={0.9}>
            <Ionicons name="add-circle-outline" size={22} color="#fff" />
            <Text style={styles.primaryBtnText}>Add note</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
