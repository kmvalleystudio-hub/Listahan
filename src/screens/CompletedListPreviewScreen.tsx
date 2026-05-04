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
import type { GroceryItem } from "../types";
import { DEFAULT_CURRENCY_SYMBOL } from "../constants/currency";
import { formatMoney, lineTotal, totalFromItems } from "../utils/money";

export default function CompletedListPreviewScreen({ navigation, route }: CompletedListPreviewProps) {
  const insets = useSafeAreaInsets();
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
          <Ionicons name="chevron-back" size={22} color="#0f172a" />
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
        <Text style={styles.hint}>Read-only snapshot — use the button below to start a new list from this.</Text>

        <View style={styles.itemsCard}>
          {sortedItems.map((item) => (
            <PreviewRow key={item.id} item={item} showPrice={showPrice} sym={sym} />
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={styles.primaryBtn} onPress={openCreateModal} activeOpacity={0.9}>
          <Ionicons name="duplicate-outline" size={22} color="#fff" />
          <Text style={styles.primaryBtnText}>Create new list using this</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={pickerOpen} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Name your new list</Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              style={styles.modalInput}
              placeholder="List name"
              placeholderTextColor="#94a3b8"
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

function PreviewRow({
  item,
  showPrice,
  sym,
}: {
  item: GroceryItem;
  showPrice: boolean;
  sym: string;
}) {
  const qty = item.quantity?.trim() || "—";
  const lt = lineTotal(item.price, item.quantity);
  return (
    <View style={styles.row}>
      <View style={styles.rowBody}>
        <Text style={styles.rowName}>{item.name}</Text>
        <Text style={styles.rowSub}>
          Qty {qty}
          {showPrice ? (
            <>
              {" · "}
              {item.price ? `${sym}${item.price}` : "—"}
              {" · Tot "}
              {formatMoney(lt, sym)}
            </>
          ) : null}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f4f6f8",
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
    color: "#0f172a",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
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
    color: "#0f172a",
  },
  listMeta: {
    marginTop: 6,
    fontSize: 14,
    color: "#64748b",
  },
  hint: {
    marginTop: 10,
    fontSize: 13,
    color: "#94a3b8",
    lineHeight: 18,
  },
  itemsCard: {
    marginTop: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  rowBody: {
    gap: 4,
  },
  rowName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  rowSub: {
    fontSize: 14,
    color: "#64748b",
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: "#f4f6f8",
  },
  primaryBtn: {
    backgroundColor: "#2563eb",
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
    backgroundColor: "rgba(15,23,42,0.35)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#0f172a",
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
    color: "#64748b",
  },
  modalPrimary: {
    backgroundColor: "#2563eb",
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
