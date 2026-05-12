import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { CompletedListPreviewProps } from "../navigation/types";
import { useAppData } from "../context/AppDataContext";
import { useToolTheme } from "../hooks/useToolTheme";
import type { AppThemeColors } from "../theme/colors";
import type { GroceryItem } from "../types";
import { DEFAULT_CURRENCY_SYMBOL } from "../constants/currency";
import { formatMoney, lineTotal, totalFromItems } from "../utils/money";

function createPreviewStyles(c: AppThemeColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      paddingBottom: 8,
    },
    back: {
      flexDirection: "row",
      alignItems: "center",
      padding: 8,
      width: 72,
    },
    backText: {
      fontSize: 16,
      fontWeight: "600",
      color: c.text,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: c.text,
      flex: 1,
      textAlign: "center",
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    listName: {
      fontSize: 22,
      fontWeight: "800",
      color: c.text,
    },
    listMeta: {
      marginTop: 6,
      fontSize: 14,
      color: c.textTertiary,
    },
    hint: {
      marginTop: 10,
      fontSize: 13,
      color: c.placeholder,
      lineHeight: 18,
    },
    itemsCard: {
      marginTop: 16,
      backgroundColor: c.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      overflow: "hidden",
    },
    row: {
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    rowBody: {
      gap: 4,
    },
    rowName: {
      fontSize: 16,
      fontWeight: "700",
      color: c.text,
    },
    rowSub: {
      fontSize: 14,
      color: c.textTertiary,
    },
    footer: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 16,
      paddingTop: 10,
      backgroundColor: c.background,
    },
    primaryBtn: {
      backgroundColor: c.primary,
      borderRadius: 16,
      paddingVertical: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    primaryBtnText: {
      color: "#fff",
      fontSize: 17,
      fontWeight: "700",
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: c.overlayStrong,
      justifyContent: "center",
      padding: 24,
    },
    modalCard: {
      backgroundColor: c.card,
      borderRadius: 18,
      padding: 18,
      gap: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: c.text,
    },
    modalInput: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: c.text,
      backgroundColor: c.inputBg,
    },
    modalRow: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 10,
      marginTop: 4,
    },
    modalGhost: {
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    modalGhostText: {
      fontSize: 16,
      fontWeight: "600",
      color: c.textTertiary,
    },
    modalPrimary: {
      backgroundColor: c.primary,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 18,
    },
    modalPrimaryText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "700",
    },
  });
}

function PreviewRow({
  item,
  showPrice,
  sym,
  styles: s,
}: {
  item: GroceryItem;
  showPrice: boolean;
  sym: string;
  styles: ReturnType<typeof createPreviewStyles>;
}) {
  const qty = item.quantity?.trim() || "—";
  const unit = item.unit?.trim() || "";
  const lt = lineTotal(item.price, item.quantity);
  return (
    <View style={s.row}>
      <View style={s.rowBody}>
        <Text style={s.rowName}>{item.name}</Text>
        <Text style={s.rowSub}>
          Qty {qty}
          {unit ? ` ${unit}` : ""}
          {showPrice ? (
            <>
              {" · "}
              {item.price ? `${sym}${item.price}` : "—"}
              {" · "}
              {formatMoney(lt, sym)}
            </>
          ) : null}
        </Text>
      </View>
    </View>
  );
}

export default function CompletedListPreviewScreen({ navigation, route }: CompletedListPreviewProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useToolTheme("grocery");
  const styles = useMemo(() => createPreviewStyles(colors), [colors]);
  const { historyId } = route.params;
  const { history, createListFromHistory } = useAppData();
  const entry = useMemo(() => history.find((h) => h.id === historyId) ?? null, [history, historyId]);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (!entry) navigation.goBack();
  }, [entry, navigation]);

  const confirmCopy = async () => {
    if (!entry) return;
    const list = await createListFromHistory(entry.id, newName);
    setPickerOpen(false);
    if (list) navigation.replace("ListDetail", { listId: list.id });
  };

  const openCreateModal = () => {
    if (!entry) return;
    setNewName(`Copy of ${entry.name}`);
    setPickerOpen(true);
  };

  if (!entry) return null;

  const sym = entry.currencySymbol?.trim() || DEFAULT_CURRENCY_SYMBOL;
  const showPrice = entry.showItemPrice;
  const sortedItems = [...entry.items].sort((a, b) => a.order - b.order);
  const grandTotal = totalFromItems(entry.items);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Preview
        </Text>
        <View style={{ width: 72 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.listName}>{entry.name}</Text>
        <Text style={styles.listMeta}>
          {new Date(entry.updatedAt).toLocaleString()} · {entry.items.length} items
          {showPrice ? ` · Total ${formatMoney(grandTotal, sym)}` : ""}
        </Text>
        <Text style={styles.hint}>Read-only snapshot — reuse it with the button below.</Text>

        <View style={styles.itemsCard}>
          {sortedItems.map((item) => (
            <PreviewRow key={item.id} item={item} showPrice={showPrice} sym={sym} styles={styles} />
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={styles.primaryBtn} onPress={openCreateModal} activeOpacity={0.9}>
          <Ionicons name="duplicate-outline" size={22} color="#fff" />
          <Text style={styles.primaryBtnText}>Start fresh from this</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={pickerOpen} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Name your groceries</Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              style={styles.modalInput}
              placeholder="e.g. Weekly shop"
              placeholderTextColor={colors.placeholder}
            />
            <View style={styles.modalRow}>
              <TouchableOpacity style={styles.modalGhost} onPress={() => setPickerOpen(false)}>
                <Text style={styles.modalGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalPrimary} onPress={() => void confirmCopy()}>
                <Text style={styles.modalPrimaryText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
