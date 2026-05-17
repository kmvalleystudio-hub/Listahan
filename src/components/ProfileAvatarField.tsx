import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Image,
  ActivityIndicator,
  Platform,
  Keyboard,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import type { AppThemeColors } from "../theme/colors";
import { useAppAlert } from "../context/AppAlertContext";
import {
  deleteProfileAvatarFromCloud,
  uploadProfileAvatarToCloud,
} from "../services/profileCloudSync";
import { isSupabaseConfigured } from "../services/supabaseClient";
import { persistProfileAvatarLocal } from "../utils/profileAvatarFiles";
import {
  loadUserProfile,
  profileInitials,
  saveUserProfile,
  type UserProfile,
} from "../utils/userProfileStorage";

type Props = {
  colors: AppThemeColors;
  /** Used for default initials when no custom portrait is set. */
  initialsSource: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  /** Upload portrait to cloud immediately after pick (Profile). Off during username setup until submit. */
  uploadAfterPick?: boolean;
  /** Ring around the camera badge (match parent surface). */
  badgeBorderColor?: string;
  onProfileUpdated?: (profile: UserProfile) => void;
};

function createStyles(c: AppThemeColors, size: number, badgeBorderColor: string) {
  const badge = Math.round(size * 0.34);
  return StyleSheet.create({
    wrap: { alignItems: "center" },
    press: { position: "relative" },
    avatar: {
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: c.iconBlobBg,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      overflow: "hidden",
    },
    avatarImage: { width: "100%", height: "100%" },
    avatarText: { fontSize: Math.round(size * 0.34), fontWeight: "800", color: c.primaryDark },
    badge: {
      position: "absolute",
      right: -2,
      bottom: -2,
      width: badge,
      height: badge,
      borderRadius: badge / 2,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: badgeBorderColor,
    },
    caption: {
      marginTop: 8,
      fontSize: 12,
      color: c.placeholder,
      textAlign: "center",
    },
    modalRoot: { flex: 1, justifyContent: "flex-end" },
    modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: c.overlay },
    modalSheet: {
      backgroundColor: c.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 18,
    },
    modalTitle: { fontSize: 20, fontWeight: "800", color: c.text },
    sheetSubtitle: { fontSize: 14, color: c.placeholder, lineHeight: 20, marginBottom: 12 },
    sheetHeaderRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
    sheetHeaderIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: c.iconBlobBg,
      alignItems: "center",
      justifyContent: "center",
    },
    sheetRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    sheetRowLast: { borderBottomWidth: 0 },
    sheetRowIcon: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: c.inputBg,
      alignItems: "center",
      justifyContent: "center",
    },
    sheetRowLabel: { flex: 1, fontSize: 16, fontWeight: "700", color: c.text },
    sheetRowLabelDanger: { color: c.danger },
    sheetFooterBtn: {
      marginTop: 12,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
      backgroundColor: c.inputBg,
    },
    sheetFooterBtnText: { fontSize: 16, fontWeight: "700", color: c.text },
  });
}

