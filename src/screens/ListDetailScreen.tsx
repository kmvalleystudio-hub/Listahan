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
  Platform,
  Alert,
  ScrollView,
  Pressable,
  FlatList,
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

function nowIso(): string {
  return new Date().toISOString();
}

type ItemModalMode = "add" | "edit" | null;

export default function ListDetailScreen({ navigation, route }: ListDetailProps) {
  const insets = useSafeAreaInsets();
  const { listId } = route.params;
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
    // #region agent log
    fetch("http://127.0.0.1:7265/ingest/ac83ca7d-6fc6-477e-b881-deacc4607e2e", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "52ce9e" },
      body: JSON.stringify({
        sessionId: "52ce9e",
        runId: "list-detail-mount",
        hypothesisId: "H1",
        location: "ListDetailScreen.tsx:mount",
        message: "ListDetail mounted (bulk banner uses View layers, not ExpoLinearGradient native)",
        data: { listId, platform: Platform.OS },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }, [listId]);

  useEffect(() => {
    if (!listening) setVoiceTarget(null);
  }, [listening]);

  useEffect(() => {
    finishingListRef.current = false;
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
    timersRef.current[itemId] = setTimeout(() => void commitCheck(itemId), 2000);
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
    pushList({ ...snap, items: [...snap.items, item] });
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
    pushList({ ...snap, items });
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
      pushList({ ...snap, items: [...snap.items, ...newItems] });
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
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const { active, completed } = splitActiveAndCompleted(list.items);
  const total = totalFromItems(list.items);
  const modalVisible = itemModalMode !== null;
  const showPriceInForm = list.showItemPrice;
  const sym = list.currencySymbol?.trim() || DEFAULT_CURRENCY_SYMBOL;

  const renderItemForm = (isEdit: boolean) => (
    <View style={styles.modalForm}>
      <View style={styles.addRow}>
        <TextInput
          value={formName}
          onChangeText={setFormName}
          style={styles.addName}
          placeholder="Item name"
          placeholderTextColor="#94a3b8"
        />
        <TouchableOpacity onPress={() => void onMicName()} style={styles.micBtn}>
          <Ionicons
            name="mic"
            size={20}
            color={listening && voiceTarget === "name" ? "#dc2626" : "#2563eb"}
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
              color={canDecrementQuantity(formQty) ? "#2563eb" : "#94a3b8"}
            />
          </TouchableOpacity>
          <TextInput
            value={formQty}
            onChangeText={setFormQty}
            style={styles.qtyStepInput}
            placeholder="Qty"
            placeholderTextColor="#94a3b8"
          />
          <TouchableOpacity
            style={[styles.qtyStepBtn, styles.qtyStepBtnRight]}
            onPress={() => setFormQty((q) => adjustQuantityString(q, 1))}
            accessibilityRole="button"
            accessibilityLabel="Increase quantity"
          >
            <Ionicons name="add" size={22} color="#2563eb" />
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
                placeholderTextColor="#94a3b8"
                keyboardType="decimal-pad"
              />
              <TouchableOpacity
                style={styles.priceFieldCurrencyBtn}
                onPress={() => setCurrencyMenuVisible(true)}
                activeOpacity={0.7}
                accessibilityLabel="Choose currency"
              >
                <Text style={styles.priceFieldCurrencyText}>{sym}</Text>
                <Ionicons name="chevron-down" size={14} color="#64748b" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => void onMicPrice()} style={styles.micBtn}>
              <Ionicons
                name="mic"
                size={20}
                color={listening && voiceTarget === "price" ? "#dc2626" : "#2563eb"}
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

    return (
      <View
        style={[
          styles.row,
          rowMuted && styles.rowMuted,
          opts.isActive && { opacity: 0.9 },
        ]}
      >
        {opts.draggable && opts.drag ? (
          <TouchableOpacity onLongPress={opts.drag} delayLongPress={120} style={styles.handle}>
            <Ionicons name="reorder-three" size={26} color="#64748b" />
          </TouchableOpacity>
        ) : (
          <View style={[styles.handle, { opacity: 0.35 }]}>
            <Ionicons name="reorder-three" size={26} color="#cbd5e1" />
          </View>
        )}

        <TouchableOpacity
          style={styles.rowTap}
          onPress={() => openEditModal(item)}
          disabled={isPending}
          activeOpacity={0.75}
        >
          <Text
            style={[styles.itemNameText, rowMuted && styles.strikeText]}
            numberOfLines={2}
          >
            {item.name || "Item"}
          </Text>
          <View style={styles.rowMeta}>
            <Text style={[styles.metaText, rowMuted && styles.strikeText]}>
              {item.quantity ? `Qty ${item.quantity}` : "—"}
            </Text>
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
                  · Tot {sym}
                  {lineTotal(item.price, item.quantity).toFixed(2)}
                </Text>
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>

        <View style={styles.actionCol}>
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
      </View>
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
            <Ionicons name="chevron-back" size={22} color="#0f172a" />
            <Text style={styles.backText}>Lists</Text>
          </TouchableOpacity>
          <Text style={styles.listTitle} numberOfLines={1}>
            {list.name}
          </Text>
          <View style={{ width: 72 }} />
        </View>

        <TouchableOpacity
          activeOpacity={0.92}
          onPress={openBulkVoiceModal}
          accessibilityRole="button"
          accessibilityLabel="Bulk list by voice"
          style={styles.bulkBannerTouch}
        >
          <View style={styles.bulkBannerGradient}>
            <View style={styles.bulkBannerGradientBg} pointerEvents="none">
              <View style={[StyleSheet.absoluteFill, { backgroundColor: "#c2410c" }]} />
              <View
                style={{
                  position: "absolute",
                  right: "-18%",
                  top: "-45%",
                  width: "78%",
                  height: "220%",
                  backgroundColor: "#7dd3fc",
                  opacity: 0.48,
                  transform: [{ rotate: "-24deg" }],
                }}
              />
              <View
                style={{
                  position: "absolute",
                  left: "-12%",
                  bottom: "-35%",
                  width: "62%",
                  height: "170%",
                  backgroundColor: "#fb7185",
                  opacity: 0.42,
                  transform: [{ rotate: "16deg" }],
                }}
              />
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: "#f97316", opacity: 0.5 },
                ]}
              />
            </View>
            <View style={styles.bulkBannerRow}>
              <View style={styles.bulkBannerIconCircle}>
                <Ionicons name="mic" size={22} color="#c2410c" />
              </View>
              <View style={styles.bulkBannerTextCol}>
                <Text style={styles.bulkBannerTitle}>Bulk List by Voice</Text>
                <Text style={styles.bulkBannerSub}>Qty first · Say AND between items · Tap ⓘ for format</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.92)" />
            </View>
          </View>
        </TouchableOpacity>

        {list.showItemPrice ? (
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total Cost</Text>
            <Text style={styles.totalValue}>{formatMoney(total, sym)}</Text>
          </View>
        ) : null}

        <View style={styles.topControlsRow}>
          <View style={[styles.topControlsCol, styles.topControlsColLeft]}>
            <View style={styles.priceToggleInner}>
              <Text style={styles.priceToggleLabel} numberOfLines={1}>
                Item Price
              </Text>
              <Switch
                style={styles.priceSwitch}
                value={list.showItemPrice}
                onValueChange={togglePrice}
              />
            </View>
          </View>
          <View style={[styles.topControlsCol, styles.topControlsColRight]}>
            <TouchableOpacity style={styles.headerAddBtn} onPress={openAddModal} activeOpacity={0.9}>
              <Ionicons name="add" size={22} color="#fff" />
              <Text style={styles.headerAddBtnText}>Add Item</Text>
            </TouchableOpacity>
          </View>
        </View>

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
          ListFooterComponent={
            <View style={{ paddingBottom: insets.bottom + 24 }}>
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

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeItemModal}>
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalBackdrop}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={closeItemModal} />
            <ScrollView
              style={styles.modalScrollView}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[
                styles.modalScroll,
                { paddingBottom: insets.bottom + 24, flexGrow: 1, justifyContent: "flex-end" },
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
                      <Ionicons name="trash-outline" size={24} color="#dc2626" />
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.trashPlaceholder} />
                  )}
                  <Text style={styles.modalTitle}>
                    {itemModalMode === "add" ? "Add item" : "Edit item"}
                  </Text>
                  <TouchableOpacity onPress={closeItemModal} style={styles.modalClose}>
                    <Ionicons name="close" size={26} color="#64748b" />
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
            <View style={styles.bulkModalHeader}>
              <View style={styles.bulkModalHeaderSpacer} />
              <Text style={styles.bulkModalTitle} numberOfLines={1}>
                Bulk List by Voice
              </Text>
              <View style={styles.bulkModalHeaderActions}>
                <TouchableOpacity
                  onPress={showBulkListInfo}
                  style={styles.bulkModalInfoBtn}
                  accessibilityRole="button"
                  accessibilityLabel="About bulk list by voice"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="information-circle-outline" size={26} color="#64748b" />
                </TouchableOpacity>
                <TouchableOpacity onPress={closeBulkVoiceModal} style={styles.modalClose}>
                  <Ionicons name="close" size={26} color="#64748b" />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.bulkModalHint}>
              Quantity first, then name. Separate items with AND (or a comma)—e.g. “one bear brand and two eggs and
              one coffee” or “3 milk, 2 bread”. Tap the mic to start, tap again to stop. On-device only (no
              internet). Tap ⓘ for full examples.
            </Text>
            <TouchableOpacity
              style={[
                styles.bulkMicOuter,
                listening && voiceTarget === "bulk" && styles.bulkMicOuterActive,
                bulkProcessing && styles.bulkMicOuterDisabled,
              ]}
              onPress={() => void onBulkMicPress()}
              disabled={bulkProcessing}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={listening && voiceTarget === "bulk" ? "Stop listening" : "Start listening"}
            >
              <Ionicons
                name={listening && voiceTarget === "bulk" ? "stop-circle" : "mic"}
                size={56}
                color={bulkProcessing ? "#94a3b8" : listening && voiceTarget === "bulk" ? "#dc2626" : "#2563eb"}
              />
            </TouchableOpacity>
            <Text style={styles.bulkStatusLabel}>
              {bulkProcessing
                ? "Creating items…"
                : listening && voiceTarget === "bulk"
                  ? "Listening… tap again when finished"
                  : "Tap to speak"}
            </Text>
            {bulkTranscript ? (
              <ScrollView style={styles.bulkTranscriptScroll} keyboardShouldPersistTaps="handled">
                <Text style={styles.bulkTranscriptText}>{bulkTranscript}</Text>
              </ScrollView>
            ) : null}
            {bulkProcessing ? (
              <ActivityIndicator style={{ marginTop: 12 }} size="small" color="#2563eb" />
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f4f6f8",
  },
  staticChrome: {
    flexShrink: 0,
  },
  listBody: {
    flex: 1,
    minHeight: 0,
  },
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f4f6f8",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    width: 88,
  },
  backText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
  },
  listTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
  },
  topControlsRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 2,
    marginBottom: 24,
    gap: 10,
  },
  topControlsCol: {
    minWidth: 0,
  },
  topControlsColLeft: {
    flex: 0.72,
    minWidth: 112,
  },
  topControlsColRight: {
    flex: 1,
    minWidth: 138,
  },
  priceToggleInner: {
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    flex: 1,
    minHeight: 48,
    gap: 8,
  },
  priceToggleLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    flex: 1,
    flexShrink: 1,
    marginRight: 4,
    minWidth: 72,
  },
  priceSwitch: {
    flexShrink: 0,
  },
  headerAddBtn: {
    backgroundColor: "#2563eb",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    flex: 1,
    minHeight: 48,
    shadowColor: "#1d4ed8",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  headerAddBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  bulkBannerTouch: {
    width: "100%",
    marginBottom: 12,
    shadowColor: "#9a3412",
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  bulkBannerGradient: {
    overflow: "hidden",
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  bulkBannerGradientBg: {
    ...StyleSheet.absoluteFillObject,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  bulkBannerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 14,
    zIndex: 1,
  },
  bulkBannerIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.96)",
    alignItems: "center",
    justifyContent: "center",
  },
  bulkBannerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  bulkBannerTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0.2,
    textShadowColor: "rgba(0,0,0,0.12)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  bulkBannerSub: {
    marginTop: 3,
    color: "rgba(255,255,255,0.92)",
    fontSize: 12,
    fontWeight: "700",
  },
  bulkModalRoot: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.5)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  bulkModalCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    maxHeight: "88%",
    shadowColor: "#0f172a",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  bulkModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 4,
  },
  bulkModalHeaderSpacer: {
    width: 88,
  },
  bulkModalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    textAlign: "center",
  },
  bulkModalHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    width: 88,
  },
  bulkModalInfoBtn: {
    width: 40,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  bulkModalHint: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 20,
    marginBottom: 20,
  },
  bulkMicOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#eff6ff",
    borderWidth: 3,
    borderColor: "#bfdbfe",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  bulkMicOuterActive: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
  },
  bulkMicOuterDisabled: {
    opacity: 0.65,
  },
  bulkStatusLabel: {
    textAlign: "center",
    marginTop: 14,
    fontSize: 15,
    fontWeight: "700",
    color: "#334155",
  },
  bulkTranscriptScroll: {
    maxHeight: 160,
    marginTop: 14,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  bulkTranscriptText: {
    padding: 12,
    fontSize: 15,
    color: "#0f172a",
    lineHeight: 22,
  },
  bulkErrorText: {
    marginTop: 12,
    fontSize: 13,
    color: "#b91c1c",
    lineHeight: 18,
  },
  totalCard: {
    marginHorizontal: 16,
    marginTop: 2,
    marginBottom: 12,
    backgroundColor: "#ecfdf3",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#166534",
  },
  totalValue: {
    marginTop: 6,
    fontSize: 28,
    fontWeight: "900",
    color: "#14532d",
  },
  errorText: {
    marginHorizontal: 16,
    marginBottom: 6,
    color: "#b91c1c",
    fontSize: 13,
  },
  modalRoot: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
  },
  modalScrollView: {
    flex: 1,
  },
  modalScroll: {
    padding: 16,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    gap: 12,
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  trashBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#fef2f2",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  trashPlaceholder: {
    width: 44,
    height: 44,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    flex: 1,
    textAlign: "center",
  },
  modalClose: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  modalForm: {
    gap: 10,
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addRowSecond: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  addName: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: "#0f172a",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  qtyStepperShell: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  qtyStepperShellGrow: {
    flex: 1,
    minWidth: 0,
  },
  /** When shown with price: 40% of row (2 : 3 with addPriceRow) */
  qtyStepperShellCompact: {
    flex: 2,
    minWidth: 0,
  },
  qtyStepBtn: {
    width: 44,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
  },
  qtyStepBtnLeft: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "#e2e8f0",
  },
  qtyStepBtnRight: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: "#e2e8f0",
  },
  qtyStepBtnDisabled: {
    opacity: 0.55,
  },
  qtyStepInput: {
    flex: 1,
    minWidth: 36,
    paddingVertical: 12,
    paddingHorizontal: 6,
    fontSize: 16,
    color: "#0f172a",
    textAlign: "center",
    backgroundColor: "#f8fafc",
  },
  /** 60% of row vs qty stepper (flex 2 : 3) */
  addPriceRow: {
    flex: 3,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  priceFieldShell: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  priceFieldInput: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: "#0f172a",
  },
  priceFieldCurrencyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: "#cbd5e1",
    backgroundColor: "#f1f5f9",
  },
  priceFieldCurrencyText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
  },
  currencyModalRoot: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15,23,42,0.45)",
  },
  currencyListCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 14,
    maxHeight: 480,
  },
  currencyListTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
  },
  currencyListHint: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 4,
    marginBottom: 8,
  },
  currencyFlatList: {
    maxHeight: 400,
  },
  currencyListRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  currencyListRowActive: {
    backgroundColor: "#eff6ff",
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  currencyListSymbol: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    width: 40,
  },
  currencyListLabel: {
    flex: 1,
    fontSize: 15,
    color: "#334155",
  },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#dbeafe",
  },
  addBtn: {
    marginTop: 4,
    backgroundColor: "#2563eb",
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  saveBtn: {
    marginTop: 4,
    backgroundColor: "#15803d",
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  sectionLabel: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: "800",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  row: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  rowMuted: {
    opacity: 0.55,
  },
  handle: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTap: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
    gap: 4,
  },
  itemNameText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  rowMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  metaText: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "600",
  },
  priceLineInline: {
    fontSize: 14,
    flexShrink: 1,
    minWidth: 0,
  },
  priceWithSymbol: {
    fontWeight: "700",
    color: "#0f172a",
  },
  lineTotalInline: {
    fontWeight: "600",
    color: "#64748b",
    fontSize: 13,
  },
  strikeText: {
    textDecorationLine: "line-through",
  },
  actionCol: {
    width: 64,
    alignItems: "stretch",
  },
  checkBtn: {
    backgroundColor: "#16a34a",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
  },
  checkText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 10,
    letterSpacing: 0.2,
  },
  undoBtn: {
    backgroundColor: "#f97316",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  undoText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 10,
  },
  uncheckBtn: {
    backgroundColor: "#64748b",
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  uncheckText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 9,
  },
});
