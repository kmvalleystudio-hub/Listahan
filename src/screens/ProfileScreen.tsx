import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Modal,
  Keyboard,
  Platform,
  Image,
  ActivityIndicator,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { ProfileProps } from "../navigation/types";
import { useTheme } from "../context/ThemeContext";
import { useAppAlert } from "../context/AppAlertContext";
import { useAppData } from "../context/AppDataContext";
import type { AppThemeColors } from "../theme/colors";
import { APP_DISPLAY_NAME } from "../constants/appBranding";
import { TOOLS_CATALOG } from "../constants/toolsCatalog";
import {
  deleteProfileAvatarFromCloud,
  uploadProfileAvatarToCloud,
} from "../services/profileCloudSync";
import { isSupabaseConfigured } from "../services/supabaseClient";
import {
  formatMemberSince,
  listahanPublicTag,
  loadUserProfile,
  profileInitials,
  saveUserProfile,
  type UserProfile,
} from "../utils/userProfileStorage";
import { loadQuickNotes } from "../utils/quickNotesStorage";
import { loadReminders } from "../utils/remindersStorage";
import { resetToolOrderToDefault } from "../utils/toolsDashboardOrder";

const GRID_PAD = 16;

function localAvatarDestination(ext: string): string {
  const safe = ext.startsWith(".") ? ext : `.${ext}`;
  return `${FileSystem.documentDirectory ?? ""}profile_avatar${safe}`;
}

function extFromPickerAsset(uri: string, mime?: string | null): ".jpg" | ".png" {
  const m = (mime ?? "").toLowerCase();
  if (m.includes("png")) return ".png";
  if (uri.toLowerCase().endsWith(".png")) return ".png";
  return ".jpg";
}

function punctuateDetail(message: string): string {
  const m = message.trim();
  if (!m) return "";
  return /[.!?]$/.test(m) ? m : `${m}.`;
}