export default function ProfileAvatarField({
  colors,
  initialsSource,
  size = 72,
  style,
  uploadAfterPick = false,
  badgeBorderColor,
  onProfileUpdated,
}: Props) {
  const insets = useSafeAreaInsets();
  const { showAlert } = useAppAlert();
  const styles = useMemo(
    () => createStyles(colors, size, badgeBorderColor ?? colors.card),
    [badgeBorderColor, colors, size]
  );

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const refreshProfile = useCallback(async () => {
    const p = await loadUserProfile();
    setProfile(p);
    onProfileUpdated?.(p);
    return p;
  }, [onProfileUpdated]);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const avatarUri = profile?.avatarLocalUri || profile?.avatarRemoteUrl;
  const hasPortrait = Boolean(profile?.avatarLocalUri || profile?.avatarRemoteUrl);
  const initials = profileInitials(initialsSource);

  const syncAvatarCloud = async (
    localUri: string,
    mime: string | null | undefined,
    current: UserProfile
  ) => {
    if (!uploadAfterPick || !isSupabaseConfigured()) return;
    const username = current.username.trim();
    if (!username) return;
    const up = await uploadProfileAvatarToCloud(
      current.deviceProfileId,
      username,
      current.tagSuffix,
      localUri,
      mime
    );
    if (!up.ok) {
      showAlert({
        title: "Portrait sync",
        message: up.message ?? "Saved on this device; cloud upload can be retried from Profile.",
        variant: "warning",
      });
      return;
    }
    const next = await saveUserProfile({
      avatarRemoteUrl: up.publicUrl,
      avatarStoragePath: up.storagePath,
    });
    setProfile(next);
    onProfileUpdated?.(next);
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
    setBusy(true);
    try {
      const localUri = await persistProfileAvatarLocal(asset.uri, asset.mimeType ?? null);
      const updated = await refreshProfile();
      await syncAvatarCloud(localUri, asset.mimeType ?? null, updated);
    } catch (e) {
      showAlert({
        title: "Profile photo",
        message: e instanceof Error ? e.message : "Could not save that photo.",
        variant: "error",
      });
    } finally {
      setBusy(false);
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
    setBusy(true);
    try {
      const localUri = await persistProfileAvatarLocal(asset.uri, asset.mimeType ?? "image/jpeg");
      const updated = await refreshProfile();
      await syncAvatarCloud(localUri, asset.mimeType ?? "image/jpeg", updated);
    } catch (e) {
      showAlert({
        title: "Profile photo",
        message: e instanceof Error ? e.message : "Could not save that photo.",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const removeAvatar = async () => {
    const current = profile ?? (await loadUserProfile());
    setBusy(true);
    try {
      if (current.avatarLocalUri && Platform.OS !== "web") {
        try {
          const info = await FileSystem.getInfoAsync(current.avatarLocalUri);
          if (info.exists) await FileSystem.deleteAsync(current.avatarLocalUri, { idempotent: true });
        } catch {
          /* ignore */
        }
      }
      if (uploadAfterPick && isSupabaseConfigured() && current.username.trim()) {
        const cloud = await deleteProfileAvatarFromCloud(
          current.deviceProfileId,
          current.username,
          current.tagSuffix,
          current.avatarStoragePath ?? null
        );
        if (!cloud.ok) {
          showAlert({
            title: "Cloud remove failed",
            message: cloud.message ?? "Photo removed on this device.",
            variant: "warning",
          });
        }
      }
      const next = await saveUserProfile({
        avatarLocalUri: undefined,
        avatarRemoteUrl: undefined,
        avatarStoragePath: undefined,
      });
      setProfile(next);
      onProfileUpdated?.(next);
    } finally {
      setBusy(false);
    }
  };

  const confirmRemove = () => {
    showAlert({
      title: "Remove profile photo?",
      message: "You'll see your initials again until you add a new photo.",
      variant: "warning",
      buttons: [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => void removeAvatar() },
      ],
    });
  };

  return (
    <>
      <View style={[styles.wrap, style]}>
        <Pressable
          style={styles.press}
          onPress={() => {
            if (busy) return;
            setSheetOpen(true);
          }}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Change profile photo"
        >
          <View style={styles.avatar}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} resizeMode="cover" />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
            {busy ? (
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
          <View style={styles.badge} pointerEvents="none">
            <Ionicons name="camera" size={Math.round(size * 0.19)} color="#fff" />
          </View>
        </Pressable>
        <Text style={styles.caption}>Tap to add or change your photo</Text>
      </View>

      <Modal
        visible={sheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          Keyboard.dismiss();
          setSheetOpen(false);
        }}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => {
              Keyboard.dismiss();
              setSheetOpen(false);
            }}
          />
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.sheetHeaderRow}>
              <View style={styles.sheetHeaderIcon}>
                <Ionicons name="person-circle-outline" size={28} color={colors.primaryDark} />
              </View>
              <Text style={styles.modalTitle}>Profile photo</Text>
            </View>
            <Text style={styles.sheetSubtitle}>Choose a portrait or remove the current one.</Text>

            <Pressable
              style={({ pressed }) => [styles.sheetRow, pressed && { opacity: 0.75 }]}
              onPress={() => {
                setSheetOpen(false);
                void pickFromLibrary();
              }}
            >
              <View style={styles.sheetRowIcon}>
                <Ionicons name="images-outline" size={22} color={colors.primaryDark} />
              </View>
              <Text style={styles.sheetRowLabel}>Choose from library</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.placeholder} />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.sheetRow,
                !hasPortrait && styles.sheetRowLast,
                pressed && { opacity: 0.75 },
              ]}
              onPress={() => {
                setSheetOpen(false);
                void pickFromCamera();
              }}
            >
              <View style={styles.sheetRowIcon}>
                <Ionicons name="camera-outline" size={22} color={colors.primaryDark} />
              </View>
              <Text style={styles.sheetRowLabel}>Take photo</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.placeholder} />
            </Pressable>

            {hasPortrait ? (
              <Pressable
                style={({ pressed }) => [styles.sheetRow, styles.sheetRowLast, pressed && { opacity: 0.75 }]}
                onPress={() => {
                  setSheetOpen(false);
                  confirmRemove();
                }}
              >
                <View style={styles.sheetRowIcon}>
                  <Ionicons name="trash-outline" size={22} color={colors.danger} />
                </View>
                <Text style={[styles.sheetRowLabel, styles.sheetRowLabelDanger]}>Remove photo</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.placeholder} />
              </Pressable>
            ) : null}

            <Pressable
              style={({ pressed }) => [styles.sheetFooterBtn, pressed && { opacity: 0.85 }]}
              onPress={() => {
                Keyboard.dismiss();
                setSheetOpen(false);
              }}
            >
              <Text style={styles.sheetFooterBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
