import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Alert,
  ScrollView,
  Pressable,
  FlatList,
  Animated,
  Easing,
} from "react-native";
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from "react-native-draggable-flatlist";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { ListDetailProps } from "../navigation/types";
import { useAppData } from "../context/AppDataContext";
import type { GroceryItem, GroceryList, HistoryEntry } from "../types";
import { generateId } from "../utils/id";
import {
  allItemsCommittedDone,
  normalizeItemsForPersist,
  reindexOrders,
  splitActiveAndCompleted,
} from "../utils/items";
import { CURRENCY_OPTIONS } from "../constants/currencies";
import { DEFAULT_CURRENCY_SYMBOL } from "../constants/currency";
import {
  adjustQuantityString,
  canDecrementQuantity,
  formatMoney,
  lineTotal,
  totalFromItems,
} from "../utils/money";
import { parsePriceFromSpeech } from "../utils/parsePriceFromSpeech";
import { toTitleCaseWords } from "../utils/textFormat";
import { useSpeechToText } from "../hooks/useSpeechToText";
import { parseBulkTranscriptLocal } from "../utils/parseBulkTranscriptLocal";
import { useTheme } from "../context/ThemeContext";
import { createListDetailStyles } from "./listDetailStyles";

function nowIso(): string {
  return new Date().toISOString();
}

