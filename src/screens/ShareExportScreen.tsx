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
import Ionicons from "@expo/vector-icons/Ionicons";
import type { ShareExportProps, ShareExportRouteParams } from "../navigation/types";
import { APP_DISPLAY_NAME } from "../constants/appBranding";
import type { ToolId } from "../constants/toolsCatalog";
import { useAppData } from "../context/AppDataContext";
import { useToolTheme } from "../hooks/useToolTheme";
import type { AppThemeColors } from "../theme/colors";
import { isSupabaseConfigured } from "../services/supabaseClient";
import { fetchShareExport, replaceShareExport, uploadShareExport } from "../services/shareExportCloud";
import { buildGroceryShareFileFromList } from "../utils/grocerySharePayload";
import { buildTodoShareFileFromList } from "../utils/todoSharePayload";
import { buildReminderShareFileFromReminder } from "../utils/reminderSharePayload";
import { parseShareEnvelope } from "../utils/shareEnvelope";
import { loadRemindersRaw } from "../utils/remindersStorage";
import type { SavedReminder } from "../utils/remindersStorage";
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
  const b = process.env.EXPO_PUBLIC_SHARE_WEB_BASE ?? process.env.EXPO_PUBLIC_GROCERY_SHARE_WEB_BASE;
  if (typeof b !== "string" || !b.trim()) return null;
  return b.replace(/\/+$/, "");
}

function qrValueForShareId(shareId: string): string {
  const base = shareWebBase();
  return base ? `${base}/${shareId}` : shareId;
}

function shareExportStorageKey(params: ShareExportRouteParams): string {
  if (params.tool === "reminder") return `saycart:shareExport:reminder:${params.reminderId}`;
  return `saycart:shareExport:${params.tool}:${params.listId}`;
}

const SHARE_INFO_TITLE = "About sharing";

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

function shareInfoBody(tool: ToolId): string {
  const importHint =
    tool === "grocery"
      ? "Groceries → Import shared data"
      : tool === "todo"
        ? "To-dos → Import shared data"
        : "Reminder → Import shared data (from the tool’s home screen)";
  const lines = [
    `Tap Generate Code to save a snapshot in the cloud. You get a share code and QR that anyone can use to import in ${APP_DISPLAY_NAME}. Codes and links work for 7 days.`,
    "",
    "After you edit, tap “Update cloud snapshot” so imports use the latest version (the code and QR stay the same).",
    "",
    `Recipients: ${importHint} → paste the code or scan the QR.`,
  ];
  return lines.join("\n");
}

type QrSvgHandle = {
  toDataURL: (callback: (data: string) => void, options?: { width?: number; height?: number }) => void;
};

