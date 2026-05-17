import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Alert,
  ScrollView,
  Pressable,
  Animated,
} from "react-native";
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from "react-native-draggable-flatlist";
import Reanimated, { makeMutable, type SharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import type { PrivateListDetailProps } from "../navigation/types";
import { useAppData } from "../context/AppDataContext";
import { useToolTheme } from "../hooks/useToolTheme";
import type { PrivateItem, PrivateList } from "../types";
import { generateId } from "../utils/id";
import {
  dedupePrivateItemsByName,
  normalizePrivateItemsForPersist,
  reindexPrivateOrders,
  sortPrivateItemsForDisplay,
} from "../utils/privateItems";
import { useSpeechToText } from "../hooks/useSpeechToText";
import { createListDetailStyles } from "./listDetailStyles";
import PrivateVaultGate from "../components/PrivateVaultGate";

function nowIso(): string {
  return new Date().toISOString();
}

const VOICE_IDLE_MS_AFTER_FIRST_WORD = 2000;

/** Row / bulk chrome: readable on light vault sheet cards. */
const PRIVATE_ROW_ICON = "#374151";
const PRIVATE_ROW_ICON_MUTED = "#9CA3AF";
const PRIVATE_STAR_FILLED = "#B45309";

/**
 * Read-only entry preview: fixed charcoal palette so it stays “vault gray”
 * whether the app is in light or dark mode.
 */
const vaultPreviewStyles = StyleSheet.create({
  card: {
    backgroundColor: "#1C1C1E",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  headerTitle: {
    flex: 1,
    marginHorizontal: 8,
    fontSize: 17,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  fieldsCol: {
    gap: 10,
  },
  cell: {
    backgroundColor: "#2C2C2E",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.06)",
  },
  cellLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  fieldValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#F2F2F7",
    lineHeight: 22,
  },
  fieldValueMuted: {
    color: "#636366",
    fontWeight: "500",
  },
  secretValue: {
    fontSize: 17,
    fontWeight: "700",
  },
  notesValue: {
    minHeight: 44,
    textAlignVertical: "top",
  },
  eyeBtn: {
    padding: 4,
    marginRight: -4,
  },
  editBtn: {
    marginTop: 4,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: "#48484A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
  },
  editBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});

const REORDER_SPRING = {
  damping: 20,
  mass: 0.2,
  stiffness: 100,
  overshootClamping: false,
  restDisplacementThreshold: 0.2,
  restSpeedThreshold: 0.2,
} as const;

function privateDisplayIdsJoin(items: PrivateItem[]): string {
  return sortPrivateItemsForDisplay(items)
    .map((i) => i.id)
    .join(",");
}

function measureRowWindowY(
  refs: React.MutableRefObject<Map<string, View>>,
  ids: string[]
): Promise<Record<string, number>> {
  const ys: Record<string, number> = {};
  return Promise.all(
    ids.map(
      (id) =>
        new Promise<void>((resolve) => {
          const node = refs.current.get(id);
          if (!node) {
            resolve();
            return;
          }
          node.measureInWindow((_x, y) => {
            ys[id] = y;
            resolve();
          });
        })
    )
  ).then(() => ys);
}

function FlipTranslateShell({
  itemId,
  getFlipSv,
  children,
}: {
  itemId: string;
  getFlipSv: (id: string) => SharedValue<number>;
  children: React.ReactNode;
}) {
  const sv = getFlipSv(itemId);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: sv.value }] }), [sv]);
  return <Reanimated.View style={style}>{children}</Reanimated.View>;
}

type ItemModalMode = "add" | "edit" | null;

