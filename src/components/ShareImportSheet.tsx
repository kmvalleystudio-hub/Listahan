import React, { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform, Pressable, ScrollView } from "react-native";
import AppTextInput from "./AppTextInput";
import * as ImagePicker from "expo-image-picker";
import { CameraView, useCameraPermissions } from "expo-camera";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { AppThemeColors } from "../theme/colors";
import { APP_DISPLAY_NAME } from "../constants/appBranding";
import { isSupabaseConfigured } from "../services/supabaseClient";
import { fetchShareExport } from "../services/shareExportCloud";
import { extractShareUuidFromText } from "../utils/grocerySharePayload";
import type { GroceryShareFileV1 } from "../utils/grocerySharePayload";
import type { TodoShareFileV1 } from "../utils/todoSharePayload";
import { parseShareEnvelope, type ParsedShareEnvelope } from "../utils/shareEnvelope";
import { scanQrDataStringsFromImage } from "../utils/groceryImportQrScan";

function QrScanBracketIcon({ color, frameSize = 32 }: { color: string; frameSize?: number }) {
  return <Ionicons name="qr-code" size={frameSize} color={color} />;
}

function errorMessageFromUnknown(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  if (
    typeof e === "object" &&
    e !== null &&
    "message" in e &&
    typeof (e as { message: string }).message === "string"
  ) {
    return (e as { message: string }).message;
  }
  return fallback;
}

function createStyles(c: AppThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: c.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 16,
      paddingTop: 12,
      maxHeight: "88%",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    handle: {
      alignSelf: "center",
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.borderMuted,
      marginBottom: 12,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    title: { fontSize: 18, fontWeight: "800", color: c.text, flex: 1 },
    closeBtn: { padding: 6 },
    hint: { fontSize: 14, color: c.textSecondary, lineHeight: 20, marginBottom: 14 },
    sectionTitle: {
      fontSize: 12,
      fontWeight: "800",
      color: c.textTertiary,
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    card: {
      backgroundColor: c.inputBg,
      borderRadius: 14,
      padding: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      gap: 10,
      marginBottom: 16,
    },
    shareCodeRow: { flexDirection: "row", alignItems: "stretch", gap: 10, alignSelf: "stretch" },
    shareCodeField: { flex: 1, minWidth: 0 },
    input: {
      width: "100%",
      minHeight: 48,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: c.text,
      backgroundColor: c.card,
    },
    importBtn: {
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
    importBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
    qrActionsRow: { flexDirection: "row", gap: 10 },
    qrActionBtn: {
      flex: 1,
      minHeight: 52,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.card,
      justifyContent: "center",
      alignItems: "center",
    },
    cameraBox: { height: 240, borderRadius: 12, overflow: "hidden", backgroundColor: "#000" },
    muted: { fontSize: 13, color: c.textTertiary, lineHeight: 18 },
    closeScannerBtn: {
      paddingVertical: 12,
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.55)",
    },
    closeScannerText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  });
}

export type ShareImportSheetTool = "grocery" | "todo";

type ShareImportSheetProps = {
  visible: boolean;
  onClose: () => void;
  tool: ShareImportSheetTool;
  colors: AppThemeColors;
  onImportGrocery: (payload: GroceryShareFileV1) => void | Promise<void>;
  onImportTodo: (payload: TodoShareFileV1) => void | Promise<void>;
};

