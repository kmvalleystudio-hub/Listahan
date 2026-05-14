import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { ShareImportProps } from "../navigation/types";
import { useAppData } from "../context/AppDataContext";
import { useToolTheme } from "../hooks/useToolTheme";
import type { AppThemeColors } from "../theme/colors";
import { isSupabaseConfigured } from "../services/supabaseClient";
import { fetchShareExport } from "../services/shareExportCloud";
import { extractShareUuidFromText, groceryListFromSharePayload } from "../utils/grocerySharePayload";
import { todoListFromSharePayload } from "../utils/todoSharePayload";
import { savedReminderFromSharePayload } from "../utils/reminderSharePayload";
import { parseShareEnvelope, type ParsedShareEnvelope } from "../utils/shareEnvelope";
import { scanQrDataStringsFromImage } from "../utils/groceryImportQrScan";
import { requestReminderNotificationPermission, scheduleReminderNotification } from "../utils/reminderNotifications";
import { upsertReminder } from "../utils/remindersStorage";

function QrScanBracketIcon({ color, frameSize = 36 }: { color: string; frameSize?: number }) {
  const qrSize = Math.round(frameSize * 0.36);
  return (
    <View style={{ width: frameSize, height: frameSize, justifyContent: "center", alignItems: "center" }}>
      <Ionicons
        name="scan-outline"
        size={Math.round(frameSize * 1.08)}
        color={color}
        style={{ position: "absolute", opacity: 0.38 }}
      />
      <Ionicons name="qr-code" size={qrSize} color={color} />
    </View>
  );
}

function errorMessageFromUnknown(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === "object" && e !== null && "message" in e && typeof (e as { message: string }).message === "string") {
    return (e as { message: string }).message;
  }
  return fallback;
}

type ShareImportExpectTool = "grocery" | "todo" | "reminder";

function importScreenContextLabel(t: ShareImportExpectTool): string {
  switch (t) {
    case "grocery":
      return "Groceries";
    case "todo":
      return "To-dos";
    case "reminder":
      return "Reminders";
  }
}

function sharePayloadKindPhrase(t: ShareImportExpectTool): string {
  switch (t) {
    case "grocery":
      return "a grocery list";
    case "todo":
      return "a to-do list";
    case "reminder":
      return "a reminder";
  }
}

/** If user opened import from a tool screen but the code is another kind, confirm before importing. */
function confirmImportContextMismatch(
  expecting: ShareImportExpectTool | undefined,
  parsed: ParsedShareEnvelope
): Promise<boolean> {
  if (!expecting || expecting === parsed.tool) return Promise.resolve(true);
  return new Promise((resolve) => {
    Alert.alert(
      "Different kind of share",
      `You opened import from ${importScreenContextLabel(expecting)}, but this code is for ${sharePayloadKindPhrase(parsed.tool)}. SayCart will still import it in the right place.`,
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: "Continue", onPress: () => resolve(true) },
      ]
    );
  });
}

function createStyles(c: AppThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      paddingBottom: 8,
    },
    back: { flexDirection: "row", alignItems: "center", padding: 8, width: 88 },
    backText: { fontSize: 16, fontWeight: "600", color: c.linkBlue },
    headerTitle: { fontSize: 18, fontWeight: "800", color: c.text, flex: 1, textAlign: "center" },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingBottom: 32, gap: 18 },
    hint: { fontSize: 14, color: c.placeholder, lineHeight: 20 },
    sectionTitle: { fontSize: 13, fontWeight: "800", color: c.textTertiary, letterSpacing: 0.5 },
    card: {
      backgroundColor: c.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      gap: 12,
    },
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
    shareCodeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    shareCodeInput: {
      flex: 1,
      minWidth: 0,
      minHeight: 48,
      maxHeight: 120,
    },
    shareImportInlineBtn: {
      flexShrink: 0,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: c.primary,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      minHeight: 48,
      minWidth: 92,
    },
    shareImportInlineBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
    ghostBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.inputBg,
    },
    ghostBtnText: { fontSize: 15, fontWeight: "700", color: c.text },
    qrActionsRow: { flexDirection: "row", gap: 10 },
    qrActionIconBtn: {
      flex: 1,
      minHeight: 56,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.inputBg,
      justifyContent: "center",
      alignItems: "center",
    },
    cameraBox: { height: 280, borderRadius: 14, overflow: "hidden", backgroundColor: "#000" },
    muted: { fontSize: 13, color: c.textTertiary },
  });
}

