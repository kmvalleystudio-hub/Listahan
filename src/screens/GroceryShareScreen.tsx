import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import type { GroceryShareProps } from "../navigation/types";
import { useAppData } from "../context/AppDataContext";
import { useToolTheme } from "../hooks/useToolTheme";
import type { AppThemeColors } from "../theme/colors";
import { isSupabaseConfigured } from "../services/supabaseClient";
import {
  fetchGroceryShareFromCloud,
  replaceGroceryShareInCloud,
  uploadGroceryShareToCloud,
} from "../services/groceryShareCloud";
import { buildGroceryShareFileFromList } from "../utils/grocerySharePayload";
import { embedQrPngInShareLetterhead } from "../utils/shareQrExportCanvas";

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
    headerSide: { width: 88, flexDirection: "row", alignItems: "center", justifyContent: "flex-end" },
    headerInfoBtn: { padding: 8 },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingBottom: 32, gap: 16 },
    sectionTitle: { fontSize: 13, fontWeight: "800", color: c.textTertiary, letterSpacing: 0.5 },
    card: {
      backgroundColor: c.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      gap: 12,
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
    codeRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.inputBg,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      paddingLeft: 12,
      paddingVertical: 4,
      paddingRight: 4,
      gap: 4,
    },
    codeText: {
      flex: 1,
      minWidth: 0,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 14,
      color: c.text,
      paddingVertical: 8,
    },
    codeCopyBtn: {
      padding: 10,
      borderRadius: 8,
    },
    qrRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      paddingVertical: 8,
    },
    qrDownloadBtn: {
      padding: 10,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.inputBg,
      justifyContent: "center",
      alignItems: "center",
    },
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
    muted: { fontSize: 13, color: c.textTertiary },
  });
}

function shareWebBase(): string | null {
  const b = process.env.EXPO_PUBLIC_GROCERY_SHARE_WEB_BASE;
  if (typeof b !== "string" || !b.trim()) return null;
  return b.replace(/\/+$/, "");
}

function qrValueForShareId(shareId: string): string {
  const base = shareWebBase();
  return base ? `${base}/${shareId}` : shareId;
}

function groceryShareExportStorageKey(listId: string): string {
  return `saycart:groceryShareExport:${listId}`;
}

const SHARE_INFO_TITLE = "About sharing";

/** PostgREST / Supabase errors are often plain objects, not `Error` instances. */
function errorMessageFromUnknown(e: unknown, fallback: string): string {
  if (e == null) return fallback;
  if (e instanceof Error && typeof e.message === "string" && e.message.trim()) {
    return e.message.trim();
  }
  if (typeof e === "object") {
    const o = e as Record<string, unknown>;
    const chunks: string[] = [];
    for (const key of ["message", "details", "hint"] as const) {
      const v = o[key];
      if (typeof v === "string" && v.trim()) chunks.push(v.trim());
    }
    if (typeof o.code === "string" && o.code.trim()) chunks.push(`[${o.code.trim()}]`);
    if (chunks.length) return chunks.join("\n");
  }
  const s = String(e);
  return s === "" || s === "[object Object]" ? fallback : s;
}

function shareInfoBody(): string {
  const lines = [
    "Tap Generate Code to save a snapshot of this list in the cloud. You get a share code and QR that anyone can use to import the list in SayCart. Codes and links work for 7 days.",
    "",
    "After you edit the list, tap “Update cloud snapshot” so imports use your latest items (the code and QR stay the same).",
    "",
    "Recipients: Groceries → Import → paste the code or scan the QR.",
  ];
  return lines.join("\n");
}

type QrSvgHandle = {
  toDataURL: (callback: (data: string) => void, options?: { width?: number; height?: number }) => void;
};