function createStyles(c: AppThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: GRID_PAD,
      paddingBottom: 10,
      minHeight: 44,
    },
    headerEdge: { flex: 1, minWidth: 0 },
    headerEdgeLeft: { alignItems: "flex-start" },
    headerEdgeRight: { alignItems: "flex-end" },
    backBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 8, paddingRight: 8 },
    backText: { fontSize: 16, fontWeight: "600", color: c.linkBlue },
    headerTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: c.text,
      textAlign: "center",
      flexShrink: 0,
      paddingHorizontal: 8,
    },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: GRID_PAD, paddingBottom: 32, gap: 18 },
    heroCard: {
      backgroundColor: c.card,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      padding: 14,
      gap: 10,
    },
    heroTopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    avatarPress: { position: "relative", flexShrink: 0 },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: c.iconBlobBg,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      overflow: "hidden",
    },
    avatarImage: { width: "100%", height: "100%" },
    avatarText: { fontSize: 22, fontWeight: "800", color: c.primaryDark },
    avatarBadge: {
      position: "absolute",
      right: -2,
      bottom: -2,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: c.card,
    },
    heroIdentity: { flex: 1, minWidth: 0, gap: 3 },
    heroName: { fontSize: 20, fontWeight: "800", color: c.text },
    heroSub: { fontSize: 13, color: c.textTertiary, lineHeight: 18 },
    tagRow: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 4,
      maxWidth: "100%",
    },
    tagText: {
      flexShrink: 1,
      fontSize: 13,
      fontWeight: "600",
      color: c.textSecondary,
      letterSpacing: 0.1,
    },
    tagCopyBtn: { padding: 2, flexShrink: 0 },
    cloudHint: {
      fontSize: 12,
      color: c.textTertiary,
      lineHeight: 17,
      backgroundColor: c.inputBg,
      borderRadius: 10,
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: "800",
      color: c.textTertiary,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      marginBottom: 8,
      marginTop: 4,
    },
    card: {
      backgroundColor: c.card,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      overflow: "hidden",
    },
    statRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      gap: 12,
    },
    statRowLast: { borderBottomWidth: 0 },
    statLabel: { fontSize: 15, fontWeight: "600", color: c.text },
    statValue: { fontSize: 15, fontWeight: "700", color: c.textTertiary },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    rowLast: { borderBottomWidth: 0 },
    rowBody: { flex: 1, minWidth: 0 },
    rowTitle: { fontSize: 16, fontWeight: "600", color: c.text },
    rowSubtitle: { fontSize: 13, color: c.placeholder, marginTop: 4, lineHeight: 18 },
    rowIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: c.inputBg,
      alignItems: "center",
      justifyContent: "center",
    },
    foot: {
      marginTop: 8,
      fontSize: 12,
      color: c.placeholder,
      lineHeight: 18,
      paddingHorizontal: 4,
    },
    modalRoot: { flex: 1, justifyContent: "flex-end" },
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    modalSheet: {
      backgroundColor: c.card,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      paddingHorizontal: 20,
      paddingTop: 20,
      gap: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    modalTitle: { fontSize: 18, fontWeight: "800", color: c.text },
    input: {
      backgroundColor: c.inputBg,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 17,
      color: c.text,
    },
    modalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
    modalBtn: {
      flex: 1,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
    },
    modalBtnPrimary: { backgroundColor: c.primary },
    modalBtnGhost: { backgroundColor: c.inputBg, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    modalBtnTextPrimary: { color: "#fff", fontSize: 16, fontWeight: "700" },
    modalBtnTextGhost: { color: c.text, fontSize: 16, fontWeight: "700" },
    avatarSheetHeaderRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
    avatarSheetHeaderIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: c.inputBg,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    avatarSheetSubtitle: { fontSize: 14, color: c.placeholder, lineHeight: 20, marginBottom: 12 },
    avatarSheetRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingVertical: 14,
      paddingHorizontal: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    avatarSheetRowLast: { borderBottomWidth: 0 },
    avatarSheetRowIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: c.inputBg,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarSheetRowIconDanger: { backgroundColor: c.iconBlobBg },
    avatarSheetRowLabel: { flex: 1, fontSize: 16, fontWeight: "700", color: c.text },
    avatarSheetRowLabelDanger: { color: c.danger },
    avatarSheetFooterBtn: {
      marginTop: 16,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
      backgroundColor: c.inputBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    avatarSheetFooterBtnText: { fontSize: 16, fontWeight: "700", color: c.text },
    noticeCenterRoot: { flex: 1, justifyContent: "center", paddingHorizontal: 28 },
    noticeCard: {
      backgroundColor: c.card,
      borderRadius: 22,
      paddingVertical: 26,
      paddingHorizontal: 22,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      gap: 14,
    },
    noticeIconCircle: {
      alignSelf: "center",
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: c.iconBlobBg,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    noticeTitle: { fontSize: 19, fontWeight: "800", color: c.text, textAlign: "center" },
    noticeBody: { fontSize: 15, color: c.placeholder, lineHeight: 22, textAlign: "center" },
    noticeActionsRow: { flexDirection: "row", gap: 10, marginTop: 6 },
    noticePrimaryBtn: {
      flex: 1,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
      backgroundColor: c.primary,
    },
    noticePrimaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  });
}

export default function ProfileScreen({ navigation }: ProfileProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { showAlert } = useAppAlert();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { lists, todoLists, privateLists } = useAppData();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [notesCount, setNotesCount] = useState(0);
  const [remindersCount, setRemindersCount] = useState(0);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarSheetOpen, setAvatarSheetOpen] = useState(false);
  const [cloudPhotoNotice, setCloudPhotoNotice] = useState<{ detail: string } | null>(null);

  const refresh = useCallback(async () => {
    const [p, notes, reminders] = await Promise.all([
      loadUserProfile(),
      loadQuickNotes(),
      loadReminders(),
    ]);
    setProfile(p);
    setNotesCount(notes.length);
    setRemindersCount(reminders.length);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      return () => {
        setAvatarSheetOpen(false);
      };
    }, [refresh])
  );

  const persistAvatarLocal = async (pickerUri: string, mime?: string | null) => {
    if (Platform.OS === "web") {
      await saveUserProfile({
        avatarLocalUri: pickerUri,
        avatarRemoteUrl: undefined,
        avatarStoragePath: undefined,
      });
      return pickerUri;
    }
    const dir = FileSystem.documentDirectory;
    if (!dir) {
      await saveUserProfile({
        avatarLocalUri: pickerUri,
        avatarRemoteUrl: undefined,
        avatarStoragePath: undefined,
      });
      return pickerUri;
    }
    const ext = extFromPickerAsset(pickerUri, mime);
    const dest = localAvatarDestination(ext);
    try {
      const info = await FileSystem.getInfoAsync(dest);
      if (info.exists) await FileSystem.deleteAsync(dest, { idempotent: true });
    } catch {
      /* ignore */
    }
    await FileSystem.copyAsync({ from: pickerUri, to: dest });
    await saveUserProfile({
      avatarLocalUri: dest,
      avatarRemoteUrl: undefined,
      avatarStoragePath: undefined,
    });
    return dest;
  };

  const syncAvatarCloud = async (localUri: string, mime: string | null | undefined, current: UserProfile) => {
    if (!isSupabaseConfigured()) return;
    const up = await uploadProfileAvatarToCloud(
      current.deviceProfileId,
      current.username,
      current.tagSuffix,
      localUri,
      mime
    );
    if (!up.ok) {
      setCloudPhotoNotice({
        detail: punctuateDetail(up.message ?? "Could not upload portrait."),
      });
      return;
    }
    const next = await saveUserProfile({
      avatarRemoteUrl: up.publicUrl,
      avatarStoragePath: up.storagePath,
    });
    setProfile(next);
  };

  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showAlert({
        title: "Photos",
        message: "Allow photo library access to set your profile picture.",
        variant: "warning",
      });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    const asset = result.assets[0];
    setAvatarBusy(true);
    try {
      const current = profile ?? (await loadUserProfile());
      const localUri = await persistAvatarLocal(asset.uri, asset.mimeType ?? null);
      const updated = await loadUserProfile();
      setProfile(updated);
      await syncAvatarCloud(localUri, asset.mimeType ?? null, updated);
    } catch (e) {
      showAlert({
        title: "Profile photo",
        message: e instanceof Error ? e.message : "Could not save that photo.",
        variant: "error",
      });
    } finally {
      setAvatarBusy(false);
    }
  };

  const pickFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      showAlert({
        title: "Camera",
        message: "Allow camera access to take a profile picture.",
        variant: "warning",
      });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    const asset = result.assets[0];
    setAvatarBusy(true);
    try {
      const localUri = await persistAvatarLocal(asset.uri, asset.mimeType ?? "image/jpeg");
      const updated = await loadUserProfile();
      setProfile(updated);
      await syncAvatarCloud(localUri, asset.mimeType ?? "image/jpeg", updated);
    } catch (e) {
      showAlert({
        title: "Profile photo",
        message: e instanceof Error ? e.message : "Could not save that photo.",
        variant: "error",
      });
    } finally {
      setAvatarBusy(false);
    }
  };

  const confirmRemoveAvatar = () => {
    showAlert({
      title: "Remove profile photo?",
      message: "This removes it from this device and from the cloud if configured.",
      variant: "warning",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => void removeAvatarConfirmed(),
        },
      ],
    });
  };

  const removeAvatarConfirmed = async () => {
    const current = profile ?? (await loadUserProfile());
    setAvatarBusy(true);
    try {
      if (current.avatarLocalUri && Platform.OS !== "web") {
        try {
          const info = await FileSystem.getInfoAsync(current.avatarLocalUri);
          if (info.exists) await FileSystem.deleteAsync(current.avatarLocalUri, { idempotent: true });
        } catch {
          /* ignore */
        }
      }
      const cloud = await deleteProfileAvatarFromCloud(
        current.deviceProfileId,
        current.username,
        current.tagSuffix,
        current.avatarStoragePath ?? null
      );
      if (!cloud.ok && isSupabaseConfigured()) {
        showAlert({
          title: "Cloud remove failed",
          message: cloud.message ?? "Photo may still appear for sync until fixed.",
          variant: "error",
        });
      }
      const next = await saveUserProfile({
        avatarLocalUri: undefined,
        avatarRemoteUrl: undefined,
        avatarStoragePath: undefined,
      });
      setProfile(next);
    } finally {
      setAvatarBusy(false);
    }
  };

  const openAvatarOptions = () => {
    if (avatarBusy) return;
    setAvatarSheetOpen(true);
  };

  const closeAvatarSheet = () => setAvatarSheetOpen(false);

  const onPickLibrary = () => {
    closeAvatarSheet();
    void pickFromLibrary();
  };

  const onPickCamera = () => {
    closeAvatarSheet();
    void pickFromCamera();
  };

  const onRemoveFromSheet = () => {
    closeAvatarSheet();
    confirmRemoveAvatar();
  };

  const copyListahanTag = useCallback(async () => {
    const tag = listahanPublicTag(profile?.username ?? "", profile?.tagSuffix);
    if (!tag) return;
    try {
      await Clipboard.setStringAsync(tag);
      showAlert({
        title: "Copied",
        message: "Your Listahan tag was copied to the clipboard.",
        variant: "success",
      });
    } catch {
      showAlert({
        title: "Could not copy",
        message: "Try selecting the tag manually.",
        variant: "error",
      });
    }
  }, [profile?.username, profile?.tagSuffix, showAlert]);

  const confirmResetTools = () => {
    showAlert({
      title: "Reset tools layout?",
      message: `Restore the home screen to the default order (${TOOLS_CATALOG.map((t) => t.title).join(", ")}).`,
      variant: "warning",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            void resetToolOrderToDefault().then(() => {
              showAlert({
                title: "Layout reset",
                message: "Open the home screen to see the default tool order.",
                variant: "success",
              });
            });
          },
        },
      ],
    });
  };

  const rowChevron = () => <Ionicons name="chevron-forward" size={20} color={colors.placeholder} />;

  const username = profile?.username ?? "";
  const publicTag = listahanPublicTag(username, profile?.tagSuffix);

  const renderListahanTagRow = () => {
    if (!publicTag) return null;
    return (
      <View style={styles.tagRow}>
        <Text style={styles.tagText} selectable>
          {publicTag}
        </Text>
        <Pressable
          onPress={() => void copyListahanTag()}
          hitSlop={10}
          style={styles.tagCopyBtn}
          accessibilityRole="button"
          accessibilityLabel="Copy Listahan tag"
        >
          <Ionicons name="copy-outline" size={17} color={colors.linkBlue} />
        </Pressable>
      </View>
    );
  };
  const memberSince = profile?.createdAt ? formatMemberSince(profile.createdAt) : "";
  const avatarUri = profile?.avatarLocalUri || profile?.avatarRemoteUrl;
  const hasPortrait = Boolean(profile?.avatarLocalUri || profile?.avatarRemoteUrl);

  const stats = [
    { label: "Grocery lists", value: lists.length },
    { label: "To-do lists", value: todoLists.length },
    { label: "Notes", value: notesCount },
    { label: "Reminders", value: remindersCount },
    { label: "Vault sheets", value: privateLists.length },
  ];

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <View style={[styles.headerEdge, styles.headerEdgeLeft]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={22} color={colors.linkBlue} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle} accessibilityRole="header">
          Profile
        </Text>
        <View style={[styles.headerEdge, styles.headerEdgeRight]} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <Pressable
              style={styles.avatarPress}
              onPress={openAvatarOptions}
              disabled={avatarBusy}
              accessibilityRole="button"
              accessibilityLabel="Change profile photo"
            >
              <View style={styles.avatar}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImage} resizeMode="cover" />
                ) : (
                  <Text style={styles.avatarText}>{profileInitials(username)}</Text>
                )}
                {avatarBusy ? (
                  <View
                    style={[
                      StyleSheet.absoluteFillObject,
                      { alignItems: "center", justifyContent: "center", backgroundColor: colors.overlayStrong },
                    ]}
                  >
                    <ActivityIndicator color={colors.primary} />
                  </View>
                ) : null}
              </View>
              <View style={styles.avatarBadge} pointerEvents="none">
                <Ionicons name="camera" size={13} color="#fff" />
              </View>
            </Pressable>

            <View style={styles.heroIdentity}>
              <Text style={styles.heroName} numberOfLines={1}>
                {username.trim() ? username.trim() : "Username"}
              </Text>
              {renderListahanTagRow()}
              <Text style={styles.heroSub} numberOfLines={2}>
                {memberSince ? `On ${APP_DISPLAY_NAME} since ${memberSince}` : `Your ${APP_DISPLAY_NAME} space`}
              </Text>
            </View>
          </View>

          <Text style={styles.cloudHint}>
            Portrait and tag saved for when others can find you on {APP_DISPLAY_NAME}.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>On this device</Text>
        <View style={styles.card}>
          {stats.map((s, i) => (
            <View key={s.label} style={[styles.statRow, i === stats.length - 1 && styles.statRowLast]}>
              <Text style={styles.statLabel}>{s.label}</Text>
              <Text style={styles.statValue}>{s.value}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Shortcuts</Text>
        <View style={styles.card}>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
            onPress={() => navigation.navigate("ShareImport")}
            accessibilityRole="button"
          >
            <View style={styles.rowIcon}>
              <Ionicons name="download-outline" size={20} color={colors.primaryDark} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Import from share code</Text>
              <Text style={styles.rowSubtitle}>Paste a QR or code from someone else’s list.</Text>
            </View>
            {rowChevron()}
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
            onPress={() => navigation.navigate("PrivateVaultSettings")}
            accessibilityRole="button"
          >
            <View style={styles.rowIcon}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.primaryDark} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Vault security</Text>
              <Text style={styles.rowSubtitle}>PIN, biometrics, and recovery for private sheets.</Text>
            </View>
            {rowChevron()}
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.row, styles.rowLast, pressed && { opacity: 0.85 }]}
            onPress={confirmResetTools}
            accessibilityRole="button"
          >
            <View style={styles.rowIcon}>
              <Ionicons name="grid-outline" size={20} color={colors.primaryDark} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Reset tools layout</Text>
              <Text style={styles.rowSubtitle}>Restore the default order on the home screen.</Text>
            </View>
            {rowChevron()}
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Data</Text>
        <View style={styles.card}>
          <Pressable
            style={({ pressed }) => [styles.row, styles.rowLast, pressed && { opacity: 0.85 }]}
            onPress={() =>
              showAlert({
                title: "Data on this device",
                message: `${APP_DISPLAY_NAME} keeps your lists, notes, reminders, and vault on this phone. With Supabase configured, your Listahan tag (@username), portrait, and profile upload for future discovery sync; nothing else is uploaded unless you share or import a code.`,
                variant: "info",
              })
            }
            accessibilityRole="button"
          >
            <View style={styles.rowIcon}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.primaryDark} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Data & privacy</Text>
              <Text style={styles.rowSubtitle}>Where your information lives today.</Text>
            </View>
            {rowChevron()}
          </Pressable>
        </View>

        <Text style={styles.foot}>
          Like Listonic and similar list apps, profile is for you and your data; use Settings for app preferences and
          support.
        </Text>
      </ScrollView>

      <Modal
        visible={avatarSheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          Keyboard.dismiss();
          closeAvatarSheet();
        }}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => {
              Keyboard.dismiss();
              closeAvatarSheet();
            }}
          />
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.avatarSheetHeaderRow}>
              <View style={styles.avatarSheetHeaderIcon}>
                <Ionicons name="person-circle-outline" size={28} color={colors.primaryDark} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.modalTitle}>Profile photo</Text>
              </View>
            </View>
            <Text style={styles.avatarSheetSubtitle}>Choose a new portrait or remove the current one.</Text>

            <Pressable
              style={({ pressed }) => [styles.avatarSheetRow, pressed && { opacity: 0.75 }]}
              onPress={onPickLibrary}
              accessibilityRole="button"
              accessibilityLabel="Choose from library"
            >
              <View style={styles.avatarSheetRowIcon}>
                <Ionicons name="images-outline" size={22} color={colors.primaryDark} />
              </View>
              <Text style={styles.avatarSheetRowLabel}>Choose from library</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.placeholder} />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.avatarSheetRow,
                !hasPortrait && styles.avatarSheetRowLast,
                pressed && { opacity: 0.75 },
              ]}
              onPress={onPickCamera}
              accessibilityRole="button"
              accessibilityLabel="Take photo"
            >
              <View style={styles.avatarSheetRowIcon}>
                <Ionicons name="camera-outline" size={22} color={colors.primaryDark} />
              </View>
              <Text style={styles.avatarSheetRowLabel}>Take photo</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.placeholder} />
            </Pressable>

            {hasPortrait ? (
              <Pressable
                style={({ pressed }) => [
                  styles.avatarSheetRow,
                  styles.avatarSheetRowLast,
                  pressed && { opacity: 0.75 },
                ]}
                onPress={onRemoveFromSheet}
                accessibilityRole="button"
                accessibilityLabel="Remove profile photo"
              >
                <View style={[styles.avatarSheetRowIcon, styles.avatarSheetRowIconDanger]}>
                  <Ionicons name="trash-outline" size={22} color={colors.danger} />
                </View>
                <Text style={[styles.avatarSheetRowLabel, styles.avatarSheetRowLabelDanger]}>Remove photo</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.placeholder} />
              </Pressable>
            ) : null}

            <Pressable
              style={({ pressed }) => [styles.avatarSheetFooterBtn, pressed && { opacity: 0.85 }]}
              onPress={() => {
                Keyboard.dismiss();
                closeAvatarSheet();
              }}
              accessibilityRole="button"
            >
              <Text style={styles.avatarSheetFooterBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={cloudPhotoNotice !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setCloudPhotoNotice(null)}
      >
        <View style={[styles.modalRoot, { justifyContent: "center" }]}>
          <Pressable style={styles.modalBackdrop} onPress={() => setCloudPhotoNotice(null)} />
          <View style={styles.noticeCenterRoot} pointerEvents="box-none">
            <View style={styles.noticeCard}>
              <View style={styles.noticeIconCircle}>
                <Ionicons name="cloud-offline-outline" size={30} color={colors.primaryDark} />
              </View>
              <Text style={styles.noticeTitle}>Saved on this device</Text>
              <Text style={styles.noticeBody}>
                {cloudPhotoNotice?.detail ?? ""}
                {"\n\n"}
                Your new portrait is stored on this phone. It will sync to Supabase when the connection works again.
              </Text>
              <View style={styles.noticeActionsRow}>
                <Pressable
                  style={[styles.noticePrimaryBtn, { flex: 1 }]}
                  onPress={() => setCloudPhotoNotice(null)}
                  accessibilityRole="button"
                >
                  <Text style={styles.noticePrimaryBtnText}>OK</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