export default function PrivateListDetailScreen({ navigation, route }: PrivateListDetailProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useToolTheme("private_list");
  const styles = useMemo(() => createListDetailStyles(colors), [colors]);
  const privateEntryRowStyles = useMemo(
    () =>
      StyleSheet.create({
        rowCard: {
          borderRadius: 16,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 3,
        },
        rowPriority: {
          borderLeftWidth: 3,
          borderLeftColor: "#F59E0B",
        },
        rowTapInner: {
          flex: 1,
          minWidth: 0,
          justifyContent: "center",
          paddingVertical: 2,
          gap: 4,
        },
        rowTapRow: {
          flex: 1,
          minWidth: 0,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
        },
        mainColumn: {
          flex: 1,
          minWidth: 0,
        },
        rowMainLine: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          minWidth: 0,
        },
        starBtnOuter: {
          flexShrink: 0,
          zIndex: 3,
          paddingLeft: 2,
        },
        starBtnHit: {
          width: 36,
          height: 36,
          alignItems: "center",
          justifyContent: "center",
        },
        entryTitle: {
          flex: 1,
          minWidth: 0,
          fontSize: 17,
          fontWeight: "800",
          color: colors.text,
        },
        rowSubtitle: {
          fontSize: 13,
          fontWeight: "500",
          color: colors.textTertiary,
        },
      }),
    [colors]
  );
  const privateBulkStyles = useMemo(
    () =>
      StyleSheet.create({
        bulkCircleBtn: {
          width: 46,
          height: 46,
          borderRadius: 23,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#E5E7EB",
          borderWidth: 1,
          borderColor: "#9CA3AF",
          shadowColor: "#000",
          shadowOpacity: 0.1,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
          elevation: 4,
        },
        bulkCircleBtnDisabled: {
          opacity: 0.42,
        },
        bulkCircleBtnDanger: {
          width: 46,
          height: 46,
          borderRadius: 23,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#FEE2E2",
          borderWidth: 1,
          borderColor: "#EF4444",
          shadowColor: "#000",
          shadowOpacity: 0.08,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3,
        },
        bulkCircleBtnDangerDisabled: {
          opacity: 0.42,
        },
      }),
    []
  );
  const { listId, autoOpenAdd = false } = route.params;
  const { privateLists, loading, upsertPrivateList } = useAppData();

  const rowMeasureRefs = useRef<Map<string, View>>(new Map());
  const flipSvRef = useRef<Map<string, SharedValue<number>>>(new Map());
  const flipReorderPendingRef = useRef<{ beforeYs: Record<string, number> } | null>(null);

  const getFlipSv = useCallback((id: string) => {
    let v = flipSvRef.current.get(id);
    if (!v) {
      v = makeMutable(0);
      flipSvRef.current.set(id, v);
    }
    return v;
  }, []);

  const list = useMemo(() => privateLists.find((l) => l.id === listId) ?? null, [privateLists, listId]);
  const displayItems = useMemo(() => (list ? sortPrivateItemsForDisplay(list.items) : []), [list]);
  const activeReorderExtraData = useMemo(() => {
    if (!list) return "";
    return displayItems.map((i) => `${i.id}:${i.priority ? 1 : 0}:${i.order}`).join("|");
  }, [list, displayItems]);
  const listRef = useRef<PrivateList | null>(list);
  listRef.current = list;

  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const finishingListRef = useRef(false);
  const autoOpenHandledRef = useRef(false);

  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const wiggleIdRef = useRef<string | null>(null);
  const wiggleAnim = useRef(new Animated.Value(0)).current;

  const { start: startSpeech, stop: stopSpeech, listening } = useSpeechToText();
  const [voiceTarget, setVoiceTarget] = useState<"name" | "username" | "notes" | null>(null);
  const voiceIdleAfterWordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearVoiceIdleStopTimer = useCallback(() => {
    const t = voiceIdleAfterWordTimerRef.current;
    if (t) {
      clearTimeout(t);
      voiceIdleAfterWordTimerRef.current = null;
    }
  }, []);

  const maybeScheduleVoiceIdleStopAfterFirstToken = useCallback(
    (transcript: string) => {
      if (!transcript.trim()) return;
      clearVoiceIdleStopTimer();
      voiceIdleAfterWordTimerRef.current = setTimeout(() => {
        voiceIdleAfterWordTimerRef.current = null;
        stopSpeech();
      }, VOICE_IDLE_MS_AFTER_FIRST_WORD);
    },
    [stopSpeech, clearVoiceIdleStopTimer]
  );

  const [itemModalMode, setItemModalMode] = useState<ItemModalMode>(null);
  const [viewItem, setViewItem] = useState<PrivateItem | null>(null);
  const [viewSecretVisible, setViewSecretVisible] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formSecret, setFormSecret] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [secretVisible, setSecretVisible] = useState(false);
  const [itemModalKeyboardInset, setItemModalKeyboardInset] = useState(0);
  const itemModalOpen = itemModalMode !== null;

  useEffect(() => {
    if (!itemModalOpen) {
      setItemModalKeyboardInset(0);
      return;
    }
    if (Platform.OS !== "android") return;
    const onShow = (e: { endCoordinates: { height: number } }) => {
      setItemModalKeyboardInset(e.endCoordinates.height);
    };
    const onHide = () => setItemModalKeyboardInset(0);
    const subShow = Keyboard.addListener("keyboardDidShow", onShow);
    const subHide = Keyboard.addListener("keyboardDidHide", onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [itemModalOpen]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        Object.values(timersRef.current).forEach(clearTimeout);
        timersRef.current = {};
        stopSpeech();
        clearVoiceIdleStopTimer();
      };
    }, [stopSpeech, clearVoiceIdleStopTimer])
  );

  useEffect(() => {
    if (!listening) {
      clearVoiceIdleStopTimer();
      setVoiceTarget(null);
    }
  }, [listening, clearVoiceIdleStopTimer]);

  useEffect(() => {
    finishingListRef.current = false;
    autoOpenHandledRef.current = false;
    setBulkMode(false);
    setSelectedIds(new Set());
    wiggleIdRef.current = null;
    rowMeasureRefs.current.clear();
    flipSvRef.current.clear();
    flipReorderPendingRef.current = null;
    setViewItem(null);
    setViewSecretVisible(false);
  }, [listId]);

  useFocusEffect(
    useCallback(() => {
      if (loading) return;
      if (list || finishingListRef.current) return;
      navigation.goBack();
    }, [list, loading, navigation])
  );

  const pushList = useCallback(
    (next: PrivateList) => {
      upsertPrivateList({ ...next, updatedAt: nowIso() });
    },
    [upsertPrivateList]
  );

  const pushListWithActiveFlip = useCallback(
    (next: PrivateList) => {
      const prev = listRef.current;
      if (!prev) {
        pushList(next);
        return;
      }
      if (privateDisplayIdsJoin(prev.items) === privateDisplayIdsJoin(next.items)) {
        pushList(next);
        return;
      }
      const ids = new Set<string>();
      sortPrivateItemsForDisplay(prev.items).forEach((i) => ids.add(i.id));
      sortPrivateItemsForDisplay(next.items).forEach((i) => ids.add(i.id));
      void measureRowWindowY(rowMeasureRefs, [...ids]).then((beforeYs) => {
        flipReorderPendingRef.current = { beforeYs };
        pushList(next);
      });
    },
    [pushList]
  );

  useLayoutEffect(() => {
    if (!list) return;
    const pending = flipReorderPendingRef.current;
    if (!pending) return;
    flipReorderPendingRef.current = null;
    const { beforeYs } = pending;
    const activeIds = sortPrivateItemsForDisplay(list.items).map((i) => i.id);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        void measureRowWindowY(rowMeasureRefs, activeIds).then((afterYs) => {
          for (const id of activeIds) {
            const b = beforeYs[id];
            const a = afterYs[id];
            if (b === undefined || a === undefined) continue;
            const dy = b - a;
            if (Math.abs(dy) < 2) continue;
            const sv = getFlipSv(id);
            sv.value = dy;
            sv.value = withSpring(0, REORDER_SPRING);
          }
        });
      });
    });
  }, [list, getFlipSv]);

  useEffect(() => {
    if (!list) return;
    const deduped = dedupePrivateItemsByName(list.items);
    if (deduped.length !== list.items.length) {
      pushList({ ...list, items: deduped });
    }
  }, [list, pushList]);

  const clearTimer = (itemId: string) => {
    const t = timersRef.current[itemId];
    if (t) clearTimeout(t);
    delete timersRef.current[itemId];
  };

  const togglePriority = (itemId: string, next?: boolean) => {
    const snap = listRef.current;
    if (!snap) return;
    const items = snap.items.map((i) =>
      i.id === itemId ? { ...i, priority: next ?? !i.priority } : i
    );
    pushListWithActiveFlip({ ...snap, items });
  };

  const startWiggle = () => {
    wiggleAnim.setValue(0);
    Animated.sequence([
      Animated.timing(wiggleAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(wiggleAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  const enterBulkMode = (itemId: string) => {
    wiggleIdRef.current = itemId;
    startWiggle();
    setBulkMode(true);
    setSelectedIds((prev) => new Set([...prev, itemId]));
  };

  const exitBulkMode = () => {
    setBulkMode(false);
    setSelectedIds(new Set());
    wiggleIdRef.current = null;
  };

  const toggleSelected = (itemId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      if (next.size === 0) {
        wiggleIdRef.current = null;
      }
      return next;
    });
  };

  const bulkDeleteSelected = () => {
    const snap = listRef.current;
    if (!snap || selectedIds.size === 0) return;
    Alert.alert("Delete entries", `Remove ${selectedIds.size} selected entr${selectedIds.size === 1 ? "y" : "ies"}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          const items = normalizePrivateItemsForPersist(snap.items.filter((i) => !selectedIds.has(i.id)));
          pushListWithActiveFlip({ ...snap, items: reindexPrivateOrders(items) });
          exitBulkMode();
        },
      },
    ]);
  };

  const confirmBulkPrioritySelected = (nextPriority: boolean) => {
    const snap = listRef.current;
    if (!snap || selectedIds.size === 0) return;
    Alert.alert("Bulk prioritize", `Prioritize ${selectedIds.size} entr${selectedIds.size === 1 ? "y" : "ies"}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: () => {
          const current = listRef.current;
          if (!current) return;
          const items = current.items.map((i) =>
            selectedIds.has(i.id) ? { ...i, priority: nextPriority } : i
          );
          pushListWithActiveFlip({ ...current, items });
        },
      },
    ]);
  };

  const onDragEnd = ({ data }: { data: PrivateItem[] }) => {
    const snap = listRef.current;
    if (!snap) return;
    const reindexed = reindexPrivateOrders(normalizePrivateItemsForPersist(data));
    pushList({ ...snap, items: reindexed });
  };

  const nextActiveOrder = () => {
    const snap = listRef.current;
    if (!snap) return 0;
    return snap.items.reduce((m, i) => Math.max(m, i.order), -1) + 1;
  };

  const closeItemModal = () => {
    stopSpeech();
    clearVoiceIdleStopTimer();
    setItemModalMode(null);
    setEditingItemId(null);
    setFormName("");
    setFormUsername("");
    setFormSecret("");
    setFormNotes("");
    setSecretVisible(false);
    setViewItem(null);
    setViewSecretVisible(false);
  };

  const closeViewModal = () => {
    setViewItem(null);
    setViewSecretVisible(false);
  };

  const openViewModal = (item: PrivateItem) => {
    stopSpeech();
    clearVoiceIdleStopTimer();
    setViewSecretVisible(false);
    setViewItem(item);
  };

  const openEditFromView = () => {
    if (!viewItem) return;
    const latest = listRef.current?.items.find((i) => i.id === viewItem.id) ?? viewItem;
    closeViewModal();
    openEditModal(latest);
  };

  const openAddModal = () => {
    stopSpeech();
    clearVoiceIdleStopTimer();
    setViewItem(null);
    setViewSecretVisible(false);
    setEditingItemId(null);
    setFormName("");
    setFormUsername("");
    setFormSecret("");
    setFormNotes("");
    setSecretVisible(false);
    setItemModalMode("add");
  };

  const openEditModal = (item: PrivateItem) => {
    stopSpeech();
    clearVoiceIdleStopTimer();
    setEditingItemId(item.id);
    setFormName(item.name);
    setFormUsername(item.username ?? "");
    setFormSecret(item.secret ?? "");
    setFormNotes(item.notes ?? "");
    setSecretVisible(false);
    setItemModalMode("edit");
  };

  useEffect(() => {
    if (!autoOpenAdd) return;
    if (autoOpenHandledRef.current) return;
    if (!list) return;
    if (itemModalMode !== null) return;
    if (viewItem !== null) return;
    if (list.items.length !== 0) return;
    autoOpenHandledRef.current = true;
    openAddModal();
    navigation.setParams({ autoOpenAdd: false });
  }, [autoOpenAdd, itemModalMode, viewItem, list, navigation]);

  const onSaveAdd = () => {
    const snap = listRef.current;
    if (!snap) return;
    if (!formName.trim()) return;
    const username = formUsername.trim();
    const secret = formSecret.trim();
    const notes = formNotes.trim();
    const item: PrivateItem = {
      id: generateId(),
      name: formName.trim(),
      ...(username ? { username } : {}),
      ...(secret ? { secret } : {}),
      ...(notes ? { notes } : {}),
      order: nextActiveOrder(),
    };
    pushList({ ...snap, items: dedupePrivateItemsByName([...snap.items, item]) });
    closeItemModal();
  };

  const onSaveEdit = () => {
    const snap = listRef.current;
    if (!snap || !editingItemId) return;
    if (!formName.trim()) return;
    const username = formUsername.trim();
    const secret = formSecret.trim();
    const notes = formNotes.trim();
    const items = snap.items.map((i) =>
      i.id === editingItemId
        ? {
            ...i,
            name: formName.trim(),
            username: username || undefined,
            secret: secret || undefined,
            notes: notes || undefined,
          }
        : i
    );
    pushList({ ...snap, items: dedupePrivateItemsByName(items) });
    closeItemModal();
  };

  const onConfirmDelete = () => {
    if (!editingItemId) return;
    Alert.alert("Delete entry", "Remove this entry?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          const snap = listRef.current;
          if (!snap) return;
          clearTimer(editingItemId);
          const items = snap.items.filter((i) => i.id !== editingItemId);
          pushListWithActiveFlip({ ...snap, items: reindexPrivateOrders(normalizePrivateItemsForPersist(items)) });
          closeItemModal();
        },
      },
    ]);
  };

  const onMicName = async () => {
    if (listening) {
      clearVoiceIdleStopTimer();
      stopSpeech();
      return;
    }
    clearVoiceIdleStopTimer();
    setVoiceTarget("name");
    await startSpeech((t) => {
      setFormName(t.trim());
      maybeScheduleVoiceIdleStopAfterFirstToken(t);
    });
  };

  const onMicUsername = async () => {
    if (listening) {
      clearVoiceIdleStopTimer();
      stopSpeech();
      return;
    }
    clearVoiceIdleStopTimer();
    setVoiceTarget("username");
    await startSpeech((t) => {
      setFormUsername(t.trim());
      maybeScheduleVoiceIdleStopAfterFirstToken(t);
    });
  };

  const onMicNotes = async () => {
    if (listening) {
      clearVoiceIdleStopTimer();
      stopSpeech();
      return;
    }
    clearVoiceIdleStopTimer();
    setVoiceTarget("notes");
    await startSpeech((t) => {
      setFormNotes(t.trim());
      maybeScheduleVoiceIdleStopAfterFirstToken(t);
    });
  };

  if (!list) {
    return (
      <PrivateVaultGate>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </PrivateVaultGate>
    );
  }

  const entryCount = list.items.length;
  const modalVisible = itemModalMode !== null;
  const viewModalVisible = viewItem !== null;

  const floatingBarBottom = insets.bottom + 12;
  const bulkActionsBottom = floatingBarBottom + 70;
  const listBottomInset = bulkMode ? bulkActionsBottom + 62 : floatingBarBottom + 56 + 20;
  const overlayHeight = bulkMode ? 320 : 220;
  const overlayOpacities = bulkMode
    ? [0, 0.06, 0.14, 0.24, 0.36, 0.48, 0.6, 0.72, 0.82, 0.9, 0.96]
    : [0, 0.04, 0.12, 0.24, 0.38, 0.52, 0.68, 0.82, 0.92];

  const renderRow = (
    item: PrivateItem,
    opts: { drag?: () => void; isActive?: boolean; draggable: boolean }
  ) => {
    const isSelected = selectedIds.has(item.id);
    const shouldWiggle = wiggleIdRef.current === item.id;
    const wiggleStyle = shouldWiggle
      ? {
          transform: [
            {
              rotate: wiggleAnim.interpolate({
                inputRange: [0, 0.25, 0.5, 0.75, 1],
                outputRange: ["0deg", "-0.8deg", "0deg", "0.8deg", "0deg"],
              }),
            },
          ],
        }
      : null;

    return (
      <Animated.View
        style={[
          styles.row,
          privateEntryRowStyles.rowCard,
          item.priority ? privateEntryRowStyles.rowPriority : null,
          opts.isActive && { opacity: 0.9 },
          wiggleStyle,
        ]}
      >
        {bulkMode ? (
          <TouchableOpacity
            style={[styles.rowCheckbox, isSelected && styles.rowCheckboxActive]}
            onPress={() => toggleSelected(item.id)}
            accessibilityRole="checkbox"
            accessibilityLabel={isSelected ? "Deselect entry" : "Select entry"}
          >
            {isSelected ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
          </TouchableOpacity>
        ) : null}
        {bulkMode ? (
          <Pressable
            style={styles.rowBulkTapOverlay}
            onPress={() => toggleSelected(item.id)}
            accessibilityRole="button"
            accessibilityLabel={isSelected ? "Deselect entry" : "Select entry"}
          />
        ) : null}
        {opts.draggable && opts.drag ? (
          <TouchableOpacity
            onLongPress={() => {
              if (!bulkMode) opts.drag?.();
            }}
            delayLongPress={120}
            style={styles.handle}
            accessibilityLabel="Reorder entry"
          >
            <Ionicons name="reorder-three-outline" size={22} color={PRIVATE_ROW_ICON} />
          </TouchableOpacity>
        ) : (
          <View style={[styles.handle, { opacity: 0.5 }]}>
            <Ionicons name="reorder-three-outline" size={22} color={PRIVATE_ROW_ICON_MUTED} />
          </View>
        )}

        <View style={styles.rowTap} pointerEvents="box-none">
          <View style={privateEntryRowStyles.rowTapRow}>
            <View style={[privateEntryRowStyles.mainColumn, privateEntryRowStyles.rowTapInner]} pointerEvents="none">
              <View style={privateEntryRowStyles.rowMainLine}>
                <Text style={privateEntryRowStyles.entryTitle} numberOfLines={1}>
                  {item.name || "Entry"}
                </Text>
                {item.secret?.trim() ? (
                  <View
                    style={{ flexShrink: 0 }}
                    accessibilityLabel="Has secret"
                    accessibilityRole="image"
                  >
                    <Ionicons name="lock-closed-outline" size={18} color={PRIVATE_ROW_ICON} />
                  </View>
                ) : null}
              </View>
              {item.username?.trim() ? (
                <Text style={privateEntryRowStyles.rowSubtitle} numberOfLines={1}>
                  {item.username.trim()}
                </Text>
              ) : null}
            </View>
            <View style={privateEntryRowStyles.starBtnOuter}>
              <TouchableOpacity
                style={privateEntryRowStyles.starBtnHit}
                onPress={() => {
                  if (bulkMode) {
                    toggleSelected(item.id);
                    return;
                  }
                  togglePriority(item.id);
                }}
                accessibilityRole="button"
                accessibilityLabel={item.priority ? "Unpin priority" : "Prioritize entry"}
              >
                <Ionicons
                  name={item.priority ? "star" : "star-outline"}
                  size={20}
                  color={item.priority ? PRIVATE_STAR_FILLED : PRIVATE_ROW_ICON}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
        {!bulkMode ? (
          <Pressable
            style={styles.rowCardTapOverlay}
            onPress={() => openViewModal(item)}
            onLongPress={() => enterBulkMode(item.id)}
            delayLongPress={650}
            accessibilityRole="button"
            accessibilityLabel="View entry"
          />
        ) : null}
      </Animated.View>
    );
  };

  const renderDraggable = ({ item, drag, isActive }: RenderItemParams<PrivateItem>) => (
    <View
      ref={(r) => {
        if (r) rowMeasureRefs.current.set(item.id, r);
        else rowMeasureRefs.current.delete(item.id);
      }}
      collapsable={false}
      style={{ width: "100%" }}
    >
      <FlipTranslateShell itemId={item.id} getFlipSv={getFlipSv}>
        <ScaleDecorator>{renderRow(item, { drag, isActive, draggable: true })}</ScaleDecorator>
      </FlipTranslateShell>
    </View>
  );

  return (
    <PrivateVaultGate>
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.staticChrome}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
            <Text style={styles.backText}>Vault</Text>
          </TouchableOpacity>
          <Text style={styles.listTitle} numberOfLines={1}>
            {list.name}
          </Text>
          <View style={{ width: 72 }} />
        </View>
        <View style={styles.progressWrap}>
          <View style={styles.progressMetaRow}>
            <Text style={styles.progressMetaText}>
              {entryCount} entr{entryCount === 1 ? "y" : "ies"} · stored on this device only
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.listBody}>
        <DraggableFlatList
          style={{ flex: 1 }}
          containerStyle={{ flex: 1 }}
          data={displayItems}
          extraData={activeReorderExtraData}
          keyExtractor={(i) => i.id}
          onDragEnd={onDragEnd}
          renderItem={renderDraggable}
          disableVirtualization
          contentContainerStyle={{ paddingTop: 8 }}
          ListEmptyComponent={
            <View style={styles.listEmptyWrap}>
              <Ionicons name="lock-closed-outline" size={42} color={colors.borderMuted} />
              <Text style={styles.listEmptyTitle}>No entries yet</Text>
              <Text style={styles.listEmptyText}>Tap + to add a label, login, secret, or note.</Text>
            </View>
          }
          ListFooterComponent={<View style={{ paddingBottom: listBottomInset }} />}
        />
      </View>

      <View style={[styles.bulkOverlayFade, { height: overlayHeight }]} pointerEvents="none">
        {overlayOpacities.map((opacity, idx) => (
          <View
            key={`overlay-stop-${idx}`}
            style={[
              styles.bulkOverlayStop,
              {
                opacity,
                backgroundColor: colors.background,
              },
            ]}
          />
        ))}
      </View>

      {bulkMode ? (
        <View style={[styles.bulkActionsFloating, { bottom: bulkActionsBottom }]}>
          <TouchableOpacity
            style={[
              privateBulkStyles.bulkCircleBtn,
              selectedIds.size === 0 && privateBulkStyles.bulkCircleBtnDisabled,
            ]}
            onPress={() => confirmBulkPrioritySelected(true)}
            disabled={selectedIds.size === 0}
            accessibilityRole="button"
            accessibilityLabel="Bulk prioritize selected entries"
          >
            <Ionicons
              name="star"
              size={24}
              color={selectedIds.size > 0 ? PRIVATE_ROW_ICON : PRIVATE_ROW_ICON_MUTED}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              privateBulkStyles.bulkCircleBtnDanger,
              selectedIds.size === 0 && privateBulkStyles.bulkCircleBtnDangerDisabled,
            ]}
            onPress={bulkDeleteSelected}
            disabled={selectedIds.size === 0}
            accessibilityRole="button"
            accessibilityLabel="Bulk delete selected entries"
          >
            <Ionicons
              name="trash-outline"
              size={24}
              color={selectedIds.size > 0 ? "#B91C1C" : PRIVATE_ROW_ICON_MUTED}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={privateBulkStyles.bulkCircleBtn}
            onPress={exitBulkMode}
            accessibilityRole="button"
            accessibilityLabel="Cancel bulk selection"
          >
            <Ionicons name="close" size={24} color={PRIVATE_ROW_ICON} />
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={[styles.fabBarWrap, { bottom: floatingBarBottom }]}>
        <View style={styles.fabBar}>
          <View style={[styles.fabBarLane, styles.fabBarLaneLeft]} />
          <View style={[styles.fabBarLane, styles.fabBarLaneRight]}>
            <TouchableOpacity
              style={styles.fabPrimaryBtn}
              onPress={openAddModal}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel="Add entry"
            >
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Modal visible={viewModalVisible} transparent animationType="fade" onRequestClose={closeViewModal}>
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
        >
          <View style={[styles.modalBackdrop, { backgroundColor: "rgba(0,0,0,0.58)" }]}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={closeViewModal} />
            <ScrollView
              style={styles.modalScrollView}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={[
                styles.modalScroll,
                {
                  paddingBottom: insets.bottom + 24,
                  flexGrow: 1,
                  justifyContent: "flex-end",
                },
              ]}
              showsVerticalScrollIndicator={false}
            >
              <View style={vaultPreviewStyles.card}>
                <View style={vaultPreviewStyles.header}>
                  <View style={vaultPreviewStyles.headerSpacer} />
                  <Text style={vaultPreviewStyles.headerTitle} numberOfLines={1}>
                    {viewItem?.name?.trim() || "Entry"}
                  </Text>
                  <TouchableOpacity
                    onPress={closeViewModal}
                    style={vaultPreviewStyles.closeBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                  >
                    <Ionicons name="close" size={22} color="#AEAEB2" />
                  </TouchableOpacity>
                </View>

                <View style={vaultPreviewStyles.fieldsCol}>
                  <View style={vaultPreviewStyles.cell}>
                    <Text style={vaultPreviewStyles.fieldLabel}>Label</Text>
                    <Text
                      style={vaultPreviewStyles.fieldValue}
                      selectable
                      numberOfLines={3}
                    >
                      {viewItem?.name?.trim() || "—"}
                    </Text>
                  </View>

                  <View style={vaultPreviewStyles.cell}>
                    <Text style={vaultPreviewStyles.fieldLabel}>Username or email</Text>
                    <Text
                      style={[
                        vaultPreviewStyles.fieldValue,
                        !viewItem?.username?.trim() && vaultPreviewStyles.fieldValueMuted,
                      ]}
                      selectable
                      numberOfLines={4}
                    >
                      {viewItem?.username?.trim() ? viewItem.username.trim() : "—"}
                    </Text>
                  </View>

                  <View style={vaultPreviewStyles.cell}>
                    <View style={vaultPreviewStyles.cellLabelRow}>
                      <Text style={vaultPreviewStyles.fieldLabel}>Secret</Text>
                      {viewItem?.secret?.trim() ? (
                        <TouchableOpacity
                          onPress={() => setViewSecretVisible((v) => !v)}
                          style={vaultPreviewStyles.eyeBtn}
                          hitSlop={12}
                          accessibilityRole="button"
                          accessibilityLabel={viewSecretVisible ? "Hide secret" : "Show secret"}
                        >
                          <Ionicons
                            name={viewSecretVisible ? "eye-off-outline" : "eye-outline"}
                            size={22}
                            color="#C7C7CC"
                          />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    <Text
                      style={[
                        vaultPreviewStyles.fieldValue,
                        vaultPreviewStyles.secretValue,
                        viewSecretVisible &&
                          viewItem?.secret?.trim() && {
                            fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
                            fontSize: 15,
                            fontWeight: "500",
                          },
                      ]}
                      selectable={viewSecretVisible}
                      numberOfLines={viewSecretVisible ? 8 : 1}
                    >
                      {!viewItem?.secret?.trim()
                        ? "—"
                        : viewSecretVisible
                          ? viewItem.secret.trim()
                          : "••••••"}
                    </Text>
                  </View>

                  <View style={vaultPreviewStyles.cell}>
                    <Text style={vaultPreviewStyles.fieldLabel}>Notes</Text>
                    <Text
                      style={[
                        vaultPreviewStyles.fieldValue,
                        vaultPreviewStyles.notesValue,
                        !viewItem?.notes?.trim() && vaultPreviewStyles.fieldValueMuted,
                      ]}
                      selectable
                    >
                      {viewItem?.notes?.trim() ? viewItem.notes.trim() : "—"}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={vaultPreviewStyles.editBtn}
                  onPress={openEditFromView}
                  activeOpacity={0.88}
                  accessibilityRole="button"
                  accessibilityLabel="Edit entry"
                >
                  <Ionicons name="create-outline" size={20} color="#FFFFFF" />
                  <Text style={vaultPreviewStyles.editBtnText}>Edit</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeItemModal}>
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
        >
          <View style={styles.modalBackdrop}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={closeItemModal} />
            <ScrollView
              style={styles.modalScrollView}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={[
                styles.modalScroll,
                {
                  paddingBottom:
                    insets.bottom + 24 + (Platform.OS === "android" ? itemModalKeyboardInset : 0),
                  flexGrow: 1,
                  justifyContent: "flex-end",
                },
              ]}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  {itemModalMode === "edit" ? (
                    <TouchableOpacity
                      onPress={onConfirmDelete}
                      style={styles.trashBtn}
                      accessibilityLabel="Delete entry"
                    >
                      <Ionicons name="trash-outline" size={20} color={colors.danger} />
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.trashPlaceholder} />
                  )}
                  <Text style={styles.modalTitle}>
                    {itemModalMode === "add" ? "Add entry" : "Edit entry"}
                  </Text>
                  <TouchableOpacity onPress={closeItemModal} style={styles.modalClose}>
                    <Ionicons name="close" size={26} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.modalForm}>
                  <View style={styles.addRow}>
                    <View style={styles.addNameShell}>
                      <TextInput
                        value={formName}
                        onChangeText={setFormName}
                        style={styles.addNameField}
                        placeholder="Label (e.g. site or account)"
                        placeholderTextColor={colors.placeholder}
                      />
                      <TouchableOpacity
                        onPress={() => void onMicName()}
                        style={styles.fieldMicBtn}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel="Voice input for label"
                      >
                        <Ionicons
                          name="mic"
                          size={20}
                          color={listening && voiceTarget === "name" ? colors.danger : colors.primary}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textTertiary, marginTop: 4 }}>
                    Username or email (optional)
                  </Text>
                  <View style={styles.addNameShell}>
                    <TextInput
                      value={formUsername}
                      onChangeText={setFormUsername}
                      style={styles.addNameField}
                      placeholder="user@email.com or username"
                      placeholderTextColor={colors.placeholder}
                      autoCapitalize="none"
                      autoCorrect={false}
                      textContentType="username"
                    />
                    <TouchableOpacity
                      onPress={() => void onMicUsername()}
                      style={styles.fieldMicBtn}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Voice input for username or email"
                    >
                      <Ionicons
                        name="mic"
                        size={20}
                        color={listening && voiceTarget === "username" ? colors.danger : colors.primary}
                      />
                    </TouchableOpacity>
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textTertiary, marginTop: 4 }}>
                    Secret (optional)
                  </Text>
                  <View style={styles.addNameShell}>
                    <TextInput
                      value={formSecret}
                      onChangeText={setFormSecret}
                      style={styles.addNameField}
                      placeholder="Password, PIN, recovery code…"
                      placeholderTextColor={colors.placeholder}
                      secureTextEntry={!secretVisible}
                      autoCapitalize="none"
                      autoCorrect={false}
                      textContentType="none"
                    />
                    <TouchableOpacity
                      onPress={() => setSecretVisible((v) => !v)}
                      style={styles.fieldMicBtn}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={secretVisible ? "Hide secret" : "Show secret"}
                    >
                      <Ionicons
                        name={secretVisible ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color={colors.textTertiary}
                      />
                    </TouchableOpacity>
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textTertiary, marginTop: 4 }}>
                    Notes (optional)
                  </Text>
                  <View style={styles.addNameShell}>
                    <TextInput
                      value={formNotes}
                      onChangeText={setFormNotes}
                      style={[
                        styles.addNameField,
                        { minHeight: 56, flex: 1, textAlignVertical: "top" },
                      ]}
                      placeholder="URL, hint, security questions…"
                      placeholderTextColor={colors.placeholder}
                      multiline
                    />
                    <TouchableOpacity
                      onPress={() => void onMicNotes()}
                      style={styles.fieldMicBtn}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Voice input for notes"
                    >
                      <Ionicons
                        name="mic"
                        size={20}
                        color={listening && voiceTarget === "notes" ? colors.danger : colors.primary}
                      />
                    </TouchableOpacity>
                  </View>
                  {itemModalMode === "edit" ? (
                    <TouchableOpacity style={styles.saveBtn} onPress={onSaveEdit}>
                      <Ionicons name="save-outline" size={20} color="#fff" />
                      <Text style={styles.saveBtnText}>Save</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.addBtn} onPress={onSaveAdd}>
                      <Ionicons name="add-circle-outline" size={20} color="#fff" />
                      <Text style={styles.addBtnText}>Add entry</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
    </PrivateVaultGate>
  );
}