export default function ShareImportScreen({ navigation, route }: ShareImportProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useToolTheme("grocery");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { createList, upsertList, createTodoList, upsertTodoList } = useAppData();

  const [paste, setPaste] = useState("");
  const [loading, setLoading] = useState(false);
  const [qrImageBusy, setQrImageBusy] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);

  const applyEnvelope = useCallback(
    async (parsed: ParsedShareEnvelope, importOpenedWithExpecting?: ShareImportExpectTool) => {
      const crossToolImport =
        importOpenedWithExpecting !== undefined && importOpenedWithExpecting !== parsed.tool;

      switch (parsed.tool) {
        case "grocery": {
          const base = await createList(parsed.payload.list.name);
          const next = groceryListFromSharePayload(base, parsed.payload);
          await upsertList(next);
          if (crossToolImport) {
            navigation.reset({
              index: 2,
              routes: [
                { name: "ToolsDashboard" },
                { name: "GroceryHome" },
                { name: "ListDetail", params: { listId: next.id } },
              ],
            });
          } else {
            navigation.replace("ListDetail", { listId: next.id });
          }
          break;
        }
        case "todo": {
          const base = await createTodoList(parsed.payload.list.name);
          const next = todoListFromSharePayload(base, parsed.payload);
          await upsertTodoList(next);
          if (crossToolImport) {
            navigation.reset({
              index: 2,
              routes: [
                { name: "ToolsDashboard" },
                { name: "TodoHome" },
                { name: "TodoListDetail", params: { listId: next.id } },
              ],
            });
          } else {
            navigation.replace("TodoListDetail", { listId: next.id });
          }
          break;
        }
        case "reminder": {
          if (Platform.OS === "web") {
            Alert.alert("Reminders", "Importing shared reminders is available in the iOS/Android app.");
            return;
          }
          const draft = savedReminderFromSharePayload(parsed.payload);
          const granted = await requestReminderNotificationPermission();
          let notificationId: string | null = null;
          let earlyNotificationId: string | null = null;
          if (granted) {
            const rowForSchedule = { ...draft, notificationId: null, earlyNotificationId: null };
            const ids = await scheduleReminderNotification(rowForSchedule);
            notificationId = ids.notificationId;
            earlyNotificationId = ids.earlyNotificationId;
          } else {
            Alert.alert("Notifications", "Allow notifications for SayCart to schedule this reminder’s alerts.");
          }
          const row = {
            ...draft,
            notificationId,
            earlyNotificationId,
            updatedAt: new Date().toISOString(),
          };
          await upsertReminder(row);
          if (crossToolImport) {
            navigation.reset({
              index: 2,
              routes: [
                { name: "ToolsDashboard" },
                { name: "ReminderHome" },
                { name: "ReminderEditor", params: { reminderId: row.id } },
              ],
            });
          } else {
            navigation.replace("ReminderEditor", { reminderId: row.id });
          }
          break;
        }
        default:
          break;
      }
    },
    [createList, createTodoList, navigation, upsertList, upsertTodoList]
  );

  const loadAndApply = useCallback(
    async (uuid: string) => {
      const raw = await fetchShareExport(uuid);
      const parsed = parseShareEnvelope(raw);
      if (!parsed) {
        Alert.alert("Import", "This code is not a SayCart share, or the data is unreadable.");
        return false;
      }
      const ok = await confirmImportContextMismatch(route.params?.expectingTool, parsed);
      if (!ok) return false;
      await applyEnvelope(parsed, route.params?.expectingTool);
      return true;
    },
    [applyEnvelope, route.params?.expectingTool]
  );

  const onImportPaste = useCallback(async () => {
    const uuid = extractShareUuidFromText(paste);
    if (!uuid) {
      Alert.alert(
        "Import",
        "Enter the share code from the other person, or a message/link that contains it. You can also scan or upload a QR."
      );
      return;
    }
    if (!isSupabaseConfigured()) {
      Alert.alert("Import", "Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to import from a share code.");
      return;
    }
    setLoading(true);
    try {
      const ok = await loadAndApply(uuid);
      if (!ok) return;
    } catch (e) {
      Alert.alert("Import", errorMessageFromUnknown(e, "Could not load this share."));
    } finally {
      setLoading(false);
    }
  }, [loadAndApply, paste]);

  const importFromScannedData = useCallback(
    async (data: string): Promise<boolean> => {
      const uuid = extractShareUuidFromText(data);
      if (!uuid) {
        Alert.alert("Import", "Could not find a share code in this QR.");
        return false;
      }
      if (!isSupabaseConfigured()) {
        Alert.alert("Import", "Cloud import needs Supabase env configuration.");
        return false;
      }
      setLoading(true);
      try {
        return await loadAndApply(uuid);
      } catch (err) {
        Alert.alert("Import", errorMessageFromUnknown(err, "Import failed."));
        return false;
      } finally {
        setLoading(false);
      }
    },
    [loadAndApply]
  );

  const onBarcodeScanned = useCallback(
    (e: { data: string }) => {
      if (scannedRef.current) return;
      const uuid = extractShareUuidFromText(e.data);
      if (!uuid) return;
      scannedRef.current = true;
      setScanOpen(false);
      setPaste(uuid);
      void importFromScannedData(e.data).then((ok) => {
        if (!ok) scannedRef.current = false;
      });
    },
    [importFromScannedData]
  );

  const onUploadQrFromLibrary = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Photos", "Allow photo library access to import a QR from an image.");
      return;
    }
    setQrImageBusy(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: false,
        quality: 1,
      });
      if (result.canceled || !result.assets[0]?.uri) return;
      const uri = result.assets[0].uri;
      const payloads = await scanQrDataStringsFromImage(uri);
      if (!payloads.length) {
        Alert.alert(
          "Import",
          "No QR code was found in that image. Try a brighter screenshot, zoom in so the QR fills more of the frame, or use the camera scanner."
        );
        return;
      }
      for (const data of payloads) {
        const uuid = extractShareUuidFromText(data);
        if (!uuid) continue;
        setPaste(uuid);
        const ok = await importFromScannedData(data);
        if (ok) return;
      }
      Alert.alert(
        "Import",
        "That image has QR codes, but none look like a SayCart share link or code. Try the share screen’s Download QR export, or paste the share code."
      );
    } catch (e) {
      Alert.alert("Import", e instanceof Error ? e.message : "Could not read that image.");
    } finally {
      setQrImageBusy(false);
    }
  }, [importFromScannedData]);

  const openScanner = useCallback(async () => {
    if (!permission?.granted) {
      const r = await requestPermission();
      if (!r.granted) {
        Alert.alert("Camera", "Camera access is needed to scan a QR code.");
        return;
      }
    }
    scannedRef.current = false;
    setScanOpen(true);
  }, [permission, requestPermission]);

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.linkBlue} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Import shared</Text>
        <View style={{ width: 88 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.hint}>
          Paste a share code (grocery list, to-do list, or reminder), scan the QR with the camera, or pick a photo or
          screenshot that contains the QR. SayCart opens the right tool automatically.
        </Text>

        <View>
          <Text style={styles.sectionTitle}>SHARE CODE</Text>
          <View style={[styles.card, { marginTop: 8 }]}>
            <View style={styles.shareCodeRow}>
              <TextInput
                style={[styles.input, styles.shareCodeInput]}
                value={paste}
                onChangeText={setPaste}
                placeholder="Share code or link"
                placeholderTextColor={colors.placeholder}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.shareImportInlineBtn}
                onPress={() => void onImportPaste()}
                disabled={loading || !paste.trim()}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel="Import from share code"
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.shareImportInlineBtnText}>Import</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View>
          <Text style={styles.sectionTitle}>SCAN OR UPLOAD QR</Text>
          <View style={[styles.card, { marginTop: 8 }]}>
            <Text style={styles.muted}>
              Scan live with the camera, or pick a photo or screenshot of the QR from your gallery.
            </Text>
            {!scanOpen ? (
              <View style={styles.qrActionsRow}>
                <TouchableOpacity
                  style={styles.qrActionIconBtn}
                  onPress={() => void openScanner()}
                  accessibilityRole="button"
                  accessibilityLabel="Open camera scanner"
                >
                  <QrScanBracketIcon color={colors.text} frameSize={36} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.qrActionIconBtn}
                  onPress={() => void onUploadQrFromLibrary()}
                  disabled={loading || qrImageBusy}
                  accessibilityRole="button"
                  accessibilityLabel="Upload QR image from photos"
                >
                  {qrImageBusy ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <Ionicons name="image-outline" size={36} color={colors.text} />
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.cameraBox}>
                <CameraView
                  style={{ flex: 1 }}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                  onBarcodeScanned={onBarcodeScanned}
                />
                <TouchableOpacity
                  style={[styles.ghostBtn, { borderWidth: 0, borderRadius: 0 }]}
                  onPress={() => {
                    setScanOpen(false);
                    scannedRef.current = false;
                  }}
                >
                  <Text style={styles.ghostBtnText}>Close scanner</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
