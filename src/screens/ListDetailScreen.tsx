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
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { ImagePickerAsset } from "expo-image-picker";
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
import { parseScannedListLocal } from "../utils/parseScannedListLocal";
import { runOcrFromImageBase64, runOcrFromImageUri } from "../utils/scanListOcr";
import {
  replaceScanTextRange,
  shouldFlagOcrWord,
  suggestOcrWordCorrections,
  tokenizeScanText,
} from "../utils/scanOcrLexicon";
import { extractUnitFromText, lookupUnitsForItem, resolveTrustedProductName } from "../utils/productRegistry";
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
const UI_DEBUG_VERSION = "v1.0.0-scan-debug-30";

/** Set `true` to show ImagePicker result alerts while debugging scan/camera. */
const SCAN_DEBUG_PICKER_ALERTS = false;

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
  const [formUnit, setFormUnit] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [currencyMenuVisible, setCurrencyMenuVisible] = useState(false);
  const [unitMenuVisible, setUnitMenuVisible] = useState(false);
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [scanImageUri, setScanImageUri] = useState("");
  const [scanRawText, setScanRawText] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [scanHintText, setScanHintText] = useState("");
  const [scanRawEditMode, setScanRawEditMode] = useState(false);
  const [scanWordSuggest, setScanWordSuggest] = useState<{
    start: number;
    end: number;
    original: string;
    suggestions: string[];
  } | null>(null);
  const [scanLoadingLabel, setScanLoadingLabel] = useState("");
  const [editSeedUnits, setEditSeedUnits] = useState<string[]>([]);
  const [editSeedName, setEditSeedName] = useState("");
  /** Android: Modal + keyboard — KeyboardAvoidingView is unreliable; pad scroll content by keyboard height. */
  const [itemModalKeyboardInset, setItemModalKeyboardInset] = useState(0);
  const [scanModalKeyboardInset, setScanModalKeyboardInset] = useState(0);
  const itemModalOpen = itemModalMode !== null;
  const bulkMicBlobAnim = useRef(new Animated.Value(0)).current;
  const autoOpenHandledRef = useRef(false);
  const scanModalScrollRef = useRef<ScrollView | null>(null);

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
    if (!scanModalVisible || !scanRawEditMode) {
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
  }, [scanModalVisible, scanRawEditMode]);

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

  const commitOrFinishList = useCallback(
    async (base: GroceryList, nextItems: GroceryItem[]) => {
      if (allItemsCommittedDone(nextItems)) {
        const entry: HistoryEntry = {
          id: generateId(),
          sourceListId: base.id,
          name: base.name,
          createdAt: base.createdAt,
          updatedAt: nowIso(),
          items: normalizeItemsForPersist(
            nextItems.map((i) => ({ ...i, checked: true, checkPending: false }))
          ),
          showItemPrice: base.showItemPrice,
          currencySymbol: base.currencySymbol?.trim() || DEFAULT_CURRENCY_SYMBOL,
        };
        finishingListRef.current = true;
        try {
          await archiveCompletedList(entry);
          navigation.replace("AllDone", { listId: base.id });
        } catch {
          finishingListRef.current = false;
        }
        return;
      }
      pushList({ ...base, items: nextItems });
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
          void commitOrFinishList(current, items);
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
          void commitOrFinishList(snap, items);
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
    setFormUnit("");
    setFormPrice("");
    setEditSeedUnits([]);
    setEditSeedName("");
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
    setFormUnit("");
    setFormPrice("");
    setEditSeedUnits([]);
    setEditSeedName("");
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
    setFormUnit(item.unit ?? "");
    setFormPrice(item.price);
    setEditSeedUnits(
      Array.from(new Set([...(item.unitOptions ?? []), item.unit ?? ""].map((u) => u.trim()).filter(Boolean)))
    );
    setEditSeedName(item.name.trim().toLowerCase());
    setItemModalMode("edit");
  };

  const formUnitOptions = useMemo(() => {
    const suggested = lookupUnitsForItem(formName);
    const isSameAsEditBaseName = itemModalMode === "edit" && formName.trim().toLowerCase() === editSeedName;
    const base = isSameAsEditBaseName ? [...editSeedUnits, ...suggested] : suggested;
    return Array.from(new Set(base.map((u) => u.trim()).filter(Boolean)));
  }, [editSeedName, editSeedUnits, formName, itemModalMode]);

  useEffect(() => {
    if (!formUnitOptions.length) return;
    const current = formUnit.trim();
    if (!current || !formUnitOptions.includes(current)) {
      setFormUnit(formUnitOptions[0]);
    }
  }, [formUnit, formUnitOptions]);

  const onSaveAdd = () => {
    const snap = listRef.current;
    if (!snap) return;
    if (!formName.trim()) return;
    const item: GroceryItem = {
      id: generateId(),
      name: formName.trim(),
      quantity: formQty.trim(),
      unit: formUnit.trim(),
      unitOptions: formUnitOptions,
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
        ? {
            ...i,
            name: formName.trim(),
            quantity: formQty.trim(),
            unit: formUnit.trim(),
            unitOptions: formUnitOptions,
            price: formPrice.trim(),
          }
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
          const items = snap.items.filter((i) => i.id !== editingItemId);
          void commitOrFinishList(snap, items);
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
    await startSpeech((t) => {
      const parsed = extractUnitFromText(t);
      setFormName(toTitleCaseWords(parsed.cleanedName || t));
      if (parsed.unit) setFormUnit(parsed.unit);
    });
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
      "1) Say the QUANTITY first, then the item name.\n2) Say AND before the next item.\n\nExample: “one milk 1L and two eggs and one coffee 25g and three apples”\n\nTap the mic to start, tap again when finished. Bulk lines don’t get spoken prices—use Item Price and edit if needed."
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

  const scanSmartLines = useMemo(() => {
    const lines = scanRawText.split(/\r?\n/);
    let offset = 0;
    return lines.map((line, idx) => {
      const tokens = tokenizeScanText(line).map((tok) =>
        tok.type === "word"
          ? { ...tok, start: tok.start + offset, end: tok.end + offset }
          : { ...tok, start: tok.start + offset, end: tok.end + offset }
      );
      offset += line.length;
      // Count newline separator for every line except the last.
      if (idx < lines.length - 1) offset += 1;
      return { key: `scan-line-${idx}`, tokens };
    });
  }, [scanRawText]);

  const openScanModal = () => {
    stopSpeech();
    setScanModalVisible(true);
  };

  const closeScanModal = () => {
    setScanModalVisible(false);
  };

  const onScanBackdropPress = () => {
    console.log("[scan] backdrop pressed", { scanModalVisible });
    closeScanModal();
  };

  const onScanCameraPress = async () => {
    console.log("[scan] camera button pressed", { scanModalVisible });
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
    console.log("[scan] upload button pressed", { scanModalVisible });
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
    console.log("[scan] modal visibility changed", { scanModalVisible });
  }, [scanModalVisible]);

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
  }, [scanModalVisible]);

  const processScanAsset = async (asset: ImagePickerAsset) => {
    console.log("[scan] processScanAsset start", {
      hasUri: Boolean(asset?.uri),
      hasBase64: Boolean(asset?.base64),
    });
    setScanImageUri(asset.uri);
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
        Alert.alert("No text found", "OCR could not read text. You can edit/paste text manually below.");
      }
    } catch (e) {
      setScanRawText("");
      setScanHintText("Could not detect text from this image.");
      Alert.alert(
        "OCR unavailable",
        e instanceof Error
          ? `${e.message}\n\nYou can still paste/edit text manually and import.`
          : "Could not read text from image."
      );
    } finally {
      setScanLoading(false);
      setScanLoadingLabel("");
    }
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
        Alert.alert("Camera permission needed", "Please allow camera access to scan handwritten lists.");
        return null;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.9,
        base64: true,
        exif: false,
      });
      console.log("[scan] camera result", {
        canceled: result.canceled,
        assets: result.assets?.length ?? 0,
        hasUri: Boolean(result.assets?.[0]?.uri),
        hasBase64: Boolean(result.assets?.[0]?.base64),
      });
      if (SCAN_DEBUG_PICKER_ALERTS) {
        Alert.alert(
          "Camera result",
          `canceled=${String(result.canceled)}\nassets=${result.assets?.length ?? 0}\nuri=${String(
            Boolean(result.assets?.[0]?.uri)
          )}\nbase64=${String(Boolean(result.assets?.[0]?.base64))}`
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
        Alert.alert("Photos permission needed", "Please allow photo access to upload a list image.");
        return null;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        quality: 0.9,
        base64: true,
        allowsMultipleSelection: false,
        exif: false,
      });
      console.log("[scan] upload result", {
        canceled: result.canceled,
        assets: result.assets?.length ?? 0,
        hasUri: Boolean(result.assets?.[0]?.uri),
        hasBase64: Boolean(result.assets?.[0]?.base64),
      });
      if (SCAN_DEBUG_PICKER_ALERTS) {
        Alert.alert(
          "Upload result",
          `canceled=${String(result.canceled)}\nassets=${result.assets?.length ?? 0}\nuri=${String(
            Boolean(result.assets?.[0]?.uri)
          )}\nbase64=${String(Boolean(result.assets?.[0]?.base64))}`
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

  const importScannedText = async () => {
    const snap = listRef.current;
    if (!snap) return;
    const parsed = parseScannedListLocal(scanRawText);
    if (parsed.length === 0) {
      Alert.alert(
        "Nothing to import",
        "No valid items found. Try a clearer image or edit the extracted text first."
      );
      return;
    }
    setScanLoading(true);
    const { active } = splitActiveAndCompleted(snap.items);
    let nextOrder = active.reduce((m, i) => Math.max(m, i.order), -1) + 1;
    try {
      const trusted = await Promise.all(
        parsed.map(async (p) => {
          const resolved = await resolveTrustedProductName(p.name);
          return {
            ...p,
            name: resolved.name || p.name,
            unitOptions: resolved.unitOptions.length ? resolved.unitOptions : p.unitOptions,
          };
        })
      );
      const newItems: GroceryItem[] = trusted.map((p) => ({
        id: generateId(),
        name: toTitleCaseWords(p.name),
        quantity: p.quantity,
        unit: p.unit,
        unitOptions: p.unitOptions,
        price: p.price,
        checked: false,
        order: nextOrder++,
      }));
      pushList({ ...snap, items: dedupeItemsByName([...snap.items, ...newItems]) });
      setScanImageUri("");
      setScanRawText("");
      setScanHintText("");
      setScanRawEditMode(false);
      setScanWordSuggest(null);
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
          unit: p.unit,
          unitOptions: p.unitOptions,
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
            showPriceInForm ? styles.qtyStepperShellCompact : styles.qtyStepperShellNarrow,
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
        ) : (
          <View style={styles.unitInlineWrap}>
            {formUnitOptions.length > 1 ? (
              <TouchableOpacity
                style={styles.unitSelectBtn}
                onPress={() => setUnitMenuVisible(true)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Select unit"
              >
                <Text style={styles.unitSelectText}>{formUnit || "Select unit"}</Text>
                <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            ) : (
              <TextInput
                value={formUnit}
                onChangeText={setFormUnit}
                style={styles.unitInput}
                placeholder="Unit"
                placeholderTextColor={colors.placeholder}
              />
            )}
          </View>
        )}
      </View>
      {showPriceInForm ? (
        <View style={styles.submitRowCompact}>
          <View style={styles.submitRowUnitWrap}>
            {formUnitOptions.length > 1 ? (
              <TouchableOpacity
                style={styles.unitSelectBtnCompact}
                onPress={() => setUnitMenuVisible(true)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Select unit"
              >
                <Text style={styles.unitSelectText}>{formUnit || "Unit"}</Text>
                <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            ) : (
              <TextInput
                value={formUnit}
                onChangeText={setFormUnit}
                style={styles.unitInputCompact}
                placeholder="Unit"
                placeholderTextColor={colors.placeholder}
              />
            )}
          </View>
          {isEdit ? (
            <TouchableOpacity style={styles.saveBtnCompact} onPress={onSaveEdit}>
              <Ionicons name="save-outline" size={18} color="#fff" />
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.addBtnCompact} onPress={onSaveAdd}>
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <Text style={styles.addBtnText}>Add Item</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <>
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
        </>
      )}
    </View>
  );

  const renderRow = (
    item: GroceryItem,
    opts: { drag?: () => void; isActive?: boolean; draggable: boolean }
  ) => {
    const displayUnit =
      (item.unit ?? "").trim() || (item.unitOptions?.find((u) => (u ?? "").trim()) ?? "").trim();
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
            <Ionicons name="ellipsis-vertical" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        ) : (
          <View style={[styles.handle, { opacity: 0.35 }]}>
            <Ionicons name="ellipsis-vertical" size={18} color={colors.borderMuted} />
          </View>
        )}

        <View style={styles.rowTap} pointerEvents="none">
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
              numberOfLines={1}
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
        </View>

        <View style={styles.actionCol} pointerEvents="box-none">
          {displayUnit ? (
            <View pointerEvents="none" style={styles.unitBeforeStarWrap}>
              <Text
                style={[styles.unitBeforeStarText, rowMuted && styles.strikeText]}
                numberOfLines={1}
              >
                {displayUnit}
              </Text>
            </View>
          ) : null}
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
        {!bulkMode ? (
          <Pressable
            style={styles.rowCardTapOverlay}
            onPress={() => openEditModal(item)}
            onLongPress={() => enterBulkMode(item.id)}
            delayLongPress={650}
            accessibilityRole="button"
            accessibilityLabel="Edit item"
          />
        ) : null}
      </Animated.View>
    );
  };

  const renderDraggable = ({ item, drag, isActive }: RenderItemParams<GroceryItem>) => (
    <ScaleDecorator>{renderRow(item, { drag, isActive, draggable: true })}</ScaleDecorator>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.debugVersionLabel}>{UI_DEBUG_VERSION}</Text>
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
                <View key={item.id} style={{ width: "100%" }}>
                  {renderRow(item, { draggable: false })}
                </View>
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
            style={styles.fabScanBtn}
            onPress={openScanModal}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel="Scan list from image"
          >
            <Ionicons name="scan-outline" size={22} color={colors.primary} />
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
              Say quantity first, then name. Separate items with AND.
            </Text>

            <View style={styles.bulkFormatCard}>
              <Text style={styles.bulkFormatLine}>“one milk 1L and two eggs and one coffee 25g”</Text>
              <Text style={styles.bulkFormatSub}>and</Text>
              <Text style={styles.bulkFormatLine}>“3 bread and 1 butter 225g and 2 coke 500ml”</Text>
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
        <View style={styles.bulkModalRoot}>
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
            <View style={styles.bulkModalHeader}>
              <View style={styles.bulkHeaderPill}>
                <Ionicons name="scan-outline" size={14} color={colors.primaryDark} />
                <Text style={styles.bulkHeaderPillText}>Scan list</Text>
              </View>
              <TouchableOpacity
                onPress={closeScanModal}
                style={styles.bulkHeaderIconBtn}
                accessibilityRole="button"
                accessibilityLabel="Close scan modal"
              >
                <Ionicons name="close" size={22} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.scanVersionLabel}>{UI_DEBUG_VERSION}</Text>
            {!scanImageUri ? (
              <>
                <Text style={styles.bulkModalTitle}>Capture or Upload List</Text>
                <Text style={styles.bulkModalHint}>
                  Take a photo of your paper list, then review/edit text before importing.
                </Text>
                {scanHintText ? <Text style={styles.scanMetaText}>{scanHintText}</Text> : null}
              </>
            ) : null}
            {scanLoading ? (
              <View style={styles.scanLoadingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.scanLoadingText}>{scanLoadingLabel || "Preparing your items..."}</Text>
              </View>
            ) : null}
            <View style={styles.scanActionRow}>
              <TouchableOpacity style={styles.scanActionBtnScan} onPress={() => void onScanCameraPress()}>
                <Ionicons name="scan-outline" size={18} color={colors.primary} />
                <Text style={styles.scanActionBtnScanText}>Scan</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.scanActionBtn} onPress={() => void onScanUploadPress()}>
                <Ionicons name="images-outline" size={18} color={colors.primaryDark} />
                <Text style={styles.scanActionBtnText}>Upload</Text>
              </TouchableOpacity>
            </View>
            {scanImageUri ? (
              <View style={styles.scanPreviewWrap}>
                <Image source={{ uri: scanImageUri }} style={styles.scanPreviewImage} resizeMode="cover" />
                <Text style={styles.scanMetaText} numberOfLines={1}>
                  Selected image attached
                </Text>
              </View>
            ) : null}
            <View style={styles.scanTextModeRow}>
              <TouchableOpacity
                style={styles.scanTextModeBtn}
                onPress={() => {
                  setScanWordSuggest(null);
                  setScanRawEditMode((v) => !v);
                }}
                accessibilityRole="button"
                accessibilityLabel={scanRawEditMode ? "Switch to smart review" : "Edit raw OCR text"}
              >
                <Text style={styles.scanTextModeBtnText}>
                  {scanRawEditMode ? "Smart review" : "Edit raw text"}
                </Text>
              </TouchableOpacity>
            </View>
            {scanRawEditMode ? (
              <TextInput
                value={scanRawText}
                onChangeText={(t) => {
                  setScanRawText(t);
                  setScanWordSuggest(null);
                }}
                multiline
                textAlignVertical="top"
                style={styles.scanTextInput}
                placeholder="OCR text appears here. You can edit/paste lines before import."
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
            ) : (
              <ScrollView
                style={styles.scanTokenScroll}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.scanTokenWrap}>
                  {scanSmartLines.every((line) => line.tokens.length === 0) ? (
                    <Text style={styles.scanMetaText}>
                      No text yet. Capture a photo or switch to Edit raw text.
                    </Text>
                  ) : (
                    scanSmartLines.map((line, lineIndex) => (
                      <View key={line.key} style={styles.scanTokenLine}>
                        {line.tokens.map((tok, idx) => {
                          if (tok.type === "sep") {
                            return (
                              <Text key={`sep-${tok.start}-${idx}`} style={styles.scanTokenSep} selectable>
                                {tok.text}
                              </Text>
                            );
                          }
                          const flagged = shouldFlagOcrWord(tok.text);
                          if (flagged) {
                            return (
                              <Pressable
                                key={`w-${tok.start}-${idx}`}
                                onPress={() => {
                                  const suggestions = suggestOcrWordCorrections(tok.text);
                                  setScanWordSuggest({
                                    start: tok.start,
                                    end: tok.end,
                                    original: tok.text,
                                    suggestions,
                                  });
                                }}
                                accessibilityRole="button"
                                accessibilityLabel={`Suggestions for ${tok.text}`}
                              >
                                <Text style={[styles.scanTokenWord, styles.scanTokenWordFlagged]} selectable>
                                  {tok.text}
                                </Text>
                              </Pressable>
                            );
                          }
                          return (
                            <Text key={`w-${tok.start}-${idx}`} style={styles.scanTokenWord} selectable>
                              {tok.text}
                            </Text>
                          );
                        })}
                        {lineIndex < scanSmartLines.length - 1 ? <Text style={styles.scanTokenSep}>{"\n"}</Text> : null}
                      </View>
                    ))
                  )}
                </View>
              </ScrollView>
            )}
            {scanWordSuggest ? (
              <View style={styles.scanSuggestSheet}>
                <Text style={styles.scanSuggestTitle} numberOfLines={2}>
                  Replace “{scanWordSuggest.original}”
                </Text>
                {scanWordSuggest.suggestions.length === 0 ? (
                  <Text style={styles.scanSuggestHint}>
                    No auto-suggestions for this token. Use Edit raw text to fix it, or import and edit the
                    item later.
                  </Text>
                ) : (
                  <View style={styles.scanSuggestChips}>
                    {scanWordSuggest.suggestions.map((s) => (
                      <TouchableOpacity
                        key={s}
                        style={styles.scanSuggestChip}
                        onPress={() => {
                          setScanRawText(
                            replaceScanTextRange(
                              scanRawText,
                              scanWordSuggest.start,
                              scanWordSuggest.end,
                              s
                            )
                          );
                          setScanWordSuggest(null);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Replace with ${s}`}
                      >
                        <Text style={styles.scanSuggestChipText}>{s}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <TouchableOpacity
                  style={styles.scanSuggestDismiss}
                  onPress={() => setScanWordSuggest(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss suggestions"
                >
                  <Text style={styles.scanSuggestDismissText}>Dismiss</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {scanLoading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
            <TouchableOpacity
              style={[styles.addBtn, scanLoading && { opacity: 0.6 }]}
              onPress={importScannedText}
              disabled={scanLoading}
            >
              <Ionicons name="download-outline" size={20} color="#fff" />
              <Text style={styles.addBtnText}>Import Items</Text>
            </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
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
      <Modal
        visible={unitMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setUnitMenuVisible(false)}
      >
        <View style={styles.currencyModalRoot}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setUnitMenuVisible(false)} />
          <View style={[styles.currencyListCard, { paddingBottom: insets.bottom + 12 }]}>
            <Text style={styles.currencyListTitle}>Select unit</Text>
            <Text style={styles.currencyListHint}>Available for this item</Text>
            <FlatList
              data={formUnitOptions}
              keyExtractor={(u) => u}
              style={styles.currencyFlatList}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item: u }) => (
                <TouchableOpacity
                  style={[styles.currencyListRow, u === formUnit && styles.currencyListRowActive]}
                  onPress={() => {
                    setFormUnit(u);
                    setUnitMenuVisible(false);
                  }}
                >
                  <Text style={styles.unitOptionText}>{u}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

