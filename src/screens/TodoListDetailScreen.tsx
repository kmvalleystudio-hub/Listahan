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
  Easing,
  Image,
} from "react-native";
import { useAppStyles } from "../hooks/useAppStyles";

import * as ImagePicker from "expo-image-picker";
import type { ImagePickerAsset } from "expo-image-picker";
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from "react-native-draggable-flatlist";
import Reanimated, {
  FadeIn,
  makeMutable,
  type SharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import type { TodoListDetailProps } from "../navigation/types";
import { useAppData } from "../context/AppDataContext";
import { useToolTheme } from "../hooks/useToolTheme";
import type { TodoHistoryEntry, TodoItem, TodoList } from "../types";
import { generateId } from "../utils/id";
import {
  allTodosCommittedDone,
  normalizeTodoItemsForPersist,
  reindexTodoOrders,
  splitTodoActiveAndCompleted,
} from "../utils/todoItems";
import { toTitleCaseWords } from "../utils/textFormat";
import { useSpeechToText } from "../hooks/useSpeechToText";
import { parseTodoBulkTranscriptLocal } from "../utils/parseTodoBulkTranscriptLocal";
import { parseScannedTodoListLocal } from "../utils/parseScannedTodoListLocal";
import { runOcrFromImageBase64, runOcrFromImageUri } from "../utils/scanListOcr";
import {
  replaceScanTextRange,
  scanTextLineRangeAtIndex,
  shouldFlagOcrWord,
  suggestOcrWordCorrections,
  tokenizeScanText,
} from "../utils/scanOcrLexicon";
import { ScanLexMirrorOverlay } from "../utils/ScanLexMirrorOverlay";
import { createListDetailStyles } from "./listDetailStyles";

function nowIso(): string {
  return new Date().toISOString();
}

const VOICE_IDLE_MS_AFTER_FIRST_WORD = 2000;

/** Set `true` to show ImagePicker result alerts while debugging scan/camera. */
const SCAN_DEBUG_PICKER_ALERTS = false;

const REORDER_SPRING = {
  damping: 20,
  mass: 0.2,
  stiffness: 100,
  overshootClamping: false,
  restDisplacementThreshold: 0.2,
  restSpeedThreshold: 0.2,
} as const;

function activeTodoIdsJoin(items: TodoItem[]): string {
  return splitTodoActiveAndCompleted(items).active.map((i) => i.id).join(",");
}

function dedupeTodoItemsByName(items: TodoItem[]): TodoItem[] {
  const seen = new Set<string>();
  const deduped: TodoItem[] = [];
  for (const item of items) {
    const key = item.name.trim().toLowerCase();
    if (!key) {
      deduped.push(item);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
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

export default function TodoListDetailScreen({ navigation, route }: TodoListDetailProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useToolTheme("todo");
  const styles = useAppStyles(createListDetailStyles);
  const { listId, autoOpenAdd = false } = route.params;
  const { todoLists, loading, upsertTodoList, archiveTodoCompletedList } = useAppData();

  const checkedRowEntering = useMemo(() => FadeIn.duration(220), []);

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

  const list = useMemo(() => todoLists.find((l) => l.id === listId) ?? null, [todoLists, listId]);
  const activeReorderExtraData = useMemo(() => {
    if (!list) return "";
    const { active: a } = splitTodoActiveAndCompleted(list.items);
    return a.map((i) => `${i.id}:${i.priority ? 1 : 0}:${i.order}`).join("|");
  }, [list]);
  const listRef = useRef<TodoList | null>(list);
  listRef.current = list;

  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const finishingListRef = useRef(false);
  const autoOpenHandledRef = useRef(false);

  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const wiggleIdRef = useRef<string | null>(null);
  const wiggleAnim = useRef(new Animated.Value(0)).current;

  const {
    start: startSpeech,
    stop: stopSpeech,
    listening,
    lastError,
    clearLastError,
  } = useSpeechToText();
  const [voiceTarget, setVoiceTarget] = useState<"name" | "bulk" | null>(null);
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

  const [bulkModalVisible, setBulkModalVisible] = useState(false);
  const [bulkTranscript, setBulkTranscript] = useState("");
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const bulkTranscriptRef = useRef("");

  const [itemModalMode, setItemModalMode] = useState<ItemModalMode>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [itemModalKeyboardInset, setItemModalKeyboardInset] = useState(0);
  const itemModalOpen = itemModalMode !== null;
  const bulkMicBlobAnim = useRef(new Animated.Value(0)).current;

  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [scanActiveTab, setScanActiveTab] = useState<"capture" | "results">("capture");
  const [scanImageUri, setScanImageUri] = useState("");
  const [scanRawText, setScanRawText] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [scanHintText, setScanHintText] = useState("");
  const [scanWordSuggest, setScanWordSuggest] = useState<{
    start: number;
    end: number;
    original: string;
    suggestions: string[];
    anchor?: { x: number; y: number; width: number; height: number };
  } | null>(null);
  const [scanLexFlashSpan, setScanLexFlashSpan] = useState<{ start: number; end: number } | null>(null);
  const scanLexFlashOpacity = useRef(new Animated.Value(0)).current;
  const [scanLoadingLabel, setScanLoadingLabel] = useState("");
  const [scanModalKeyboardInset, setScanModalKeyboardInset] = useState(0);
  const scanModalScrollRef = useRef<ScrollView | null>(null);
  const scanFlaggedChipRefs = useRef<Map<string, View>>(new Map());
  const scanModalRootRef = useRef<View | null>(null);
  const scanBubbleLayoutRef = useRef({ rootW: 400, rootH: 700 });
  const scanOcrInputRef = useRef<TextInput | null>(null);
  const [scanOcrScrollY, setScanOcrScrollY] = useState(0);

  const clearScanLexFlash = useCallback(() => {
    scanLexFlashOpacity.stopAnimation();
    scanLexFlashOpacity.setValue(0);
    setScanLexFlashSpan(null);
  }, [scanLexFlashOpacity]);

  const triggerScanLexReplaceFlash = useCallback(
    (start: number, insert: string) => {
      scanLexFlashOpacity.stopAnimation();
      const end = start + insert.length;
      setScanLexFlashSpan({ start, end });
      scanLexFlashOpacity.setValue(1);
      Animated.timing(scanLexFlashOpacity, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setScanLexFlashSpan(null);
      });
    },
    [scanLexFlashOpacity]
  );

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

  useEffect(() => {
    if (!scanModalVisible || scanActiveTab !== "results") {
      setScanModalKeyboardInset(0);
      return;
    }
    const onShow = (e: { endCoordinates: { height: number } }) => {
      setScanModalKeyboardInset(e.endCoordinates.height);
    };
    const onHide = () => setScanModalKeyboardInset(0);
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [scanModalVisible, scanActiveTab]);

  useEffect(() => {
    if (!scanModalVisible || scanActiveTab !== "results") {
      setScanOcrScrollY(0);
    }
  }, [scanModalVisible, scanActiveTab]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bulkMicBlobAnim, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(bulkMicBlobAnim, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bulkMicBlobAnim]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        Object.values(timersRef.current).forEach(clearTimeout);
        timersRef.current = {};
        stopSpeech();
        clearVoiceIdleStopTimer();
        setBulkModalVisible(false);
        setBulkProcessing(false);
        setScanModalVisible(false);
        setScanLoading(false);
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
    setScanModalVisible(false);
    setScanActiveTab("capture");
    setScanImageUri("");
    setScanRawText("");
    setScanHintText("");
    setScanWordSuggest(null);
    clearScanLexFlash();
    setScanLoading(false);
    setScanLoadingLabel("");
  }, [listId, clearScanLexFlash]);

  useFocusEffect(
    useCallback(() => {
      if (loading) return;
      if (list || finishingListRef.current) return;
      navigation.goBack();
    }, [list, loading, navigation])
  );

  const pushList = useCallback(
    (next: TodoList) => {
      upsertTodoList({ ...next, updatedAt: nowIso() });
    },
    [upsertTodoList]
  );

  const pushListWithActiveFlip = useCallback(
    (next: TodoList) => {
      const prev = listRef.current;
      if (!prev) {
        pushList(next);
        return;
      }
      if (activeTodoIdsJoin(prev.items) === activeTodoIdsJoin(next.items)) {
        pushList(next);
        return;
      }
      const ids = new Set<string>();
      splitTodoActiveAndCompleted(prev.items).active.forEach((i) => ids.add(i.id));
      splitTodoActiveAndCompleted(next.items).active.forEach((i) => ids.add(i.id));
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
    const activeIds = splitTodoActiveAndCompleted(list.items).active.map((i) => i.id);
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
    const deduped = dedupeTodoItemsByName(list.items);
    if (deduped.length !== list.items.length) {
      pushList({ ...list, items: deduped });
    }
  }, [list, pushList]);

  const clearTimer = (itemId: string) => {
    const t = timersRef.current[itemId];
    if (t) clearTimeout(t);
    delete timersRef.current[itemId];
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
      const ts = nowIso();

      const items = snap.items.map((i) =>
        i.id === itemId ? { ...i, checkPending: false, order: nextOrder, completedAt: ts } : i
      );

      if (allTodosCommittedDone(items)) {
        const entry: TodoHistoryEntry = {
          id: generateId(),
          sourceListId: snap.id,
          name: snap.name,
          createdAt: snap.createdAt,
          updatedAt: ts,
          items: normalizeTodoItemsForPersist(items.map((i) => ({ ...i, checked: true, checkPending: false }))),
        };
        finishingListRef.current = true;
        try {
          await archiveTodoCompletedList(entry);
          navigation.replace("AllDone", { listId: snap.id, tool: "todo" });
        } catch {
          finishingListRef.current = false;
        }
      } else {
        pushListWithActiveFlip({ ...snap, items });
      }
    },
    [archiveTodoCompletedList, navigation, pushListWithActiveFlip]
  );

  const commitOrFinishList = useCallback(
    async (base: TodoList, nextItems: TodoItem[]) => {
      if (allTodosCommittedDone(nextItems)) {
        const ts = nowIso();
        const stamped = nextItems.map((i) => {
          if (!i.checked || i.checkPending) return i;
          return i.completedAt ? i : { ...i, completedAt: ts };
        });
        const entry: TodoHistoryEntry = {
          id: generateId(),
          sourceListId: base.id,
          name: base.name,
          createdAt: base.createdAt,
          updatedAt: ts,
          items: normalizeTodoItemsForPersist(
            stamped.map((i) => ({ ...i, checked: true, checkPending: false }))
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
      pushListWithActiveFlip({ ...base, items: nextItems });
    },
    [archiveTodoCompletedList, navigation, pushListWithActiveFlip]
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

  const confirmBulkCheckSelected = () => {
    const snap = listRef.current;
    if (!snap || selectedIds.size === 0) return;
    Alert.alert("Bulk check", `Check ${selectedIds.size} task(s)?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: () => {
          const current = listRef.current;
          if (!current) return;
          const ts = nowIso();
          const items = current.items.map((i) =>
            selectedIds.has(i.id) ? { ...i, checked: true, checkPending: false, completedAt: ts } : i
          );
          void commitOrFinishList(current, items);
          exitBulkMode();
        },
      },
    ]);
  };

  const bulkDeleteSelected = () => {
    const snap = listRef.current;
    if (!snap || selectedIds.size === 0) return;
    Alert.alert("Delete tasks", `Remove ${selectedIds.size} selected task(s)?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          const items = snap.items.filter((i) => !selectedIds.has(i.id));
          void commitOrFinishList(snap, items);
          exitBulkMode();
        },
      },
    ]);
  };

  const confirmBulkPrioritySelected = (nextPriority: boolean) => {
    const snap = listRef.current;
    if (!snap || selectedIds.size === 0) return;
    Alert.alert("Bulk prioritize", `Prioritize ${selectedIds.size} task(s)?`, [
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

  const onTapUndo = (itemId: string) => {
    const snap = listRef.current;
    if (!snap) return;
    clearTimer(itemId);
    const items = snap.items.map((i) =>
      i.id === itemId ? { ...i, checked: false, checkPending: false, completedAt: undefined } : i
    );
    pushListWithActiveFlip({ ...snap, items });
  };

  const onTapUncheck = (itemId: string) => {
    const snap = listRef.current;
    if (!snap) return;
    clearTimer(itemId);
    const { active } = splitTodoActiveAndCompleted(snap.items.filter((i) => i.id !== itemId));
    const maxActive = active.reduce((m, i) => Math.max(m, i.order), -1);
    const items = snap.items.map((i) =>
      i.id === itemId
        ? { ...i, checked: false, checkPending: false, order: maxActive + 1, completedAt: undefined }
        : i
    );
    pushListWithActiveFlip({ ...snap, items });
  };

  const onDragEnd = ({ data }: { data: TodoItem[] }) => {
    const snap = listRef.current;
    if (!snap) return;
    const { completed } = splitTodoActiveAndCompleted(snap.items);
    const reindexedActive = reindexTodoOrders(data);
    pushList({ ...snap, items: [...reindexedActive, ...completed] });
  };

  const nextActiveOrder = () => {
    const snap = listRef.current;
    if (!snap) return 0;
    const { active } = splitTodoActiveAndCompleted(snap.items);
    return active.reduce((m, i) => Math.max(m, i.order), -1) + 1;
  };

  const closeItemModal = () => {
    stopSpeech();
    clearVoiceIdleStopTimer();
    setItemModalMode(null);
    setEditingItemId(null);
    setFormName("");
  };

  const openAddModal = () => {
    stopSpeech();
    clearVoiceIdleStopTimer();
    setEditingItemId(null);
    setFormName("");
    setItemModalMode("add");
  };

  const openEditModal = (item: TodoItem) => {
    if (item.checkPending) return;
    stopSpeech();
    clearVoiceIdleStopTimer();
    setEditingItemId(item.id);
    setFormName(item.name);
    setItemModalMode("edit");
  };

  useEffect(() => {
    if (!autoOpenAdd) return;
    if (autoOpenHandledRef.current) return;
    if (!list) return;
    if (itemModalMode !== null) return;
    if (list.items.length !== 0) return;
    autoOpenHandledRef.current = true;
    openAddModal();
    navigation.setParams({ autoOpenAdd: false });
  }, [autoOpenAdd, itemModalMode, list, navigation]);

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
    pushList({ ...snap, items: dedupeTodoItemsByName([...snap.items, item]) });
    closeItemModal();
  };

  const onSaveEdit = () => {
    const snap = listRef.current;
    if (!snap || !editingItemId) return;
    if (!formName.trim()) return;
    const items = snap.items.map((i) =>
      i.id === editingItemId ? { ...i, name: formName.trim() } : i
    );
    pushList({ ...snap, items: dedupeTodoItemsByName(items) });
    closeItemModal();
  };

  const onConfirmDelete = () => {
    if (!editingItemId) return;
    Alert.alert("Delete task", "Remove this task?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          const snap = listRef.current;
          if (!snap) return;
          clearTimer(editingItemId);
          const items = snap.items.filter((i) => i.id !== editingItemId);
          void commitOrFinishList(snap, items);
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
      setFormName(toTitleCaseWords(t.trim()));
      maybeScheduleVoiceIdleStopAfterFirstToken(t);
    });
  };

  const showBulkTasksInfo = () => {
    Alert.alert(
      "Bulk tasks by voice",
      "Say each task, separated by the word AND.\n\nExample: “call mom and buy milk and schedule dentist”\n\nTap the mic to start, tap again when you’re finished."
    );
  };

  const openBulkVoiceModal = () => {
    stopSpeech();
    clearVoiceIdleStopTimer();
    clearLastError();
    setBulkTranscript("");
    bulkTranscriptRef.current = "";
    setBulkModalVisible(true);
  };

  const openBulkFromItemModal = () => {
    closeItemModal();
    openBulkVoiceModal();
  };

  const closeBulkVoiceModal = () => {
    stopSpeech();
    clearVoiceIdleStopTimer();
    clearLastError();
    setBulkModalVisible(false);
    setBulkTranscript("");
    bulkTranscriptRef.current = "";
    setBulkProcessing(false);
  };

  const scanFlaggedWords = useMemo(() => {
    const lines = scanRawText.split(/\r?\n/);
    let offset = 0;
    const flagged: { key: string; start: number; end: number; text: string }[] = [];
    lines.forEach((line, lineIndex) => {
      const tokens = tokenizeScanText(line);
      tokens.forEach((tok, tidx) => {
        if (tok.type !== "word") return;
        if (!shouldFlagOcrWord(tok.text)) return;
        flagged.push({
          key: `fw-${lineIndex}-${tok.start}-${tidx}`,
          start: tok.start + offset,
          end: tok.end + offset,
          text: tok.text,
        });
      });
      offset += line.length;
      if (lineIndex < lines.length - 1) offset += 1;
    });
    return flagged;
  }, [scanRawText]);

  const scanOcrLineFocus = useMemo(() => {
    if (!scanWordSuggest || scanActiveTab !== "results") return null;
    const { lineStart, lineEnd } = scanTextLineRangeAtIndex(scanRawText, scanWordSuggest.start);
    const slice = scanRawText.slice(lineStart, lineEnd);
    return {
      lineStart,
      lineEnd,
      slice,
      suggestLocal: {
        start: scanWordSuggest.start - lineStart,
        end: scanWordSuggest.end - lineStart,
      },
    };
  }, [scanWordSuggest, scanActiveTab, scanRawText]);

  const openScanWordSuggestFromChip = useCallback((w: { key: string; start: number; end: number; text: string }) => {
    const suggestions = suggestOcrWordCorrections(w.text);
    const base = { start: w.start, end: w.end, original: w.text, suggestions };

    const measureAndOpen = (attempt: number) => {
      clearScanLexFlash();
      const root = scanModalRootRef.current;
      const node = scanFlaggedChipRefs.current.get(w.key);
      if (!root) {
        if (attempt < 4) requestAnimationFrame(() => measureAndOpen(attempt + 1));
        return;
      }
      root.measureInWindow((rx, ry, rw, rh) => {
        scanBubbleLayoutRef.current = { rootW: rw, rootH: rh };
        if (!node) {
          setScanWordSuggest({
            ...base,
            anchor: { x: rw / 2 - 48, y: Math.min(rh * 0.22, 120), width: 96, height: 36 },
          });
          setTimeout(() => {
            setScanOcrScrollY(0);
            requestAnimationFrame(() => scanOcrInputRef.current?.scrollTo?.({ y: 0, animated: false }));
          }, 64);
          return;
        }
        node.measureInWindow((x, y, width, height) => {
          if (width > 0 && height > 0) {
            setScanWordSuggest({
              ...base,
              anchor: { x: x - rx, y: y - ry, width, height },
            });
          } else {
            setScanWordSuggest({
              ...base,
              anchor: { x: rw / 2 - 48, y: Math.min(rh * 0.22, 120), width: 96, height: 36 },
            });
          }
          setTimeout(() => {
            setScanOcrScrollY(0);
            requestAnimationFrame(() => scanOcrInputRef.current?.scrollTo?.({ y: 0, animated: false }));
          }, 64);
        });
      });
    };

    requestAnimationFrame(() => measureAndOpen(0));
  }, [clearScanLexFlash, scanRawText]);

  const openScanModal = () => {
    stopSpeech();
    clearVoiceIdleStopTimer();
    setScanActiveTab("capture");
    setScanModalVisible(true);
  };

  const closeScanModal = () => {
    setScanWordSuggest(null);
    clearScanLexFlash();
    setScanModalVisible(false);
    setScanActiveTab("capture");
  };

  const onScanBackdropPress = () => {
    closeScanModal();
  };

  const tryGetPendingPickerResult = async (source: "camera" | "upload") => {
    const pending = await ImagePicker.getPendingResultAsync();
    if (!pending || Array.isArray(pending)) {
      setScanLoading(false);
      setScanLoadingLabel("");
      setScanHintText(`${source} returned canceled and no pending result was found.`);
      return null;
    }
    if (pending.canceled) {
      setScanLoading(false);
      setScanLoadingLabel("");
      setScanHintText(`${source} returned canceled and pending result is also canceled.`);
      return null;
    }
    const asset = pending.assets?.[0];
    if (!asset?.uri) {
      setScanLoading(false);
      setScanLoadingLabel("");
      setScanHintText(`${source} pending result has no image URI.`);
      return null;
    }
    setScanHintText(`${source} recovered from pending result.`);
    return asset;
  };

  const pickScanFromCamera = async (): Promise<ImagePickerAsset | null> => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Camera permission needed", "Please allow camera access to scan handwritten notes.");
        return null;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.9,
        base64: true,
        exif: false,
      });
      if (SCAN_DEBUG_PICKER_ALERTS) {
        Alert.alert(
          "Camera result",
          `canceled=${String(result.canceled)}\nassets=${String(result.assets?.length ?? 0)}`
        );
      }
      if (result.canceled) {
        const recovered = await tryGetPendingPickerResult("camera");
        if (!recovered) {
          setScanLoading(false);
          setScanLoadingLabel("");
          setScanHintText("Capture cancelled or no image returned. Please retake or try Upload.");
        } else {
          setScanHintText("Photo received. Reading text…");
        }
        return recovered;
      }
      if (!result.assets?.[0]?.uri) {
        setScanLoading(false);
        setScanLoadingLabel("");
        setScanHintText("No image returned from camera. Please retake.");
        return null;
      }
      setScanHintText("Photo received. Reading text…");
      return result.assets[0];
    } catch (e) {
      setScanLoading(false);
      setScanLoadingLabel("");
      setScanHintText("Camera failed to open on this device.");
      Alert.alert("Camera unavailable", e instanceof Error ? e.message : "Failed to open camera.");
      return null;
    }
  };

  const pickScanFromLibrary = async (): Promise<ImagePickerAsset | null> => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Photos permission needed", "Please allow photo access to upload a photo of your notes.");
        return null;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        quality: 0.9,
        base64: true,
        allowsMultipleSelection: false,
        exif: false,
      });
      if (SCAN_DEBUG_PICKER_ALERTS) {
        Alert.alert(
          "Upload result",
          `canceled=${String(result.canceled)}\nassets=${String(result.assets?.length ?? 0)}`
        );
      }
      if (result.canceled) {
        const recovered = await tryGetPendingPickerResult("upload");
        if (!recovered) {
          setScanLoading(false);
          setScanLoadingLabel("");
          setScanHintText("Image selection cancelled or no image returned.");
        } else {
          setScanHintText("Image selected. Reading text…");
        }
        return recovered;
      }
      if (!result.assets?.[0]?.uri) {
        setScanLoading(false);
        setScanLoadingLabel("");
        setScanHintText("No image selected.");
        return null;
      }
      setScanHintText("Image selected. Reading text…");
      return result.assets[0];
    } catch (e) {
      setScanLoading(false);
      setScanLoadingLabel("");
      setScanHintText("Gallery failed to open on this device.");
      Alert.alert("Upload unavailable", e instanceof Error ? e.message : "Failed to open gallery.");
      return null;
    }
  };

  const processScanAsset = async (asset: ImagePickerAsset) => {
    setScanWordSuggest(null);
    clearScanLexFlash();
    setScanImageUri(asset.uri);
    setScanActiveTab("results");
    setScanRawText("");
    setScanHintText("Reading text from image…");
    setScanLoading(true);
    setScanLoadingLabel("Reading text from image…");
    try {
      const b64 = asset.base64;
      const text = b64 ? await runOcrFromImageBase64(b64) : await runOcrFromImageUri(asset.uri);
      setScanRawText(text);
      setScanHintText(text.trim() ? "Review and edit detected text before importing." : "No text detected.");
      if (!text.trim()) {
        Alert.alert("No text found", "OCR could not read text. You can edit or paste lines manually below.");
      }
    } catch (e) {
      setScanRawText("");
      setScanHintText("Could not detect text from this image.");
      Alert.alert(
        "OCR unavailable",
        e instanceof Error
          ? `${e.message}\n\nYou can still paste or edit text manually and import.`
          : "Could not read text from image."
      );
    } finally {
      setScanLoading(false);
      setScanLoadingLabel("");
    }
  };

  const onScanCameraPress = async () => {
    setScanLoading(true);
    setScanLoadingLabel("Opening camera…");
    setScanHintText("Opening camera...");
    setScanModalVisible(false);
    const asset = await pickScanFromCamera();
    if (asset) {
      setScanLoadingLabel("Reading text from image…");
    }
    setScanModalVisible(true);
    if (asset) {
      await processScanAsset(asset);
      return;
    }
    setScanLoading(false);
    setScanLoadingLabel("");
  };

  const onScanUploadPress = async () => {
    setScanLoading(true);
    setScanLoadingLabel("Opening gallery…");
    setScanHintText("Opening gallery...");
    setScanModalVisible(false);
    const asset = await pickScanFromLibrary();
    if (asset) {
      setScanLoadingLabel("Reading text from image…");
    }
    setScanModalVisible(true);
    if (asset) {
      await processScanAsset(asset);
      return;
    }
    setScanLoading(false);
    setScanLoadingLabel("");
  };

  useEffect(() => {
    if (!scanModalVisible) return;
    let cancelled = false;
    void ImagePicker.getPendingResultAsync().then((pending) => {
      if (cancelled || !pending) return;
      if (Array.isArray(pending)) return;
      if (pending.canceled) {
        setScanHintText("Pending camera result was cancelled.");
        return;
      }
      const asset = pending.assets?.[0];
      if (!asset?.uri) {
        setScanHintText("Pending result has no image URI.");
        return;
      }
      setScanHintText("Recovered pending image result. Processing...");
      void processScanAsset(asset);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- processScanAsset is stable for this modal lifecycle
  }, [scanModalVisible]);

  const importScannedText = async () => {
    const snap = listRef.current;
    if (!snap) return;
    const names = parseScannedTodoListLocal(scanRawText);
    if (names.length === 0) {
      Alert.alert(
        "Nothing to import",
        "No tasks found in the text. Try a clearer photo or edit lines before importing."
      );
      return;
    }
    setScanLoading(true);
    const { active } = splitTodoActiveAndCompleted(snap.items);
    let nextOrder = active.reduce((m, i) => Math.max(m, i.order), -1) + 1;
    try {
      const newItems: TodoItem[] = names.map((name) => ({
        id: generateId(),
        name,
        checked: false,
        order: nextOrder++,
      }));
      pushListWithActiveFlip({ ...snap, items: dedupeTodoItemsByName([...snap.items, ...newItems]) });
      setScanImageUri("");
      setScanRawText("");
      setScanHintText("");
      setScanWordSuggest(null);
      setScanActiveTab("capture");
      closeScanModal();
    } finally {
      setScanLoading(false);
      setScanLoadingLabel("");
    }
  };

  const finishBulkFromTranscript = async (text: string) => {
    const snap = listRef.current;
    if (!snap) return;
    setBulkProcessing(true);
    try {
      const names = parseTodoBulkTranscriptLocal(text);
      if (names.length === 0) {
        Alert.alert(
          "Nothing to add",
          "We couldn’t find tasks in that recording. Try speaking more clearly, separated by AND."
        );
        return;
      }
      const { active } = splitTodoActiveAndCompleted(snap.items);
      let nextOrder = active.reduce((m, i) => Math.max(m, i.order), -1) + 1;
      const newItems: TodoItem[] = names.map((name) => ({
        id: generateId(),
        name,
        checked: false,
        order: nextOrder++,
      }));
      pushList({ ...snap, items: dedupeTodoItemsByName([...snap.items, ...newItems]) });
      closeBulkVoiceModal();
    } catch (e) {
      Alert.alert("Bulk add", e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBulkProcessing(false);
    }
  };

  const onBulkMicPress = async () => {
    if (bulkProcessing) return;
    if (listening && voiceTarget === "bulk") {
      stopSpeech();
      clearVoiceIdleStopTimer();
      setVoiceTarget(null);
      const captured = bulkTranscriptRef.current.trim();
      setTimeout(() => {
        void finishBulkFromTranscript(captured);
      }, 450);
      return;
    }
    clearVoiceIdleStopTimer();
    setVoiceTarget("bulk");
    bulkTranscriptRef.current = "";
    setBulkTranscript("");
    await startSpeech(
      (t) => {
        bulkTranscriptRef.current = t;
        setBulkTranscript(t);
      },
      { bulk: true }
    );
  };

  if (!list) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const { active, completed } = splitTodoActiveAndCompleted(list.items);
  const checkedCount = completed.length;
  const taskCount = list.items.length;
  const progressRatio = taskCount > 0 ? checkedCount / taskCount : 0;
  const modalVisible = itemModalMode !== null;
  const canOpenScanResults = Boolean(scanImageUri.trim() || scanRawText.trim() || scanLoading);

  const floatingBarBottom = insets.bottom + 12;
  const bulkActionsBottom = floatingBarBottom + 70;
  const listBottomInset = bulkMode ? bulkActionsBottom + 62 : floatingBarBottom + 74 + 18;
  const overlayHeight = bulkMode ? 320 : 220;
  const overlayOpacities = bulkMode
    ? [0, 0.06, 0.14, 0.24, 0.36, 0.48, 0.6, 0.72, 0.82, 0.9, 0.96]
    : [0, 0.04, 0.12, 0.24, 0.38, 0.52, 0.68, 0.82, 0.92];

  const micBlobAAnimatedStyle = {
    transform: [
      {
        translateX: bulkMicBlobAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -6],
        }),
      },
      {
        translateY: bulkMicBlobAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 4],
        }),
      },
      {
        scale: bulkMicBlobAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.12],
        }),
      },
    ],
  } as const;
  const micBlobBAnimatedStyle = {
    transform: [
      {
        translateX: bulkMicBlobAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 5],
        }),
      },
      {
        translateY: bulkMicBlobAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -5],
        }),
      },
      {
        scale: bulkMicBlobAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0.9],
        }),
      },
    ],
  } as const;

  const renderRow = (
    item: TodoItem,
    opts: { drag?: () => void; isActive?: boolean; draggable: boolean }
  ) => {
    const isPending = item.checked && item.checkPending;
    const isDone = item.checked && !item.checkPending;
    const rowMuted = item.checked;

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
          rowMuted && styles.rowMuted,
          opts.isActive && { opacity: 0.9 },
          wiggleStyle,
        ]}
      >
        {bulkMode ? (
          <TouchableOpacity
            style={[styles.rowCheckbox, isSelected && styles.rowCheckboxActive]}
            onPress={() => toggleSelected(item.id)}
            accessibilityRole="checkbox"
            accessibilityLabel={isSelected ? "Deselect task" : "Select task"}
          >
            {isSelected ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
          </TouchableOpacity>
        ) : null}
        {bulkMode ? (
          <Pressable
            style={styles.rowBulkTapOverlay}
            onPress={() => toggleSelected(item.id)}
            accessibilityRole="button"
            accessibilityLabel={isSelected ? "Deselect task" : "Select task"}
          />
        ) : null}
        {opts.draggable && opts.drag ? (
          <TouchableOpacity
            onLongPress={() => {
              if (!bulkMode) opts.drag?.();
            }}
            delayLongPress={120}
            style={styles.handle}
          >
            <Ionicons name="ellipsis-vertical" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        ) : (
          <View style={[styles.handle, { opacity: 0.35 }]}>
            <Ionicons name="ellipsis-vertical" size={18} color={colors.borderMuted} />
          </View>
        )}

        <View style={styles.rowTap} pointerEvents="none">
          <View style={styles.rowTitleLine}>
            <Text style={[styles.itemNameText, rowMuted && styles.strikeText]} numberOfLines={1}>
              {item.name || "Task"}
            </Text>
          </View>
        </View>

        <View style={styles.actionCol} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.starBtn}
            onPress={() => {
              if (bulkMode) {
                toggleSelected(item.id);
                return;
              }
              togglePriority(item.id);
            }}
            accessibilityRole="button"
            accessibilityLabel={item.priority ? "Unpin priority" : "Prioritize task"}
          >
            <Ionicons
              name={item.priority ? "star" : "star-outline"}
              size={18}
              color={item.priority ? colors.micIcon : colors.placeholder}
            />
          </TouchableOpacity>
          {isPending ? (
            <TouchableOpacity
              style={styles.undoBtn}
              onPress={() => {
                if (bulkMode) {
                  toggleSelected(item.id);
                  return;
                }
                onTapUndo(item.id);
              }}
            >
              <Text style={styles.undoText}>Undo</Text>
            </TouchableOpacity>
          ) : isDone ? (
            <TouchableOpacity
              style={styles.uncheckBtn}
              onPress={() => {
                if (bulkMode) {
                  toggleSelected(item.id);
                  return;
                }
                onTapUncheck(item.id);
              }}
            >
              <Text style={styles.uncheckText}>Uncheck</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.checkBtn}
              onPress={() => {
                if (bulkMode) {
                  toggleSelected(item.id);
                  return;
                }
                onTapCheck(item.id);
              }}
            >
              <Text style={styles.checkText}>CHECK</Text>
            </TouchableOpacity>
          )}
        </View>
        {!bulkMode ? (
          <Pressable
            style={styles.rowCardTapOverlay}
            onPress={() => openEditModal(item)}
            onLongPress={() => enterBulkMode(item.id)}
            delayLongPress={650}
            accessibilityRole="button"
            accessibilityLabel="Edit task"
          />
        ) : null}
      </Animated.View>
    );
  };

  const renderDraggable = ({ item, drag, isActive }: RenderItemParams<TodoItem>) => (
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
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.staticChrome}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
            <Text style={styles.backText}>To-dos</Text>
          </TouchableOpacity>
          <Text style={styles.listTitle} numberOfLines={1}>
            {list.name}
          </Text>
          <TouchableOpacity
            style={styles.topShareBtn}
            onPress={() => navigation.navigate("ShareExport", { tool: "todo", listId: list.id })}
            accessibilityRole="button"
            accessibilityLabel="Share this to-do list"
          >
            <Ionicons name="share-outline" size={20} color={colors.linkBlue} />
            <Text style={styles.topShareBtnText}>Share</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.progressWrap}>
          <View style={styles.progressMetaRow}>
            <Text style={styles.progressMetaText}>
              {checkedCount}/{taskCount} checked
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${Math.max(0, Math.min(1, progressRatio)) * 100}%` }]}
            />
          </View>
        </View>
      </View>

      <View style={styles.listBody}>
        <DraggableFlatList
          style={{ flex: 1 }}
          containerStyle={{ flex: 1 }}
          data={active}
          extraData={activeReorderExtraData}
          keyExtractor={(i) => i.id}
          onDragEnd={onDragEnd}
          renderItem={renderDraggable}
          disableVirtualization
          contentContainerStyle={{ paddingTop: 8 }}
          ListEmptyComponent={
            completed.length === 0 ? (
              <View style={styles.listEmptyWrap}>
                <Ionicons name="basket-outline" size={42} color={colors.borderMuted} />
                <Text style={styles.listEmptyTitle}>No items yet</Text>
                <Text style={styles.listEmptyText}>Tap + below to add your first item.</Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            <View style={{ paddingBottom: listBottomInset }}>
              {completed.length ? <Text style={styles.sectionLabel}>Checked</Text> : null}
              {completed.map((item) => (
                <Reanimated.View
                  key={item.id}
                  entering={checkedRowEntering}
                  style={{ width: "100%" }}
                  collapsable={false}
                >
                  {renderRow(item, { draggable: false })}
                </Reanimated.View>
              ))}
            </View>
          }
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
            style={styles.bulkCircleBtn}
            onPress={confirmBulkCheckSelected}
            disabled={selectedIds.size === 0}
            accessibilityRole="button"
            accessibilityLabel="Bulk check selected tasks"
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={22}
              color={selectedIds.size ? colors.primaryDark : colors.placeholder}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bulkCircleBtn}
            onPress={() => confirmBulkPrioritySelected(true)}
            disabled={selectedIds.size === 0}
            accessibilityRole="button"
            accessibilityLabel="Bulk prioritize selected tasks"
          >
            <Ionicons
              name="star"
              size={22}
              color={selectedIds.size ? colors.micIcon : colors.placeholder}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bulkCircleBtnDanger}
            onPress={bulkDeleteSelected}
            disabled={selectedIds.size === 0}
            accessibilityRole="button"
            accessibilityLabel="Bulk delete selected tasks"
          >
            <Ionicons
              name="trash-outline"
              size={22}
              color={selectedIds.size ? colors.micIcon : colors.placeholder}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bulkCircleBtn}
            onPress={exitBulkMode}
            accessibilityRole="button"
            accessibilityLabel="Cancel bulk selection"
          >
            <Ionicons name="close" size={22} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={[styles.fabBarWrap, { bottom: floatingBarBottom }]}>
        <View style={styles.fabBar}>
          <View style={[styles.fabBarLane, styles.fabBarLaneLeft]} />
          <TouchableOpacity
            style={styles.fabIconBtn}
            onPress={openBulkVoiceModal}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel="Bulk tasks by voice"
          >
            <View style={styles.fabMicGradientBase} pointerEvents="none" />
            <Animated.View
              style={[styles.fabMicGradientAccentA, micBlobAAnimatedStyle]}
              pointerEvents="none"
            />
            <Animated.View
              style={[styles.fabMicGradientAccentB, micBlobBAnimatedStyle]}
              pointerEvents="none"
            />
            <View style={styles.fabMicInnerRing} pointerEvents="none" />
            <Ionicons name="mic" size={22} color={colors.micIcon} />
          </TouchableOpacity>
          <View style={[styles.fabBarLane, styles.fabBarLaneRight]}>
            <TouchableOpacity
              style={styles.fabScanBtn}
              onPress={openScanModal}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel="Capture or upload tasks from photo"
            >
              <Ionicons name="camera" size={22} color={colors.primaryDark} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.fabPrimaryBtn}
              onPress={openAddModal}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel="Add task"
            >
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

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
                      accessibilityLabel="Delete task"
                    >
                      <Ionicons name="trash-outline" size={20} color={colors.danger} />
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.trashPlaceholder} />
                  )}
                  <Text style={styles.modalTitle}>
                    {itemModalMode === "add" ? "Add task" : "Edit task"}
                  </Text>
                  <TouchableOpacity onPress={closeItemModal} style={styles.modalClose}>
                    <Ionicons name="close" size={26} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.modalForm}>
                  <View style={[styles.modalTopControls, itemModalMode === "edit" && styles.modalTopControlsEdit]}>
                    {itemModalMode === "add" ? (
                      <TouchableOpacity
                        style={styles.bulkFromAddBtn}
                        onPress={openBulkFromItemModal}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel="Open bulk tasks by voice"
                      >
                        <Ionicons name="mic" size={16} color={colors.micIcon} />
                        <Text style={styles.bulkFromAddBtnText}>Bulk Add</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <View style={styles.addRow}>
                    <View style={styles.addNameShell}>
                      <TextInput
                        value={formName}
                        onChangeText={setFormName}
                        style={styles.addNameField}
                        placeholder="Task name"
                        placeholderTextColor={colors.placeholder}
                      />
                      <TouchableOpacity
                        onPress={() => void onMicName()}
                        style={styles.fieldMicBtn}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel="Voice input for task name"
                      >
                        <Ionicons
                          name="mic"
                          size={20}
                          color={listening && voiceTarget === "name" ? colors.danger : colors.primary}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                  {itemModalMode === "edit" ? (
                    <TouchableOpacity style={styles.saveBtn} onPress={onSaveEdit}>
                      <Ionicons name="save-outline" size={20} color="#fff" />
                      <Text style={styles.saveBtnText}>Save</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.addBtn} onPress={onSaveAdd}>
                      <Ionicons name="add-circle-outline" size={20} color="#fff" />
                      <Text style={styles.addBtnText}>Add task</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={bulkModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeBulkVoiceModal}
      >
        <View style={styles.bulkModalRoot}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={closeBulkVoiceModal} />
          <View style={[styles.bulkModalCard, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.bulkHero} pointerEvents="none" />
            <View style={styles.bulkHeroBlobA} pointerEvents="none" />
            <View style={styles.bulkHeroBlobB} pointerEvents="none" />

            <View style={styles.bulkModalHeader}>
              <View style={styles.bulkHeaderPill}>
                <Ionicons name="sparkles" size={14} color={colors.micIcon} />
                <Text style={styles.bulkHeaderPillText}>On-device</Text>
              </View>
              <View style={styles.bulkHeaderActions}>
                <TouchableOpacity
                  onPress={showBulkTasksInfo}
                  style={styles.bulkHeaderIconBtn}
                  accessibilityRole="button"
                  accessibilityLabel="About bulk tasks by voice"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="information-circle-outline" size={22} color={colors.textTertiary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={closeBulkVoiceModal}
                  style={styles.bulkHeaderIconBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <Ionicons name="close" size={22} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.bulkModalTitle} numberOfLines={2}>
              Bulk Tasks by Voice
            </Text>
            <Text style={styles.bulkModalHint}>
              Say each task, separated by AND.
            </Text>

            <View style={styles.bulkFormatCard}>
              <Text style={styles.bulkFormatLine}>“call mom and buy milk and schedule dentist”</Text>
              <Text style={styles.bulkFormatSub}>and</Text>
              <Text style={styles.bulkFormatLine}>“review budget and email team and jog 20 minutes”</Text>
            </View>

            <TouchableOpacity
              style={[
                styles.bulkMicOuter,
                listening && voiceTarget === "bulk" && styles.bulkMicOuterActive,
                bulkProcessing && styles.bulkMicOuterDisabled,
              ]}
              onPress={() => void onBulkMicPress()}
              disabled={bulkProcessing}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel={listening && voiceTarget === "bulk" ? "Stop listening" : "Start listening"}
            >
              <View style={styles.bulkMicFill} pointerEvents="none" />
              <View style={styles.bulkMicOctagon} pointerEvents="none" />
              <Animated.View
                style={[styles.bulkMicBlobA, micBlobAAnimatedStyle]}
                pointerEvents="none"
              />
              <Animated.View
                style={[styles.bulkMicBlobB, micBlobBAnimatedStyle]}
                pointerEvents="none"
              />
              <Ionicons
                name={listening && voiceTarget === "bulk" ? "stop-circle" : "mic"}
                size={56}
                color={
                  bulkProcessing
                    ? colors.placeholder
                    : listening && voiceTarget === "bulk"
                      ? colors.micIcon
                      : colors.primaryDark
                }
              />
            </TouchableOpacity>

            <Text style={styles.bulkStatusLabel}>
              {bulkProcessing
                ? "Adding tasks…"
                : listening && voiceTarget === "bulk"
                  ? "Listening… tap again to finish"
                  : "Tap to speak"}
            </Text>
            {bulkTranscript ? (
              <ScrollView style={styles.bulkTranscriptScroll} keyboardShouldPersistTaps="handled">
                <Text style={styles.bulkTranscriptText}>{bulkTranscript}</Text>
              </ScrollView>
            ) : null}
            {bulkProcessing ? (
              <ActivityIndicator style={{ marginTop: 12 }} size="small" color={colors.primary} />
            ) : null}
            {lastError ? <Text style={styles.bulkErrorText}>{lastError}</Text> : null}
          </View>
        </View>
      </Modal>

      <Modal visible={scanLoading && !scanModalVisible} transparent animationType="fade" statusBarTranslucent>
        <View
          style={styles.scanBusyGateRoot}
          accessibilityLabel={scanLoadingLabel || "Scan in progress"}
        >
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.scanBusyGateText}>{scanLoadingLabel || "Working…"}</Text>
        </View>
      </Modal>

      <Modal
        visible={scanModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeScanModal}
      >
        <View ref={scanModalRootRef} style={styles.bulkModalRoot} collapsable={false}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={onScanBackdropPress} />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1, width: "100%", maxHeight: "100%" }}
            keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 24 : 0}
          >
            <ScrollView
              ref={scanModalScrollRef}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: scanModalKeyboardInset > 0 ? "flex-end" : "center",
                paddingTop: 0,
                paddingBottom:
                  insets.bottom + (scanModalKeyboardInset > 0 ? scanModalKeyboardInset + 12 : 22),
              }}
            >
              <View style={[styles.bulkModalCard, { paddingBottom: 28 }]}>
                <View style={styles.bulkHero} pointerEvents="none" />
                <View style={styles.bulkHeroBlobA} pointerEvents="none" />
                <View style={styles.bulkHeroBlobB} pointerEvents="none" />
                <View style={styles.bulkModalHeader}>
                  <View style={styles.bulkHeaderPill}>
                    <Ionicons name="scan-outline" size={15} color={colors.micIcon} />
                    <Text style={styles.bulkHeaderPillText}>Scan tasks</Text>
                  </View>
                  <View style={styles.scanHeaderAside}>
                    <TouchableOpacity
                      onPress={closeScanModal}
                      style={styles.bulkHeaderIconBtn}
                      accessibilityRole="button"
                      accessibilityLabel="Close scan modal"
                    >
                      <Ionicons name="close" size={22} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                </View>
                {scanActiveTab === "capture" ? (
                  <>
                    <Text style={styles.bulkModalTitle}>Capture or upload</Text>
                    <Text style={styles.bulkModalHint}>
                      Photograph your paper notes, then review the text before importing tasks.
                    </Text>
                  </>
                ) : null}
                <View style={styles.scanTabsRow}>
                  <TouchableOpacity
                    style={[styles.scanTabBtn, scanActiveTab === "capture" && styles.scanTabBtnActive]}
                    onPress={() => {
                      setScanWordSuggest(null);
                      clearScanLexFlash();
                      setScanActiveTab("capture");
                    }}
                    activeOpacity={0.9}
                    accessibilityRole="button"
                    accessibilityLabel="Open capture tab"
                  >
                    <Text
                      style={[
                        styles.scanTabBtnText,
                        scanActiveTab === "capture" && styles.scanTabBtnTextActive,
                      ]}
                    >
                      Capture
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.scanTabsDivider} />
                  <TouchableOpacity
                    style={[
                      styles.scanTabBtn,
                      !canOpenScanResults && styles.scanTabBtnDisabled,
                      scanActiveTab === "results" && styles.scanTabBtnActive,
                    ]}
                    onPress={() => {
                      if (!canOpenScanResults) return;
                      setScanWordSuggest(null);
                      clearScanLexFlash();
                      setScanActiveTab("results");
                    }}
                    activeOpacity={0.9}
                    accessibilityRole="button"
                    accessibilityLabel="Open results tab"
                    accessibilityState={{ disabled: !canOpenScanResults }}
                    disabled={!canOpenScanResults}
                  >
                    <Text
                      style={[
                        styles.scanTabBtnText,
                        !canOpenScanResults && styles.scanTabBtnTextDisabled,
                        scanActiveTab === "results" && styles.scanTabBtnTextActive,
                      ]}
                    >
                      Results
                    </Text>
                  </TouchableOpacity>
                </View>
                {scanHintText ? (
                  <View style={styles.scanHintBanner}>
                    <Ionicons name="information-circle-outline" size={18} color={colors.micIcon} />
                    <Text style={styles.scanHintBannerText}>{scanHintText}</Text>
                  </View>
                ) : null}
                {scanActiveTab === "capture" ? (
                  <>
                    <View style={styles.scanActionsCard}>
                      <View style={styles.scanActionRow}>
                        <TouchableOpacity
                          style={styles.scanActionPrimary}
                          onPress={() => void onScanCameraPress()}
                          activeOpacity={0.92}
                          accessibilityRole="button"
                          accessibilityLabel="Scan with camera"
                        >
                          <Ionicons name="scan-outline" size={19} color="#fff" />
                          <Text style={styles.scanActionPrimaryText}>Scan</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.scanActionSecondary}
                          onPress={() => void onScanUploadPress()}
                          activeOpacity={0.92}
                          accessibilityRole="button"
                          accessibilityLabel="Upload photo"
                        >
                          <Ionicons name="images-outline" size={19} color={colors.primaryDark} />
                          <Text style={styles.scanActionSecondaryText}>Upload</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    {scanLoading ? (
                      <View style={styles.scanLoadingRow}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={styles.scanLoadingText}>
                          {scanLoadingLabel || "Preparing your tasks..."}
                        </Text>
                      </View>
                    ) : null}
                    {scanImageUri ? (
                      <View style={styles.scanPreviewWrap}>
                        <Image source={{ uri: scanImageUri }} style={styles.scanPreviewImage} resizeMode="cover" />
                        <Text style={styles.scanPreviewCaption} numberOfLines={2}>
                          Image is ready. Open Results to review OCR text and import tasks.
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.scanCaptureTipCard}>
                        <Ionicons name="sparkles-outline" size={16} color={colors.micIcon} />
                        <Text style={styles.scanCaptureTipText}>
                          Results tab unlocks after a successful scan or upload.
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <View style={styles.scanEditorShell}>
                    <View style={styles.scanSmartReviewHeader}>
                      <Ionicons name="sparkles-outline" size={20} color={colors.micIcon} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.scanSmartReviewTitle}>Smart review</Text>
                      </View>
                    </View>
                    {scanFlaggedWords.length > 0 ? (
                      <ScrollView
                        horizontal
                        nestedScrollEnabled
                        showsHorizontalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        style={styles.scanFlaggedChipsScroll}
                        contentContainerStyle={styles.scanFlaggedChipsContent}
                      >
                        {scanFlaggedWords.map((w) => (
                          <View
                            key={w.key}
                            collapsable={false}
                            ref={(node) => {
                              if (node) scanFlaggedChipRefs.current.set(w.key, node);
                              else scanFlaggedChipRefs.current.delete(w.key);
                            }}
                          >
                            <TouchableOpacity
                              style={styles.scanFlaggedChip}
                              onPress={() => openScanWordSuggestFromChip(w)}
                              activeOpacity={0.88}
                              accessibilityRole="button"
                              accessibilityLabel={`Suggestions for ${w.text}`}
                            >
                              <Text style={styles.scanFlaggedChipText} numberOfLines={1}>
                                {w.text}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </ScrollView>
                    ) : null}
                    <View style={{ position: "relative", alignSelf: "stretch" }}>
                      <TextInput
                        ref={scanOcrInputRef}
                        value={scanOcrLineFocus ? scanOcrLineFocus.slice : scanRawText}
                        onChangeText={(t) => {
                          clearScanLexFlash();
                          if (scanOcrLineFocus) {
                            const { lineStart, lineEnd } = scanOcrLineFocus;
                            setScanRawText((prev) => prev.slice(0, lineStart) + t + prev.slice(lineEnd));
                            setScanWordSuggest(null);
                            return;
                          }
                          setScanRawText(t);
                          setScanWordSuggest(null);
                        }}
                        multiline
                        nestedScrollEnabled
                        textAlignVertical="top"
                        scrollEventThrottle={16}
                        onScroll={(e) => setScanOcrScrollY(e.nativeEvent.contentOffset.y)}
                        style={[
                          styles.scanUnifiedTextInput,
                          { zIndex: 2 },
                          Platform.OS === "android" ? { elevation: 0 } : null,
                          scanActiveTab === "results" && (scanWordSuggest || scanLexFlashSpan)
                            ? /* Hide real input glyphs; mirror overlay is the visible text (color tricks still ghost on Android). */
                              { opacity: 0 }
                            : null,
                        ]}
                        caretColor={colors.text}
                        placeholder="OCR text appears here. One line per task works well."
                        placeholderTextColor={colors.placeholder}
                        onFocus={() => {
                          requestAnimationFrame(() => {
                            scanModalScrollRef.current?.scrollToEnd({ animated: true });
                          });
                          setTimeout(() => {
                            scanModalScrollRef.current?.scrollToEnd({ animated: true });
                          }, 160);
                        }}
                      />
                      {scanActiveTab === "results" && (scanWordSuggest || scanLexFlashSpan) ? (
                        <ScanLexMirrorOverlay
                          text={scanOcrLineFocus ? scanOcrLineFocus.slice : scanRawText}
                          suggestSpan={
                            scanWordSuggest
                              ? scanOcrLineFocus
                                ? scanOcrLineFocus.suggestLocal
                                : { start: scanWordSuggest.start, end: scanWordSuggest.end }
                              : null
                          }
                          flashSpan={scanLexFlashSpan}
                          flashOpacity={scanLexFlashOpacity}
                          contentScrollY={scanOcrScrollY}
                          overlayStyle={styles.scanLexMirrorOverlay}
                          textStyle={styles.scanLexMirrorText}
                          suggestMarkStyle={styles.scanLexMirrorSuggestMark}
                          successMarkStyle={styles.scanLexMirrorSuccessMark}
                        />
                      ) : null}
                    </View>
                  </View>
                )}
                {scanActiveTab === "results" && scanLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : null}
                {scanActiveTab === "results" ? (
                  <TouchableOpacity
                    style={[styles.scanImportBtn, scanLoading && { opacity: 0.6 }]}
                    onPress={() => void importScannedText()}
                    disabled={scanLoading}
                  >
                    <Ionicons name="download-outline" size={20} color="#fff" />
                    <Text style={styles.scanImportBtnText}>Import tasks</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
          {scanActiveTab === "results" && scanWordSuggest?.anchor
            ? (() => {
                const anchor = scanWordSuggest.anchor;
                const sg = scanWordSuggest;
                const { rootW, rootH } = scanBubbleLayoutRef.current;
                const edgePad = 8;
                const maxW = Math.min(sg.suggestions.length <= 1 ? 260 : 300, Math.max(120, rootW - edgePad * 2));
                const centerX = anchor.x + anchor.width / 2;
                let left = centerX - maxW / 2;
                left = Math.max(edgePad, Math.min(left, rootW - maxW - edgePad));
                const estBubbleH =
                  sg.suggestions.length === 0 ? 118 : 128 + Math.min(48, sg.suggestions.length * 14);
                const gap = 6;
                const preferTop = anchor.y - estBubbleH - gap;
                const top =
                  preferTop >= 10
                    ? preferTop
                    : Math.min(Math.max(10, rootH - estBubbleH - 12), anchor.y + anchor.height + gap);
                const tailMarginLeft = Math.max(16, Math.min(maxW - 34, centerX - left - 9));
                return (
                  <>
                    <Pressable
                      style={[StyleSheet.absoluteFillObject, { zIndex: 900 }]}
                      onPress={() => setScanWordSuggest(null)}
                      accessibilityRole="button"
                      accessibilityLabel="Dismiss word suggestions"
                    />
                    <View
                      style={[styles.scanSuggestBubbleWrap, { left, top, width: maxW, zIndex: 1000 }]}
                      pointerEvents="box-none"
                    >
                      <View style={styles.scanSuggestBubbleCard}>
                        <Text style={styles.scanSuggestBubbleLabel} numberOfLines={2}>
                          Replace “{sg.original}”
                        </Text>
                        {sg.suggestions.length === 0 ? (
                          <View style={styles.scanSuggestBubbleFooter}>
                            <Text style={styles.scanSuggestHint}>
                              No auto-suggestions. Edit the text, or import and fix the task later.
                            </Text>
                            <View style={styles.scanSuggestBubbleActions}>
                              <TouchableOpacity
                                style={styles.scanSuggestDismissCompact}
                                onPress={() => setScanWordSuggest(null)}
                                accessibilityRole="button"
                                accessibilityLabel="Dismiss suggestions"
                              >
                                <Text style={styles.scanSuggestDismissText}>Dismiss</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : (
                          <View style={styles.scanSuggestBubbleFooter}>
                            <View style={styles.scanSuggestChips}>
                              {sg.suggestions.map((s) => (
                                <TouchableOpacity
                                  key={s}
                                  style={styles.scanSuggestChip}
                                  onPress={() => {
                                    const start = sg.start;
                                    const insert = s;
                                    setScanRawText(replaceScanTextRange(scanRawText, start, sg.end, insert));
                                    setScanWordSuggest(null);
                                    triggerScanLexReplaceFlash(start, insert);
                                  }}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Replace with ${s}`}
                                >
                                  <Text style={styles.scanSuggestChipText}>{s}</Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                            <View style={styles.scanSuggestBubbleActions}>
                              <TouchableOpacity
                                style={styles.scanSuggestDismissCompact}
                                onPress={() => setScanWordSuggest(null)}
                                accessibilityRole="button"
                                accessibilityLabel="Dismiss suggestions"
                              >
                                <Text style={styles.scanSuggestDismissText}>Dismiss</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
                      </View>
                      <View style={[styles.scanSuggestBubbleTail, { marginLeft: tailMarginLeft }]} />
                    </View>
                  </>
                );
              })()
            : null}
        </View>
      </Modal>
    </View>
  );
}