export default function GroceryShareScreen({ navigation, route }: GroceryShareProps) {
  const insets = useSafeAreaInsets();
  const { listId } = route.params;
  const { colors } = useToolTheme("grocery");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { lists } = useAppData();
  const list = useMemo(() => lists.find((l) => l.id === listId) ?? null, [lists, listId]);

  const [uploading, setUploading] = useState(false);
  const [shareId, setShareId] = useState<string | null>(null);
  const [restoringShare, setRestoringShare] = useState(() => isSupabaseConfigured());
  const [savingQr, setSavingQr] = useState(false);
  const [replacingSnapshot, setReplacingSnapshot] = useState(false);
  const qrSvgRef = useRef<QrSvgHandle | null>(null);
  const qrExportSvgRef = useRef<QrSvgHandle | null>(null);

  const payload = useMemo(() => {
    if (!list) return null;
    return buildGroceryShareFileFromList(list, new Date().toISOString());
  }, [list]);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setRestoringShare(false);
      return;
    }
    let cancelled = false;
    const key = groceryShareExportStorageKey(listId);
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(key);
        const id = typeof raw === "string" ? raw.trim() : "";
        if (!id) return;
        const file = await fetchGroceryShareFromCloud(id);
        if (cancelled) return;
        if (file) setShareId(id);
        else await AsyncStorage.removeItem(key);
      } catch {
        // Network or RPC failure: leave share unset; user can generate again.
      }
    })().finally(() => {
      if (!cancelled) setRestoringShare(false);
    });
    return () => {
      cancelled = true;
    };
  }, [listId]);

  const onUploadCloud = useCallback(async () => {
    if (!payload) return;
    if (!isSupabaseConfigured()) {
      Alert.alert(
        "Cloud share",
        "Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your environment, and run the SQL in supabase/migrations in your Supabase project."
      );
      return;
    }
    setUploading(true);
    try {
      const id = await uploadGroceryShareToCloud(payload);
      setShareId(id);
      await AsyncStorage.setItem(groceryShareExportStorageKey(listId), id);
    } catch (e) {
      Alert.alert("Cloud share", errorMessageFromUnknown(e, "Upload failed."));
    } finally {
      setUploading(false);
    }
  }, [listId, payload]);

  const onReplaceSnapshot = useCallback(async () => {
    if (!shareId || !list) return;
    if (!isSupabaseConfigured()) {
      Alert.alert(
        "Cloud share",
        "Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your environment, and run the SQL in supabase/migrations in your Supabase project."
      );
      return;
    }
    const nextPayload = buildGroceryShareFileFromList(list, new Date().toISOString());
    setReplacingSnapshot(true);
    try {
      await replaceGroceryShareInCloud(shareId, nextPayload);
      Alert.alert(
        "Snapshot updated",
        "Your share code and QR are unchanged. Anyone who imports now gets this version of the list."
      );
    } catch (e) {
      const msg = errorMessageFromUnknown(e, "Could not update the share.");
      const suggestMigration =
        /could not find the function|PGRST202|42883|function .* does not exist/i.test(msg);
      Alert.alert(
        "Update share",
        suggestMigration
          ? `${msg}\n\nRun supabase/migrations/20260514120000_grocery_share_replace_export.sql in the Supabase SQL editor for this project, then try again.`
          : msg
      );
    } finally {
      setReplacingSnapshot(false);
    }
  }, [shareId, list]);

  const onPressShareCodeCopyIcon = useCallback(async () => {
    if (!shareId) return;
    await Clipboard.setStringAsync(shareId);
    Alert.alert("Copied", "List code copied to the clipboard.");
  }, [shareId]);

  const onPressShareInfo = useCallback(() => {
    Alert.alert(SHARE_INFO_TITLE, shareInfoBody());
  }, []);

  const onDownloadQrPng = useCallback(async () => {
    if (!shareId) return;
    const svg = qrExportSvgRef.current ?? qrSvgRef.current;
    if (!svg?.toDataURL) {
      Alert.alert("QR", "Could not export this QR code yet. Try again in a moment.");
      return;
    }
    const cacheDir = FileSystem.cacheDirectory;
    if (!cacheDir) {
      Alert.alert("QR", "Saving is not available in this environment.");
      return;
    }
    setSavingQr(true);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        try {
          svg.toDataURL(
            (d) => {
              if (typeof d !== "string" || !d) reject(new Error("Empty image data."));
              else resolve(d);
            },
            { width: 720, height: 720 }
          );
        } catch (e) {
          reject(e);
        }
      });
      let outBase64 = data;
      try {
        outBase64 = embedQrPngInShareLetterhead(data);
      } catch {
        // If compositing fails, fall back to the raw QR bitmap.
      }
      const safe = shareId.replace(/[^a-zA-Z0-9_-]+/g, "").slice(0, 24) || "share";
      const path = `${cacheDir}saycart-qr-${safe}.png`;
      await FileSystem.writeAsStringAsync(path, outBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert("Sharing not available", "This device cannot open the share sheet for images.");
        return;
      }
      await Sharing.shareAsync(path, {
        mimeType: "image/png",
        UTI: "public.png",
        dialogTitle: "Save or share QR",
      });
    } catch (e) {
      Alert.alert("QR", errorMessageFromUnknown(e, "Could not save the QR image."));
    } finally {
      setSavingQr(false);
    }
  }, [shareId]);

  if (!list || !payload) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 8, justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: colors.placeholder }}>List not found.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.linkBlue, fontWeight: "700" }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.linkBlue} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Share list
        </Text>
        <View style={styles.headerSide}>
          <TouchableOpacity
            onPress={onPressShareInfo}
            style={styles.headerInfoBtn}
            accessibilityRole="button"
            accessibilityLabel="About sharing"
          >
            <Ionicons name="information-circle-outline" size={26} color={colors.linkBlue} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={styles.sectionTitle}>CLOUD LINK & QR</Text>
          <View style={[styles.card, { marginTop: 8 }]}>
            {restoringShare ? (
              <View style={{ alignItems: "center", paddingVertical: 16, gap: 10 }}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.muted}>Checking for an existing share…</Text>
              </View>
            ) : !shareId ? (
              <>
                <Text style={styles.muted}>
                  {isSupabaseConfigured()
                    ? "Creates a snapshot in the cloud. Anyone with the code or QR can import it until it expires."
                    : "Configure Supabase env vars to enable sharing."}
                </Text>
                <TouchableOpacity
                  style={[styles.primaryBtn, !isSupabaseConfigured() && { opacity: 0.55 }]}
                  onPress={() => void onUploadCloud()}
                  disabled={uploading || !isSupabaseConfigured()}
                  activeOpacity={0.9}
                >
                  {uploading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="key-outline" size={22} color="#fff" />
                      <Text style={styles.primaryBtnText}>Generate Code</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View
                  style={{ position: "absolute", width: 420, height: 420, left: -9999, top: 0, opacity: 0 }}
                  pointerEvents="none"
                  collapsable={false}
                >
                  <QRCode
                    getRef={(c) => {
                      qrExportSvgRef.current = c as QrSvgHandle;
                    }}
                    value={qrValueForShareId(shareId)}
                    size={380}
                    backgroundColor="#FFFFFF"
                    color="#000000"
                    quietZone={10}
                    ecl="Q"
                  />
                </View>
                <Text style={styles.sectionTitle}>Share list code</Text>
                <View style={styles.codeRow}>
                  <Text selectable style={styles.codeText} numberOfLines={2}>
                    {shareId}
                  </Text>
                  <TouchableOpacity
                    style={styles.codeCopyBtn}
                    onPress={() => void onPressShareCodeCopyIcon()}
                    accessibilityRole="button"
                    accessibilityLabel="Copy list code"
                  >
                    <Ionicons name="copy-outline" size={22} color={colors.primary} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.sectionTitle}>QR</Text>
                <View style={styles.qrRow}>
                  <View
                    style={{
                      padding: 10,
                      backgroundColor: "#FFFFFF",
                      borderRadius: 12,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: colors.border,
                    }}
                  >
                    <QRCode
                      getRef={(c) => {
                        qrSvgRef.current = c as QrSvgHandle;
                      }}
                      value={qrValueForShareId(shareId)}
                      size={200}
                      backgroundColor="#FFFFFF"
                      color="#000000"
                      quietZone={6}
                      ecl="Q"
                    />
                  </View>
                  <TouchableOpacity
                    style={styles.qrDownloadBtn}
                    onPress={() => void onDownloadQrPng()}
                    disabled={savingQr}
                    accessibilityRole="button"
                    accessibilityLabel="Download or share QR image"
                  >
                    {savingQr ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <Ionicons name="download-outline" size={26} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                </View>
                <Text style={styles.muted}>Receiver: Groceries → Import → paste the code or scan this QR.</Text>
                <TouchableOpacity
                  style={styles.ghostBtn}
                  onPress={() => void onReplaceSnapshot()}
                  disabled={replacingSnapshot || savingQr || uploading}
                  accessibilityRole="button"
                  accessibilityLabel="Update cloud snapshot for this share code"
                >
                  {replacingSnapshot ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="refresh-outline" size={20} color={colors.text} />
                      <Text style={styles.ghostBtnText}>Update cloud snapshot</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
