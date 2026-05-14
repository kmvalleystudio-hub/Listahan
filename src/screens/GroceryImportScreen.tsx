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
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { GroceryImportProps } from "../navigation/types";
import { useAppData } from "../context/AppDataContext";
import { useToolTheme } from "../hooks/useToolTheme";
import type { AppThemeColors } from "../theme/colors";
import { isSupabaseConfigured } from "../services/supabaseClient";
import { fetchGroceryShareFromCloud } from "../services/groceryShareCloud";
import {
  extractShareUuidFromText,
  groceryListFromSharePayload,
  type GroceryShareFileV1,
} from "../utils/grocerySharePayload";
import { scanQrDataStringsFromImage } from "../utils/groceryImportQrScan";

function QrScanBracketIcon({ color, frameSize = 44 }: { color: string; frameSize?: number }) {
  const qrSize = Math.round(frameSize * 0.36);
  return (
    <View style={{ width: frameSize, height: frameSize, justifyContent: "center", alignItems: "center" }}>
      <Ionicons name="scan-outline" size={frameSize} color={color} style={{ position: "absolute" }} />
      <Ionicons name="qr-code" size={qrSize} color={color} />
    </View>
  );
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
    primaryBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      backgroundColor: c.primary,
      borderRadius: 14,
      paddingVertical: 14,
    },
    primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
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

export default function GroceryImportScreen({ navigation }: GroceryImportProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useToolTheme("grocery");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { createList, upsertList } = useAppData();

  const [paste, setPaste] = useState("");
  const [loading, setLoading] = useState(false);
  const [qrImageBusy, setQrImageBusy] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);

  const applyParsed = useCallback(
    async (parsed: GroceryShareFileV1) => {
      const base = await createList(parsed.list.name);
      const next = groceryListFromSharePayload(base, parsed);
      await upsertList(next);
      navigation.replace("ListDetail", { listId: next.id });
    },
    [createList, upsertList, navigation]
  );

  const onImportPaste = useCallback(async () => {
    const uuid = extractShareUuidFromText(paste);
    if (!uuid) {
      Alert.alert(
        "Import",
        "Paste the share code from the other person, or a message/link that contains it. You can also scan or upload a QR."
      );
      return;
    }
    if (!isSupabaseConfigured()) {
      Alert.alert("Import", "Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to import from a share code.");
      return;
    }
    setLoading(true);
    try {
      const file = await fetchGroceryShareFromCloud(uuid);
      if (!file) {
        Alert.alert("Import", "No list found for this code, or it has expired.");
        return;
      }
      await applyParsed(file);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load this share.";
      Alert.alert("Import", msg);
    } finally {
      setLoading(false);
    }
  }, [paste, applyParsed]);

  const onPasteFromClipboard = useCallback(async () => {
    const t = await Clipboard.getStringAsync();
    if (!t?.trim()) {
      Alert.alert("Clipboard", "Nothing in the clipboard.");
      return;
    }
    setPaste(t.trim());
  }, []);

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
        const file = await fetchGroceryShareFromCloud(uuid);
        if (!file) {
          Alert.alert("Import", "No list found for this QR, or it has expired.");
          return false;
        }
        await applyParsed(file);
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Import failed.";
        Alert.alert("Import", msg);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [applyParsed]
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
        "That image has QR codes, but none look like a SayCart share link or code. Try the share screen’s “Download” QR, or paste the list code."
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
        <Text style={styles.headerTitle}>Import list</Text>
        <View style={{ width: 88 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.hint}>
          Paste the share code (or a link that contains it), scan the QR with the camera, or choose a photo or
          screenshot that contains the QR.
        </Text>

        <View>
          <Text style={styles.sectionTitle}>SHARE CODE</Text>
          <View style={[styles.card, { marginTop: 8 }]}>
            <TextInput
              style={styles.input}
              value={paste}
              onChangeText={setPaste}
              placeholder="Paste share code or link"
              placeholderTextColor={colors.placeholder}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity style={[styles.ghostBtn, { flex: 1 }]} onPress={() => void onPasteFromClipboard()}>
                <Ionicons name="clipboard-outline" size={20} color={colors.text} />
                <Text style={styles.ghostBtnText}>Paste</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, { flex: 1.2, paddingVertical: 12 }]}
                onPress={() => void onImportPaste()}
                disabled={loading || !paste.trim()}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Import</Text>}
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
                  <QrScanBracketIcon color={colors.text} frameSize={44} />
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
                    <Ionicons name="image-outline" size={28} color={colors.text} />
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
