import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { TodoListDetailProps } from "../navigation/types";
import { useAppData } from "../context/AppDataContext";
import { useToolTheme } from "../hooks/useToolTheme";
import type { AppThemeColors } from "../theme/colors";
import type { TodoHistoryEntry, TodoItem, TodoList } from "../types";
import { generateId } from "../utils/id";
import {
  allTodosCommittedDone,
  normalizeTodoItemsForPersist,
  splitTodoActiveAndCompleted,
} from "../utils/todoItems";

function nowIso(): string {
  return new Date().toISOString();
}

function createStyles(c: AppThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingBottom: 8,
      gap: 8,
    },
    back: { flexDirection: "row", alignItems: "center", padding: 8, width: 88 },
    backText: { fontSize: 16, fontWeight: "600", color: c.text },
    listTitle: { flex: 1, fontSize: 18, fontWeight: "800", color: c.text, textAlign: "center" },
    fabAdd: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    listBody: { flex: 1, paddingHorizontal: 16 },
    sectionLabel: {
      fontSize: 12,
      fontWeight: "800",
      color: c.textTertiary,
      letterSpacing: 0.6,
      marginTop: 12,
      marginBottom: 8,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.card,
      borderRadius: 14,
      padding: 12,
      marginBottom: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      gap: 10,
    },
    rowMuted: { opacity: 0.72 },
    rowTap: { flex: 1, minWidth: 0 },
    itemName: { fontSize: 16, fontWeight: "700", color: c.text },
    strikeText: { textDecorationLine: "line-through" },
    actionCol: { alignItems: "flex-end", gap: 6 },
    starBtn: { padding: 4 },
    checkBtn: {
      backgroundColor: c.primaryDark,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
    },
    checkText: { color: "#fff", fontWeight: "800", fontSize: 12 },
    undoBtn: {
      backgroundColor: c.warningOrange,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 10,
    },
    undoText: { color: "#fff", fontWeight: "800", fontSize: 12 },
    uncheckBtn: {
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: c.inputBg,
    },
    uncheckText: { color: c.textSecondary, fontWeight: "700", fontSize: 12 },
    emptyWrap: { alignItems: "center", paddingVertical: 40 },
    emptyTitle: { marginTop: 8, fontSize: 17, fontWeight: "700", color: c.textTertiary },
    emptyText: { marginTop: 6, fontSize: 14, color: c.placeholder, textAlign: "center" },
    modalRoot: { flex: 1, backgroundColor: c.overlayStrong, justifyContent: "flex-end" },
    modalCard: {
      backgroundColor: c.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 16,
      gap: 12,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    modalTitle: { fontSize: 17, fontWeight: "800", color: c.text },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: c.text,
      backgroundColor: c.inputBg,
    },
    saveBtn: {
      backgroundColor: c.primary,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
    },
    saveBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  });
}

