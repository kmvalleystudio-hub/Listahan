import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { NoteEditorProps } from "../navigation/types";
import { useToolTheme } from "../hooks/useToolTheme";
import type { AppThemeColors } from "../theme/colors";
import {
  deleteQuickNote,
  loadQuickNotes,
  newQuickNoteId,
  upsertOrDeleteIfEmpty,
} from "../utils/quickNotesStorage";

function createStyles(c: AppThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    header: {
      paddingHorizontal: 16,
      paddingBottom: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      backgroundColor: c.background,
    },
    backRow: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 8 },
    backText: { fontSize: 16, fontWeight: "600", color: c.linkBlue },
    headerTitle: { fontSize: 17, fontWeight: "700", color: c.text, flex: 1, textAlign: "center" },
    trashBtn: { padding: 8 },
    inputWrap: {
      flex: 1,
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 8,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.card,
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 12,
      minHeight: 200,
    },
    input: {
      flex: 1,
      fontSize: 17,
      lineHeight: 24,
      color: c.text,
      textAlignVertical: "top",
      minHeight: 180,
    },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
  });
}

export default function NoteEditorScreen({ navigation, route }: NoteEditorProps) {
  const insets = useSafeAreaInsets();
  const paramId = route.params?.noteId;
  const { colors } = useToolTheme("notes");
  const styles = useMemo(() => createStyles(colors), [colors]);

  const noteIdRef = useRef(paramId ?? newQuickNoteId());
  const [body, setBody] = useState("");
  const [loaded, setLoaded] = useState(false);
  const bodyRef = useRef(body);
  bodyRef.current = body;

  const flushSave = useCallback(async (text: string) => {
    await upsertOrDeleteIfEmpty({
      id: noteIdRef.current,
      body: text,
      updatedAt: new Date().toISOString(),
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!paramId) {
      setLoaded(true);
      return () => {
        cancelled = true;
      };
    }
    void loadQuickNotes().then((all) => {
      if (cancelled) return;
      const n = all.find((x) => x.id === paramId);
      if (!n) {
        navigation.goBack();
        return;
      }
      setBody(n.body);
      noteIdRef.current = n.id;
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [navigation, paramId]);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      void flushSave(body);
    }, 500);
    return () => clearTimeout(t);
  }, [body, loaded, flushSave]);

  useEffect(() => {
    const sub = navigation.addListener("beforeRemove", () => {
      void flushSave(bodyRef.current);
    });
    return sub;
  }, [navigation, flushSave]);

  const onDelete = useCallback(() => {
    Alert.alert("Delete this note?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void (async () => {
            await deleteQuickNote(noteIdRef.current);
            navigation.goBack();
          })();
        },
      },
    ]);
  }, [navigation]);

  if (!loaded) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 4 }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backRow}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back to notes"
          >
            <Ionicons name="chevron-back" size={22} color={colors.linkBlue} />
            <Text style={styles.backText}>Notes</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Loading
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top + 4, paddingBottom: insets.bottom + 8 }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 6 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backRow}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.linkBlue} />
          <Text style={styles.backText}>Notes</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {paramId ? "Edit" : "New"}
        </Text>
        {paramId ? (
          <TouchableOpacity
            style={styles.trashBtn}
            onPress={onDelete}
            accessibilityRole="button"
            accessibilityLabel="Delete note"
          >
            <Ionicons name="trash-outline" size={22} color={colors.danger} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          value={body}
          onChangeText={setBody}
          placeholder="Write anything…"
          placeholderTextColor={colors.placeholder}
          multiline
          autoFocus={!paramId}
          scrollEnabled
          textAlignVertical="top"
        />
      </View>
    </KeyboardAvoidingView>
  );
}
