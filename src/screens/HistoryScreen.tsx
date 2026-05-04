import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { HistoryProps } from "../navigation/types";
import { useAppData } from "../context/AppDataContext";
import type { HistoryEntry } from "../types";
import { DEFAULT_CURRENCY_SYMBOL } from "../constants/currency";
import { formatMoney, totalFromItems } from "../utils/money";

export default function HistoryScreen({ navigation }: HistoryProps) {
  const insets = useSafeAreaInsets();
  const { history, createListFromHistory } = useAppData();
  const [picker, setPicker] = useState<HistoryEntry | null>(null);
  const [newName, setNewName] = useState("");

  const openPicker = (h: HistoryEntry) => {
    setNewName(`Copy of ${h.name}`);
    setPicker(h);
  };

  const confirmCopy = async () => {
    if (!picker) return;
    const list = await createListFromHistory(picker.id, newName);
    setPicker(null);
    if (list) navigation.navigate("ListDetail", { listId: list.id });
  };

  const renderItem = ({ item }: { item: HistoryEntry }) => {
    const sym = item.currencySymbol?.trim() || DEFAULT_CURRENCY_SYMBOL;
    const listTotal = totalFromItems(item.items);
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.92}
        onPress={() => navigation.navigate("CompletedListPreview", { historyId: item.id })}
      >
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.cardMeta}>
              {new Date(item.updatedAt).toLocaleString()} · {item.items.length} items
              {item.showItemPrice ? ` · Total ${formatMoney(listTotal, sym)}` : ""}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.copyBtn} onPress={() => openPicker(item)}>
          <Ionicons name="duplicate-outline" size={18} color="#1d4ed8" />
          <Text style={styles.copyBtnText}>Create new list using this</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color="#0f172a" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Completed lists</Text>
        <View style={{ width: 72 }} />
      </View>

      <FlatList
        data={history}
        keyExtractor={(h) => h.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 24 },
        ]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="file-tray-outline" size={44} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No completed lists yet</Text>
            <Text style={styles.emptyText}>
              When you check off every item on a list, it moves here. You can start a new list from any
              snapshot.
            </Text>
          </View>
        }
      />

      <Modal visible={!!picker} transparent animationType="fade">
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
              <TouchableOpacity style={styles.modalGhost} onPress={() => setPicker(null)}>
                <Text style={styles.modalGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalPrimary} onPress={confirmCopy}>
                <Text style={styles.modalPrimaryText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#0f172a",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    gap: 12,
  },
  cardTop: {
    flexDirection: "row",
    gap: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
  },
  cardMeta: {
    marginTop: 6,
    fontSize: 13,
    color: "#94a3b8",
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#eff6ff",
    borderRadius: 14,
    paddingVertical: 14,
  },
  copyBtnText: {
    color: "#1d4ed8",
    fontWeight: "700",
    fontSize: 15,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 16,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 17,
    fontWeight: "700",
    color: "#64748b",
  },
  emptyText: {
    marginTop: 6,
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
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