export default function ShareExportScreen({ navigation, route }: ShareExportProps) {
  const insets = useSafeAreaInsets();
  const params = route.params;
  const tool: ToolId = params.tool;
  const { colors } = useToolTheme(tool);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { lists, todoLists } = useAppData();

  const [reminder, setReminder] = useState<SavedReminder | null>(null);
  const [reminderLoading, setReminderLoading] = useState(params.tool === "reminder");

  useEffect(() => {
    if (params.tool !== "reminder") return;
    let cancelled = false;
    const id = params.reminderId;
    void loadRemindersRaw().then((all) => {
      if (cancelled) return;
      const r = all.find((x) => x.id === id) ?? null;
      setReminder(r);
      setReminderLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [params]);

  const groceryList = useMemo(() => {
    if (params.tool !== "grocery") return null;
    return lists.find((l) => l.id === params.listId) ?? null;
  }, [lists, params]);

  const todoList = useMemo(() => {
    if (params.tool !== "todo") return null;
    return todoLists.find((l) => l.id === params.listId) ?? null;
  }, [params, todoLists]);

  const entityLabel =
    params.tool === "reminder"
      ? (reminder?.title.trim() || "Reminder")
      : params.tool === "todo"
        ? todoList?.name
        : groceryList?.name;

  const [uploading, setUploading] = useState(false);
  const [shareId, setShareId] = useState<string | null>(null);
  const [restoringShare, setRestoringShare] = useState(() => isSupabaseConfigured());
  const [savingQr, setSavingQr] = useState(false);
  const [replacingSnapshot, setReplacingSnapshot] = useState(false);
  const qrSvgRef = useRef<QrSvgHandle | null>(null);
  const qrExportSvgRef = useRef<QrSvgHandle | null>(null);

  const payload = useMemo(() => {
    const iso = new Date().toISOString();
    if (params.tool === "grocery" && groceryList) return buildGroceryShareFileFromList(groceryList, iso);
    if (params.tool === "todo" && todoList) return buildTodoShareFileFromList(todoList, iso);
    if (params.tool === "reminder" && reminder) return buildReminderShareFileFromReminder(reminder, iso);
    return null;
  }, [groceryList, params.tool, reminder, todoList]);

  const storageKey = shareExportStorageKey(params);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setRestoringShare(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        let raw = await AsyncStorage.getItem(storageKey);
        if (!raw && params.tool === "grocery") {
          const legacy = `saycart:groceryShareExport:${params.listId}`;
          raw = await AsyncStorage.getItem(legacy);
          if (raw) {
            await AsyncStorage.setItem(storageKey, raw);
            await AsyncStorage.removeItem(legacy);
          }
        }
        const id = typeof raw === "string" ? raw.trim() : "";
        if (!id) return;
        const data = await fetchShareExport(id);
        if (cancelled) return;
        const parsed = parseShareEnvelope(data);
        if (parsed?.tool === params.tool) setShareId(id);
        else await AsyncStorage.removeItem(storageKey);
      } catch {
        // leave share unset
      }
    })().finally(() => {
      if (!cancelled) setRestoringShare(false);
    });
    return () => {
      cancelled = true;
    };
  }, [params.tool, storageKey]);

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
      const id = await uploadShareExport(payload as unknown as Record<string, unknown>);
      setShareId(id);
      await AsyncStorage.setItem(storageKey, id);
    } catch (e) {
      Alert.alert("Cloud share", errorMessageFromUnknown(e, "Upload failed."));
    } finally {
      setUploading(false);
    }
  }, [payload, storageKey]);

  const onReplaceSnapshot = useCallback(async () => {
    if (!shareId || !payload) return;
    if (!isSupabaseConfigured()) {
      Alert.alert(
        "Cloud share",
        "Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your environment, and run the SQL in supabase/migrations in your Supabase project."
      );
      return;
    }
    setReplacingSnapshot(true);
    try {
      await replaceShareExport(shareId, payload as unknown as Record<string, unknown>);
      Alert.alert(
        "Snapshot updated",
        "Your share code and QR are unchanged. Anyone who imports now gets this version."
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
  }, [payload, shareId]);

  const onPressShareCodeCopyIcon = useCallback(async () => {
    if (!shareId) return;
    await Clipboard.setStringAsync(shareId);
    Alert.alert("Copied", "Share code copied to the clipboard.");
  }, [shareId]);

  const onPressShareInfo = useCallback(() => {
    Alert.alert(SHARE_INFO_TITLE, shareInfoBody(tool));
  }, [tool]);

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
        // fall back to raw QR
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

  const missingEntity =
    params.tool === "reminder"
      ? !reminderLoading && !reminder
      : params.tool === "todo"
        ? !todoList
        : !groceryList;

  if (missingEntity || (params.tool === "reminder" && reminderLoading)) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 8, justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: colors.placeholder }}>
          {params.tool === "reminder" && reminderLoading ? "Loading…" : "Nothing to share here."}
        </Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.linkBlue, fontWeight: "700" }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!payload) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 8, justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: colors.placeholder }}>Nothing to share here.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.linkBlue, fontWeight: "700" }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const headerTitle = params.tool === "reminder" ? "Share reminder" : "Share list";

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.linkBlue} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {headerTitle}
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
            {entityLabel ? (
              <Text style={styles.muted} numberOfLines={2}>
                {entityLabel}
              </Text>
            ) : null}
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
                    accessibilityLabel="Copy share code"
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
                <Text style={styles.muted}>
                  {`Receiver: open ${APP_DISPLAY_NAME} → this tool’s Import shared data → paste the code or scan this QR.`}
                </Text>
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