export default function ShareImportSheet({
  visible,
  onClose,
  tool,
  colors,
  onImportGrocery,
  onImportTodo,
}: ShareImportSheetProps) {
  const styles = createStyles(colors);
  const [paste, setPaste] = useState("");
  const [loading, setLoading] = useState(false);
  const [qrImageBusy, setQrImageBusy] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);

  const resetTransient = useCallback(() => {
    setScanOpen(false);
    scannedRef.current = false;
    setLoading(false);
    setQrImageBusy(false);
  }, []);

  const handleClose = useCallback(() => {
    resetTransient();
    onClose();
  }, [onClose, resetTransient]);

  const applyParsed = useCallback(
    async (parsed: ParsedShareEnvelope) => {
      if (parsed.tool !== tool) {
        const kind =
          parsed.tool === "grocery" ? "a grocery list" : parsed.tool === "todo" ? "a to-do list" : "a reminder";
        Alert.alert(
          "Different kind of share",
          `This code is for ${kind}, not ${tool === "grocery" ? "this grocery list" : "this to-do list"}.`
        );
        return false;
      }
      if (parsed.tool === "grocery") {
        await onImportGrocery(parsed.payload);
      } else {
        await onImportTodo(parsed.payload);
      }
      setPaste("");
      resetTransient();
      onClose();
      return true;
    },
    [onClose, onImportGrocery, onImportTodo, resetTransient, tool]
  );

  const loadAndApply = useCallback(
    async (uuid: string) => {
      const raw = await fetchShareExport(uuid);
      const parsed = parseShareEnvelope(raw);
      if (!parsed) {
        Alert.alert("Import", `This code is not a ${APP_DISPLAY_NAME} share, or the data is unreadable.`);
        return false;
      }
      return applyParsed(parsed);
    },
    [applyParsed]
  );

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
      Alert.alert(
        "Import",
        "Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to import from a share code."
      );
      return;
    }
    setLoading(true);
    try {
      await loadAndApply(uuid);
    } catch (e) {
      Alert.alert("Import", errorMessageFromUnknown(e, "Could not load this share."));
    } finally {
      setLoading(false);
    }
  }, [loadAndApply, paste]);

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
      const payloads = await scanQrDataStringsFromImage(result.assets[0].uri);
      if (!payloads.length) {
        Alert.alert("Import", "No QR code was found in that image. Try a brighter screenshot or zoom in on the QR.");
        return;
      }
      for (const data of payloads) {
        const uuid = extractShareUuidFromText(data);
        if (!uuid) continue;
        setPaste(uuid);
        const ok = await importFromScannedData(data);
        if (ok) return;
      }
      Alert.alert("Import", `That image has QR codes, but none look like a ${APP_DISPLAY_NAME} share.`);
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

  const toolLabel = tool === "grocery" ? "this list" : "this to-do list";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={StyleSheet.absoluteFillObject} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Import with code / QR</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} accessibilityLabel="Close import">
              <Ionicons name="close" size={26} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.hint}>
              Paste a share code or scan a QR to add items to {toolLabel}. You stay on this page.
            </Text>

            <Text style={styles.sectionTitle}>SHARE CODE</Text>
            <View style={styles.card}>
              <View style={styles.shareCodeRow}>
                <View style={styles.shareCodeField}>
                  <AppTextInput
                    style={styles.input}
                    value={paste}
                    onChangeText={setPaste}
                    placeholder="Share code or link"
                    placeholderTextColor={colors.placeholder}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                <TouchableOpacity
                  style={styles.importBtn}
                  onPress={() => void onImportPaste()}
                  disabled={loading || !paste.trim()}
                  activeOpacity={0.88}
                  accessibilityRole="button"
                  accessibilityLabel="Import from share code"
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.importBtnText}>Import</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.sectionTitle}>SCAN OR UPLOAD QR</Text>
            <View style={styles.card}>
              <Text style={styles.muted}>Scan live with the camera, or pick a photo of the QR.</Text>
              {!scanOpen ? (
                <View style={styles.qrActionsRow}>
                  <TouchableOpacity
                    style={styles.qrActionBtn}
                    onPress={() => void openScanner()}
                    accessibilityRole="button"
                    accessibilityLabel="Open camera scanner"
                  >
                    <QrScanBracketIcon color={colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.qrActionBtn}
                    onPress={() => void onUploadQrFromLibrary()}
                    disabled={loading || qrImageBusy}
                    accessibilityRole="button"
                    accessibilityLabel="Upload QR image from photos"
                  >
                    {qrImageBusy ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <Ionicons name="image-outline" size={32} color={colors.text} />
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
                    style={styles.closeScannerBtn}
                    onPress={() => {
                      setScanOpen(false);
                      scannedRef.current = false;
                    }}
                  >
                    <Text style={styles.closeScannerText}>Close scanner</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
