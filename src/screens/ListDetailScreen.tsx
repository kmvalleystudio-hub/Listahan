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
  type LayoutChangeEvent,
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

  const totalCardMeasureRef = useRef<View | null>(null);
  const draggableFlatListRef = useRef<React.ComponentRef<typeof DraggableFlatList<GroceryItem>> | null>(
    null
  );

  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  /** When true, list was removed on purpose (archived); don't auto-goBack. */
  const finishingListRef = useRef(false);

  const { start: startSpeech, stop: stopSpeech, listening, lastError } = useSpeechToText();
  const [voiceTarget, setVoiceTarget] = useState<"name" | "price" | null>(null);

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
      };
    }, [stopSpeech])
  );

  useEffect(() => {
    if (!listening) setVoiceTarget(null);
  }, [listening]);

  useEffect(() => {
    finishingListRef.current = false;
  }, [listId]);

  useEffect(() => {
    if (!list && !finishingListRef.current) navigation.goBack();
  }, [list, navigation]);

  useEffect(() => {
    if (!list) return;
    const showPrice = list.showItemPrice;
    const handle = requestAnimationFrame(() => {
      const listNative = draggableFlatListRef.current as unknown as {
        measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
      } | null;
      listNative?.measureInWindow?.((lx, ly, lw, lh) => {
        if (showPrice && totalCardMeasureRef.current) {
          totalCardMeasureRef.current.measureInWindow((tx, ty, tw, th) => {
            // #region agent log
            fetch("http://127.0.0.1:7265/ingest/ac83ca7d-6fc6-477e-b881-deacc4607e2e", {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "52ce9e" },
              body: JSON.stringify({
                sessionId: "52ce9e",
                runId: "post-reorder",
                hypothesisId: "H1-geometry",
                location: "ListDetailScreen.tsx:overlapMeasure",
                message: "total vs list window",
                data: {
                  list: { lx, ly, lw, lh },
                  total: { tx, ty, tw, th },
                  totalBottom: ty + th,
                  overlapPx: ty + th - ly,
                },
                timestamp: Date.now(),
              }),
            }).catch(() => {});
            // #endregion
          });
        } else {
          // #region agent log
          fetch("http://127.0.0.1:7265/ingest/ac83ca7d-6fc6-477e-b881-deacc4607e2e", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "52ce9e" },
            body: JSON.stringify({
              sessionId: "52ce9e",
              runId: "post-reorder",
              hypothesisId: "H2-no-total",
              location: "ListDetailScreen.tsx:overlapMeasure",
              message: "list window only",
              data: { list: { lx, ly, lw, lh }, showItemPrice: showPrice },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          // #endregion
        }
      });
    });
    return () => cancelAnimationFrame(handle);
  }, [list, list?.showItemPrice, list?.items.length, list?.updatedAt, lastError, insets.top]);

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
      <View
        style={styles.addRowSecond}
        onLayout={(e: LayoutChangeEvent) => {
          const w = e.nativeEvent.layout.width;
          // #region agent log
          fetch("http://127.0.0.1:7265/ingest/ac83ca7d-6fc6-477e-b881-deacc4607e2e", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "52ce9e" },
            body: JSON.stringify({
              sessionId: "52ce9e",
              runId: "modal-qty-price-layout",
              hypothesisId: "H4-row-width",
              location: "ListDetailScreen.tsx:addRowSecond",
              message: "second row width",
              data: { rowWidth: w, showPriceInForm },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          // #endregion
        }}
      >
        <View
          style={[
            styles.qtyStepperShell,
            showPriceInForm ? styles.qtyStepperShellCompact : styles.qtyStepperShellGrow,
          ]}
          onLayout={(e: LayoutChangeEvent) => {
            const w = e.nativeEvent.layout.width;
            // #region agent log
            fetch("http://127.0.0.1:7265/ingest/ac83ca7d-6fc6-477e-b881-deacc4607e2e", {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "52ce9e" },
              body: JSON.stringify({
                sessionId: "52ce9e",
                runId: "modal-qty-price-layout",
                hypothesisId: "H1-qty-steals-flex",
                location: "ListDetailScreen.tsx:qtyStepperShell",
                message: "qty stepper width",
                data: { qtyShellWidth: w, showPriceInForm },
                timestamp: Date.now(),
              }),
            }).catch(() => {});
            // #endregion
          }}
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
          <View
            style={styles.addPriceRow}
            onLayout={(e: LayoutChangeEvent) => {
              const w = e.nativeEvent.layout.width;
              // #region agent log
              fetch("http://127.0.0.1:7265/ingest/ac83ca7d-6fc6-477e-b881-deacc4607e2e", {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "52ce9e" },
                body: JSON.stringify({
                  sessionId: "52ce9e",
                  runId: "modal-qty-price-layout",
                  hypothesisId: "H2-price-row-minwidth",
                  location: "ListDetailScreen.tsx:addPriceRow",
                  message: "price row width",
                  data: { priceRowWidth: w },
                  timestamp: Date.now(),
                }),
              }).catch(() => {});
              // #endregion
            }}
          >
            <View
              style={styles.priceFieldShell}
              onLayout={(e: LayoutChangeEvent) => {
                const w = e.nativeEvent.layout.width;
                // #region agent log
                fetch("http://127.0.0.1:7265/ingest/ac83ca7d-6fc6-477e-b881-deacc4607e2e", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "52ce9e" },
                  body: JSON.stringify({
                    sessionId: "52ce9e",
                    runId: "modal-qty-price-layout",
                    hypothesisId: "H3-price-shell-collapsed",
                    location: "ListDetailScreen.tsx:priceFieldShell",
                    message: "price shell width",
                    data: { priceShellWidth: w },
                    timestamp: Date.now(),
                  }),
                }).catch(() => {});
                // #endregion
              }}
            >
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

        {list.showItemPrice ? (
          <View ref={totalCardMeasureRef} style={styles.totalCard}>
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