export default function TodoListDetailScreen({ navigation, route }: TodoListDetailProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useToolTheme("todo");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { listId, autoOpenAdd = false } = route.params;
  const { todoLists, loading, upsertTodoList, archiveTodoCompletedList } = useAppData();

  const list = useMemo(() => todoLists.find((l) => l.id === listId) ?? null, [todoLists, listId]);
  const listRef = useRef<TodoList | null>(list);
  listRef.current = list;

  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const finishingListRef = useRef(false);
  const autoOpenHandledRef = useRef(false);

  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");

  const pushList = useCallback(
    (next: TodoList) => {
      upsertTodoList({ ...next, updatedAt: nowIso() });
    },
    [upsertTodoList]
  );

  useFocusEffect(
    useCallback(() => {
      if (loading) return;
      if (list || finishingListRef.current) return;
      navigation.goBack();
    }, [list, loading, navigation])
  );

  const clearTimer = (itemId: string) => {
    const t = timersRef.current[itemId];
    if (t) clearTimeout(t);
    delete timersRef.current[itemId];
  };

  const nextActiveOrder = () => {
    const snap = listRef.current;
    if (!snap) return 0;
    const { active } = splitTodoActiveAndCompleted(snap.items);
    return active.reduce((m, i) => Math.max(m, i.order), -1) + 1;
  };

  const commitCheck = useCallback(
    async (itemId: string) => {
      const snap = listRef.current;
      if (!snap) return;
      const { completed } = splitTodoActiveAndCompleted(snap.items);
      const target = snap.items.find((i) => i.id === itemId);
      if (!target || !target.checked || !target.checkPending) return;

      const maxDone = completed.reduce((m, i) => Math.max(m, i.order), -1);
      const nextOrder = maxDone + 1;
      const items = snap.items.map((i) =>
        i.id === itemId ? { ...i, checkPending: false, order: nextOrder } : i
      );

      if (allTodosCommittedDone(items)) {
        const entry: TodoHistoryEntry = {
          id: generateId(),
          sourceListId: snap.id,
          name: snap.name,
          createdAt: snap.createdAt,
          updatedAt: nowIso(),
          items: normalizeTodoItemsForPersist(
            items.map((i) => ({ ...i, checked: true, checkPending: false }))
          ),
        };
        finishingListRef.current = true;
        try {
          await archiveTodoCompletedList(entry);
          navigation.replace("AllDone", { listId: snap.id, tool: "todo" });
        } catch {
          finishingListRef.current = false;
        }
      } else {
        pushList({ ...snap, items });
      }
    },
    [archiveTodoCompletedList, navigation, pushList]
  );

  const commitOrFinish = useCallback(
    async (base: TodoList, nextItems: TodoItem[]) => {
      if (allTodosCommittedDone(nextItems)) {
        const entry: TodoHistoryEntry = {
          id: generateId(),
          sourceListId: base.id,
          name: base.name,
          createdAt: base.createdAt,
          updatedAt: nowIso(),
          items: normalizeTodoItemsForPersist(
            nextItems.map((i) => ({ ...i, checked: true, checkPending: false }))
          ),
        };
        finishingListRef.current = true;
        try {
          await archiveTodoCompletedList(entry);
          navigation.replace("AllDone", { listId: base.id, tool: "todo" });
        } catch {
          finishingListRef.current = false;
        }
        return;
      }
      pushList({ ...base, items: nextItems });
    },
    [archiveTodoCompletedList, navigation, pushList]
  );

  const onTapCheck = (itemId: string) => {
    const snap = listRef.current;
    if (!snap) return;
    clearTimer(itemId);
    const items = snap.items.map((i) =>
      i.id === itemId ? { ...i, checked: true, checkPending: true } : i
    );
    pushList({ ...snap, items });
    timersRef.current[itemId] = setTimeout(() => void commitCheck(itemId), 1000);
  };

  const onTapUndo = (itemId: string) => {
    const snap = listRef.current;
    if (!snap) return;
    clearTimer(itemId);
    const items = snap.items.map((i) =>
      i.id === itemId ? { ...i, checked: false, checkPending: false } : i
    );
    pushList({ ...snap, items });
  };

  const onTapUncheck = (itemId: string) => {
    const snap = listRef.current;
    if (!snap) return;
    clearTimer(itemId);
    const { active } = splitTodoActiveAndCompleted(snap.items.filter((i) => i.id !== itemId));
    const maxActive = active.reduce((m, i) => Math.max(m, i.order), -1);
    const items = snap.items.map((i) =>
      i.id === itemId
        ? { ...i, checked: false, checkPending: false, order: maxActive + 1 }
        : i
    );
    pushList({ ...snap, items });
  };

  const togglePriority = (itemId: string) => {
    const snap = listRef.current;
    if (!snap) return;
    const items = snap.items.map((i) =>
      i.id === itemId ? { ...i, priority: !i.priority } : i
    );
    pushList({ ...snap, items });
  };

  const openAdd = () => {
    setEditingId(null);
    setFormName("");
    setModalMode("add");
  };

  const openEdit = (item: TodoItem) => {
    if (item.checkPending) return;
    setEditingId(item.id);
    setFormName(item.name);
    setModalMode("edit");
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingId(null);
    setFormName("");
  };

  const onSaveAdd = () => {
    const snap = listRef.current;
    if (!snap) return;
    if (!formName.trim()) return;
    const item: TodoItem = {
      id: generateId(),
      name: formName.trim(),
      checked: false,
      order: nextActiveOrder(),
    };
    pushList({ ...snap, items: [...snap.items, item] });
    closeModal();
  };

  const onSaveEdit = () => {
    const snap = listRef.current;
    if (!snap || !editingId) return;
    if (!formName.trim()) return;
    const items = snap.items.map((i) =>
      i.id === editingId ? { ...i, name: formName.trim() } : i
    );
    pushList({ ...snap, items });
    closeModal();
  };

  const onConfirmDelete = () => {
    const snap = listRef.current;
    if (!snap || !editingId) return;
    Alert.alert("Delete task", "Remove this task?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          const items = snap.items.filter((i) => i.id !== editingId);
          pushList({ ...snap, items });
          closeModal();
        },
      },
    ]);
  };

  useEffect(() => {
    if (!autoOpenAdd) return;
    if (autoOpenHandledRef.current) return;
    if (!list) return;
    if (modalMode !== null) return;
    if (list.items.length !== 0) return;
    autoOpenHandledRef.current = true;
    openAdd();
  }, [autoOpenAdd, list, modalMode]);

  if (!list) return null;

  const { active, completed } = splitTodoActiveAndCompleted(list.items);

  const renderRow = (item: TodoItem) => {
    const isPending = item.checked && item.checkPending;
    const isDone = item.checked && !item.checkPending;
    const rowMuted = item.checked;
    return (
      <TouchableOpacity
        style={[styles.row, rowMuted && styles.rowMuted]}
        onPress={() => openEdit(item)}
        activeOpacity={0.9}
      >
        <View style={styles.rowTap}>
          <Text style={[styles.itemName, rowMuted && styles.strikeText]} numberOfLines={2}>
            {item.name || "Task"}
          </Text>
        </View>
        <View style={styles.actionCol}>
          <TouchableOpacity
            style={styles.starBtn}
            onPress={() => togglePriority(item.id)}
            accessibilityLabel={item.priority ? "Unpin priority" : "Prioritize"}
          >
            <Ionicons
              name={item.priority ? "star" : "star-outline"}
              size={18}
              color={item.priority ? colors.micIcon : colors.placeholder}
            />
          </TouchableOpacity>
          {isPending ? (
            <TouchableOpacity style={styles.undoBtn} onPress={() => onTapUndo(item.id)}>
              <Text style={styles.undoText}>Undo</Text>
            </TouchableOpacity>
          ) : isDone ? (
            <TouchableOpacity style={styles.uncheckBtn} onPress={() => onTapUncheck(item.id)}>
              <Text style={styles.uncheckText}>Uncheck</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.checkBtn} onPress={() => onTapCheck(item.id)}>
              <Text style={styles.checkText}>CHECK</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
          <Text style={styles.backText}>Lists</Text>
        </TouchableOpacity>
        <Text style={styles.listTitle} numberOfLines={1}>
          {list.name}
        </Text>
        <TouchableOpacity style={styles.fabAdd} onPress={openAdd} accessibilityLabel="Add task">
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.listBody}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {active.length === 0 && completed.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="checkbox-outline" size={42} color={colors.borderMuted} />
            <Text style={styles.emptyTitle}>No tasks yet</Text>
            <Text style={styles.emptyText}>Tap + to add your first task.</Text>
          </View>
        ) : null}
        {active.map((item) => (
          <View key={item.id}>{renderRow(item)}</View>
        ))}
        {completed.length ? <Text style={styles.sectionLabel}>Done</Text> : null}
        {completed.map((item) => (
          <View key={item.id}>{renderRow(item)}</View>
        ))}
      </ScrollView>

      <Modal visible={modalMode !== null} transparent animationType="slide" onRequestClose={closeModal}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalRoot}
        >
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={closeModal} />
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              {modalMode === "edit" ? (
                <TouchableOpacity onPress={onConfirmDelete} accessibilityLabel="Delete task">
                  <Ionicons name="trash-outline" size={24} color={colors.danger} />
                </TouchableOpacity>
              ) : (
                <View style={{ width: 24 }} />
              )}
              <Text style={styles.modalTitle}>{modalMode === "add" ? "New task" : "Edit task"}</Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={26} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
            <TextInput
              value={formName}
              onChangeText={setFormName}
              placeholder="Task name"
              placeholderTextColor={colors.placeholder}
              style={styles.input}
              autoFocus
            />
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={modalMode === "add" ? onSaveAdd : onSaveEdit}
            >
              <Text style={styles.saveBtnText}>{modalMode === "add" ? "Add" : "Save"}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