function dedupeItemsByName(items: GroceryItem[]): GroceryItem[] {
  const seen = new Set<string>();
  const deduped: GroceryItem[] = [];
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

type ItemModalMode = "add" | "edit" | null;

export default function ListDetailScreen({ navigation, route }: ListDetailProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createListDetailStyles(colors), [colors]);
  const { listId, autoOpenAdd = false } = route.params;
  const { lists, upsertList, archiveCompletedList } = useAppData();

  const list = useMemo(() => lists.find((l) => l.id === listId) ?? null, [lists, listId]);
  const listRef = useRef<GroceryList | null>(list);
  listRef.current = list;

  const draggableFlatListRef = useRef<React.ComponentRef<typeof DraggableFlatList<GroceryItem>> | null>(
    null
  );

  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  /** When true, list was removed on purpose (archived); don't auto-goBack. */
  const finishingListRef = useRef(false);

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
  const [voiceTarget, setVoiceTarget] = useState<"name" | "price" | "bulk" | null>(null);

  const [bulkModalVisible, setBulkModalVisible] = useState(false);
  const [bulkTranscript, setBulkTranscript] = useState("");
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const bulkTranscriptRef = useRef("");

  const [itemModalMode, setItemModalMode] = useState<ItemModalMode>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formQty, setFormQty] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [currencyMenuVisible, setCurrencyMenuVisible] = useState(false);
  /** Android: Modal + keyboard — KeyboardAvoidingView is unreliable; pad scroll content by keyboard height. */
  const [itemModalKeyboardInset, setItemModalKeyboardInset] = useState(0);
  const itemModalOpen = itemModalMode !== null;
  const bulkMicBlobAnim = useRef(new Animated.Value(0)).current;
  const autoOpenHandledRef = useRef(false);

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
        setBulkModalVisible(false);
        setBulkProcessing(false);
      };
    }, [stopSpeech])
  );

  useEffect(() => {
    if (!listening) setVoiceTarget(null);
  }, [listening]);

  useEffect(() => {
    finishingListRef.current = false;
    autoOpenHandledRef.current = false;
    setBulkMode(false);
    setSelectedIds(new Set());
    wiggleIdRef.current = null;
  }, [listId]);

  useEffect(() => {
    if (!list && !finishingListRef.current) navigation.goBack();
  }, [list, navigation]);

  const clearTimer = (itemId: string) => {
    const t = timersRef.current[itemId];
    if (t) clearTimeout(t);
    delete timersRef.current[itemId];
  };

  const pushList = useCallback(
    (next: GroceryList) => {
      upsertList({
        ...next,
        updatedAt: nowIso(),
      });
    },
    [upsertList]
  );

  useEffect(() => {
    if (!list) return;
    const deduped = dedupeItemsByName(list.items);
    if (deduped.length !== list.items.length) {
      pushList({ ...list, items: deduped });
    }
  }, [list, pushList]);

  const commitCheck = useCallback(
    async (itemId: string) => {
      const snap = listRef.current;
      if (!snap) return;
      const { completed } = splitActiveAndCompleted(snap.items);
      const target = snap.items.find((i) => i.id === itemId);
      if (!target || !target.checked || !target.checkPending) return;

      const maxDone = completed.reduce((m, i) => Math.max(m, i.order), -1);
      const nextOrder = maxDone + 1;

      const items = snap.items.map((i) =>
        i.id === itemId ? { ...i, checkPending: false, order: nextOrder } : i
      );

      if (allItemsCommittedDone(items)) {
        const entry: HistoryEntry = {
          id: generateId(),
          sourceListId: snap.id,
          name: snap.name,
          createdAt: snap.createdAt,
          updatedAt: nowIso(),
          items: normalizeItemsForPersist(
            items.map((i) => ({ ...i, checked: true, checkPending: false }))
          ),
          showItemPrice: snap.showItemPrice,
          currencySymbol: snap.currencySymbol?.trim() || DEFAULT_CURRENCY_SYMBOL,
        };
        finishingListRef.current = true;
        try {
          await archiveCompletedList(entry);
          navigation.replace("AllDone", { listId: snap.id });
        } catch {
          finishingListRef.current = false;
        }
      } else {
        pushList({ ...snap, items });
      }
    },
    [archiveCompletedList, navigation, pushList]
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
    pushList({ ...snap, items });
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
    Alert.alert("Bulk check", `Check ${selectedIds.size} item(s)?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: () => {
          const current = listRef.current;
          if (!current) return;
          const items = current.items.map((i) =>
            selectedIds.has(i.id) ? { ...i, checked: true, checkPending: false } : i
          );
          pushList({ ...current, items });
          exitBulkMode();
        },
      },
    ]);
  };

  const bulkDeleteSelected = () => {
    const snap = listRef.current;
    if (!snap || selectedIds.size === 0) return;
    Alert.alert("Delete items", `Remove ${selectedIds.size} selected item(s)?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          const items = snap.items.filter((i) => !selectedIds.has(i.id));
          pushList({ ...snap, items });
          exitBulkMode();
        },
      },
    ]);
  };

  const confirmBulkPrioritySelected = (nextPriority: boolean) => {
    const snap = listRef.current;
    if (!snap || selectedIds.size === 0) return;
    Alert.alert("Bulk prioritize", `Prioritize ${selectedIds.size} item(s)?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: () => {
          const current = listRef.current;
          if (!current) return;
          const items = current.items.map((i) =>
            selectedIds.has(i.id) ? { ...i, priority: nextPriority } : i
          );
          pushList({ ...current, items });
        },
      },
    ]);
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
    const { active } = splitActiveAndCompleted(snap.items.filter((i) => i.id !== itemId));
    const maxActive = active.reduce((m, i) => Math.max(m, i.order), -1);
    const items = snap.items.map((i) =>
      i.id === itemId
        ? { ...i, checked: false, checkPending: false, order: maxActive + 1 }
        : i
    );
    pushList({ ...snap, items });
  };

  const onDragEnd = ({ data }: { data: GroceryItem[] }) => {
    const snap = listRef.current;
    if (!snap) return;
    const { completed } = splitActiveAndCompleted(snap.items);
    const reindexedActive = reindexOrders(data);
    pushList({ ...snap, items: [...reindexedActive, ...completed] });
  };

  const togglePrice = (value: boolean) => {
    const snap = listRef.current;
    if (!snap) return;
    pushList({ ...snap, showItemPrice: value });
  };

  const nextActiveOrder = () => {
    const snap = listRef.current;
    if (!snap) return 0;
    const { active } = splitActiveAndCompleted(snap.items);
    return active.reduce((m, i) => Math.max(m, i.order), -1) + 1;
  };

  const closeItemModal = () => {
    stopSpeech();
    setCurrencyMenuVisible(false);
    setItemModalMode(null);
    setEditingItemId(null);
    setFormName("");
    setFormQty("");
    setFormPrice("");
  };

  const setListCurrencySymbol = (symbol: string) => {
    const snap = listRef.current;
    if (!snap) return;
    const next = symbol.trim().slice(0, 12) || DEFAULT_CURRENCY_SYMBOL;
    pushList({ ...snap, currencySymbol: next });
    setCurrencyMenuVisible(false);
  };

  const openAddModal = () => {
    stopSpeech();
    setEditingItemId(null);
    setFormName("");
    setFormQty("");
    setFormPrice("");
    setItemModalMode("add");
  };

  useEffect(() => {
    if (!autoOpenAdd) return;
    if (autoOpenHandledRef.current) return;
    if (!list) return;
    if (itemModalMode !== null) return;
    if (list.items.length !== 0) return;
    autoOpenHandledRef.current = true;
    openAddModal();
  }, [autoOpenAdd, itemModalMode, list]);

  const openEditModal = (item: GroceryItem) => {
    if (item.checkPending) return;
    stopSpeech();
    setEditingItemId(item.id);
    setFormName(item.name);
    setFormQty(item.quantity);
    setFormPrice(item.price);
    setItemModalMode("edit");
  };

  const onSaveAdd = () => {
    const snap = listRef.current;
    if (!snap) return;
    if (!formName.trim()) return;
    const item: GroceryItem = {
      id: generateId(),
      name: formName.trim(),
      quantity: formQty.trim(),
      price: formPrice.trim(),
      checked: false,
      order: nextActiveOrder(),
    };
    pushList({ ...snap, items: dedupeItemsByName([...snap.items, item]) });
    closeItemModal();
  };

  const onSaveEdit = () => {
    const snap = listRef.current;
    if (!snap || !editingItemId) return;
    if (!formName.trim()) return;
    const items = snap.items.map((i) =>
      i.id === editingItemId
        ? { ...i, name: formName.trim(), quantity: formQty.trim(), price: formPrice.trim() }
        : i
    );
    pushList({ ...snap, items: dedupeItemsByName(items) });
    closeItemModal();
  };

  const onConfirmDelete = () => {
    if (!editingItemId) return;
    Alert.alert("Delete item", "Remove this item from the list?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          const snap = listRef.current;
          if (!snap) return;
          clearTimer(editingItemId);
          pushList({ ...snap, items: snap.items.filter((i) => i.id !== editingItemId) });
          closeItemModal();
        },
      },
    ]);
  };

  const onMicName = async () => {
    if (listening) {
      stopSpeech();
      return;
    }
    setVoiceTarget("name");
    await startSpeech((t) => setFormName(toTitleCaseWords(t)));
  };

  const onMicPrice = async () => {
    if (listening) {
      stopSpeech();
      return;
    }
    setVoiceTarget("price");
    await startSpeech((t) => {
      const p = parsePriceFromSpeech(t);
      if (p) setFormPrice(p);
    });
  };

  const showBulkListInfo = () => {
    Alert.alert(
      "Bulk List by Voice — format",
      "1) Say the QUANTITY first, then the item name.\n2) Say AND before the next item (you can use a comma instead of AND).\n\nExample: “one bear brand and two eggs and one coffee and three cheese and five apples”\nOr: “3 milk, 2 bread, 1 butter”\n\nTap the mic to start, tap again when finished. Bulk lines don’t get spoken prices—use Item Price and edit if needed."
    );
  };

  const openBulkVoiceModal = () => {
    stopSpeech();
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
    clearLastError();
    setBulkModalVisible(false);
    setBulkTranscript("");
    bulkTranscriptRef.current = "";
    setBulkProcessing(false);
  };

  const finishBulkFromTranscript = async (text: string) => {
    const snap = listRef.current;
    if (!snap) return;
    setBulkProcessing(true);
    try {
      const parsed = parseBulkTranscriptLocal(text);
      if (parsed.length === 0) {
        Alert.alert(
          "Nothing to add",
          "We couldn’t find products in that recording. Try listing items more clearly."
        );
        return;
      }
      const { active } = splitActiveAndCompleted(snap.items);
      let nextOrder = active.reduce((m, i) => Math.max(m, i.order), -1) + 1;
      const newItems: GroceryItem[] = parsed.map((p) => {
        const item: GroceryItem = {
          id: generateId(),
          name: toTitleCaseWords(p.name),
          quantity: p.quantity,
          price: p.price,
          checked: false,
          order: nextOrder++,
        };
        return item;
      });
      pushList({ ...snap, items: dedupeItemsByName([...snap.items, ...newItems]) });
      closeBulkVoiceModal();
    } catch (e) {
      Alert.alert("Bulk list", e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBulkProcessing(false);
    }
  };

  const onBulkMicPress = async () => {
    if (bulkProcessing) return;
    if (listening && voiceTarget === "bulk") {
      stopSpeech();
      setVoiceTarget(null);
      const captured = bulkTranscriptRef.current.trim();
      setTimeout(() => {
        void finishBulkFromTranscript(captured);
      }, 450);
      return;
    }
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

  const { active, completed } = splitActiveAndCompleted(list.items);
  const total = totalFromItems(list.items);
  const modalVisible = itemModalMode !== null;
  const showPriceInForm = list.showItemPrice;
  const sym = list.currencySymbol?.trim() || DEFAULT_CURRENCY_SYMBOL;
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

  const renderItemForm = (isEdit: boolean) => (
    <View style={styles.modalForm}>
      <View style={styles.modalTopControls}>
        <TouchableOpacity
          style={styles.bulkFromAddBtn}
          onPress={openBulkFromItemModal}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Open bulk list by voice"
        >
          <Ionicons name="mic" size={16} color={colors.micIcon} />
          <Text style={styles.bulkFromAddBtnText}>Bulk Add</Text>
        </TouchableOpacity>
        <View style={styles.modalPriceToggleInline}>
          <Text style={styles.modalPriceToggleInlineText}>Item Price</Text>
          <Switch
            style={styles.priceSwitch}
            value={showPriceInForm}
            onValueChange={togglePrice}
            trackColor={{ false: colors.switchTrackOff, true: colors.primaryDark }}
            thumbColor={showPriceInForm ? colors.primaryDark : colors.switchThumbOff}
            ios_backgroundColor={colors.iosSwitchBg}
          />
        </View>
      </View>
      <View style={styles.addRow}>
        <TextInput
          value={formName}
          onChangeText={setFormName}
          style={styles.addName}
          placeholder="Item name"
          placeholderTextColor={colors.placeholder}
        />
        <TouchableOpacity onPress={() => void onMicName()} style={styles.micBtn}>
          <Ionicons
            name="mic"
            size={20}
            color={listening && voiceTarget === "name" ? colors.danger : colors.primary}
          />
        </TouchableOpacity>
      </View>
      <View style={styles.addRowSecond}>
        <View
          style={[
            styles.qtyStepperShell,
            showPriceInForm ? styles.qtyStepperShellCompact : styles.qtyStepperShellGrow,
          ]}
        >
          <TouchableOpacity
            style={[
              styles.qtyStepBtn,
              styles.qtyStepBtnLeft,
              !canDecrementQuantity(formQty) && styles.qtyStepBtnDisabled,
            ]}
            onPress={() => setFormQty((q) => adjustQuantityString(q, -1))}
            disabled={!canDecrementQuantity(formQty)}
            accessibilityRole="button"
            accessibilityLabel="Decrease quantity"
          >
            <Ionicons
              name="remove"
              size={22}
              color={canDecrementQuantity(formQty) ? colors.primary : colors.placeholder}
            />
          </TouchableOpacity>
          <TextInput
            value={formQty}
            onChangeText={setFormQty}
            style={styles.qtyStepInput}
            placeholder="Qty"
            placeholderTextColor={colors.placeholder}
          />
          <TouchableOpacity
            style={[styles.qtyStepBtn, styles.qtyStepBtnRight]}
            onPress={() => setFormQty((q) => adjustQuantityString(q, 1))}
            accessibilityRole="button"
            accessibilityLabel="Increase quantity"
          >
            <Ionicons name="add" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
        {showPriceInForm ? (
          <View style={styles.addPriceRow}>
            <View style={styles.priceFieldShell}>
              <TextInput
                value={formPrice}
                onChangeText={setFormPrice}
                style={styles.priceFieldInput}
                placeholder="0.00"
                placeholderTextColor={colors.placeholder}
                keyboardType="decimal-pad"
              />
              <TouchableOpacity
                style={styles.priceFieldCurrencyBtn}
                onPress={() => setCurrencyMenuVisible(true)}
                activeOpacity={0.7}
                accessibilityLabel="Choose currency"
              >
                <Text style={styles.priceFieldCurrencyText}>{sym}</Text>
                <Ionicons name="chevron-down" size={14} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => void onMicPrice()} style={styles.micBtn}>
              <Ionicons
                name="mic"
                size={20}
                color={listening && voiceTarget === "price" ? colors.danger : colors.primary}
              />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
      {isEdit ? (
        <TouchableOpacity style={styles.saveBtn} onPress={onSaveEdit}>
          <Ionicons name="save-outline" size={20} color="#fff" />
          <Text style={styles.saveBtnText}>Save</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.addBtn} onPress={onSaveAdd}>
          <Ionicons name="add-circle-outline" size={20} color="#fff" />
          <Text style={styles.addBtnText}>Add Item</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderRow = (
    item: GroceryItem,
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
            accessibilityLabel={isSelected ? "Deselect item" : "Select item"}
          >
            {isSelected ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
          </TouchableOpacity>
        ) : null}
        {bulkMode ? (
          <Pressable
            style={styles.rowBulkTapOverlay}
            onPress={() => toggleSelected(item.id)}
            accessibilityRole="button"
            accessibilityLabel={isSelected ? "Deselect item" : "Select item"}
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
            <Ionicons name="reorder-three" size={26} color={colors.textTertiary} />
          </TouchableOpacity>
        ) : (
          <View style={[styles.handle, { opacity: 0.35 }]}>
            <Ionicons name="reorder-three" size={26} color={colors.borderMuted} />
          </View>
        )}

        <TouchableOpacity
          style={styles.rowTap}
          onPress={() => {
            if (bulkMode) {
              toggleSelected(item.id);
              return;
            }
            openEditModal(item);
          }}
          onLongPress={() => {
            if (!bulkMode) enterBulkMode(item.id);
          }}
          delayLongPress={650}
          disabled={isPending && !bulkMode}
          activeOpacity={0.75}
        >
          <View style={styles.rowTitleLine}>
            {item.quantity ? (
              <>
                <Text style={[styles.qtyInlineText, rowMuted && styles.strikeText]} numberOfLines={1}>
                  {item.quantity}
                </Text>
                <View style={styles.qtyDivider} />
              </>
            ) : null}
            <Text
              style={[styles.itemNameText, rowMuted && styles.strikeText]}
              numberOfLines={2}
            >
              {item.name || "Item"}
            </Text>
          </View>
          <View style={styles.rowMeta}>
            {list.showItemPrice ? (
              <Text
                style={[styles.priceLineInline, rowMuted && styles.strikeText]}
                numberOfLines={2}
              >
                <Text style={styles.priceWithSymbol}>
                  {item.price ? `${sym}${item.price}` : "—"}
                </Text>
                <Text style={styles.lineTotalInline}>
                  {" "}
                  · {sym}
                  {lineTotal(item.price, item.quantity).toFixed(2)}
                </Text>
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>

        <View style={styles.actionCol}>
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
            accessibilityLabel={item.priority ? "Unprioritize item" : "Prioritize item"}
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
      </Animated.View>
    );
  };

  const renderDraggable = ({ item, drag, isActive }: RenderItemParams<GroceryItem>) => (
    <ScaleDecorator>
      {renderRow(item, { drag, isActive, draggable: true })}
    </ScaleDecorator>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.staticChrome}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
            <Text style={styles.backText}>Lists</Text>
          </TouchableOpacity>
          <Text style={styles.listTitle} numberOfLines={1}>
            {list.name}
          </Text>
          <View style={{ width: 72 }} />
        </View>

        {list.showItemPrice ? (
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total Cost</Text>
            <Text style={styles.totalValueInline}>{formatMoney(total, sym)}</Text>
          </View>
        ) : null}

        {lastError ? <Text style={styles.errorText}>{lastError}</Text> : null}
      </View>

      <View style={styles.listBody}>
        <DraggableFlatList
          ref={draggableFlatListRef}
          style={{ flex: 1 }}
          containerStyle={{ flex: 1 }}
          data={active}
          keyExtractor={(i) => i.id}
          onDragEnd={onDragEnd}
          renderItem={renderDraggable}
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
              {completed.length ? (
                <Text style={styles.sectionLabel}>Checked</Text>
              ) : null}
              {completed.map((item) => (
                <View key={item.id}>{renderRow(item, { draggable: false })}</View>
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
            accessibilityLabel="Bulk check selected items"
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
            accessibilityLabel="Bulk prioritize selected items"
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
            accessibilityLabel="Bulk delete selected items"
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
          <View style={styles.fabPriceToggle}>
            <Text style={styles.fabPriceToggleLabel} numberOfLines={1}>
              Item Price
            </Text>
            <Switch
              style={styles.priceSwitch}
              value={list.showItemPrice}
              onValueChange={togglePrice}
              trackColor={{ false: colors.switchTrackOff, true: colors.primaryDark }}
              thumbColor={list.showItemPrice ? colors.primaryDark : colors.switchThumbOff}
              ios_backgroundColor={colors.iosSwitchBg}
            />
          </View>
          <TouchableOpacity
            style={styles.fabIconBtn}
            onPress={openBulkVoiceModal}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel="Bulk list by voice"
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
          <TouchableOpacity
            style={styles.fabPrimaryBtn}
            onPress={openAddModal}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel="Add item"
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
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
                      accessibilityLabel="Delete item"
                    >
                      <Ionicons name="trash-outline" size={24} color={colors.danger} />
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.trashPlaceholder} />
                  )}
                  <Text style={styles.modalTitle}>
                    {itemModalMode === "add" ? "Add item" : "Edit item"}
                  </Text>
                  <TouchableOpacity onPress={closeItemModal} style={styles.modalClose}>
                    <Ionicons name="close" size={26} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
                {itemModalMode ? renderItemForm(itemModalMode === "edit") : null}
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
                  onPress={showBulkListInfo}
                  style={styles.bulkHeaderIconBtn}
                  accessibilityRole="button"
                  accessibilityLabel="About bulk list by voice"
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
              Bulk List by Voice
            </Text>
            <Text style={styles.bulkModalHint}>
              Say quantity first, then name. Separate items with AND (or a comma).
            </Text>

            <View style={styles.bulkFormatCard}>
              <Text style={styles.bulkFormatLine}>“one bear brand and two eggs and one coffee”</Text>
              <Text style={styles.bulkFormatSub}>or</Text>
              <Text style={styles.bulkFormatLine}>“3 milk, 2 bread”</Text>
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
                ? "Creating items…"
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

      <Modal
        visible={currencyMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCurrencyMenuVisible(false)}
      >
        <View style={styles.currencyModalRoot}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setCurrencyMenuVisible(false)}
          />
          <View style={[styles.currencyListCard, { paddingBottom: insets.bottom + 12 }]}>
            <Text style={styles.currencyListTitle}>Select currency</Text>
            <Text style={styles.currencyListHint}>Applies to this whole list</Text>
            <FlatList
              data={CURRENCY_OPTIONS}
              keyExtractor={(c) => c.code}
              style={styles.currencyFlatList}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item: c }) => (
                <TouchableOpacity
                  style={[
                    styles.currencyListRow,
                    c.symbol === sym && styles.currencyListRowActive,
                  ]}
                  onPress={() => setListCurrencySymbol(c.symbol)}
                >
                  <Text style={styles.currencyListSymbol}>{c.symbol}</Text>
                  <Text style={styles.currencyListLabel}>{c.label}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

