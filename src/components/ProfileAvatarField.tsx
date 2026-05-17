import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ActivityIndicator,
  Platform,
  Keyboard,
  ScrollView,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import type { AppThemeColors } from "../theme/colors";
import type { AvatarCharacterId } from "../constants/avatarCharacters";
import { useAppAlert } from "../context/AppAlertContext";
import { useTheme } from "../context/ThemeContext";
import {
  deleteProfileAvatarFromCloud,
  uploadProfileAvatarToCloud,
} from "../services/profileCloudSync";
import { isSupabaseConfigured } from "../services/supabaseClient";
import { persistProfileAvatarLocal } from "../utils/profileAvatarFiles";
import { loadUserProfile, saveUserProfile, type UserProfile } from "../utils/userProfileStorage";
import AvatarCharacterPickerGrid from "./AvatarCharacterPickerGrid";
import { ProfilePortrait } from "./ProfilePortrait";

type Props = {
  colors: AppThemeColors;
  size?: number;
  style?: StyleProp<ViewStyle>;
  showCaption?: boolean;
  align?: "center" | "start";
  /** Upload portrait to cloud immediately after pick (Profile). Off during username setup until submit. */
  uploadAfterPick?: boolean;
  /** Ring around the camera badge (match parent surface). */
  badgeBorderColor?: string;
  onProfileUpdated?: (profile: UserProfile) => void;
};

function createStyles(
  c: AppThemeColors,
  size: number,
  badgeBorderColor: string,
  align: "center" | "start"
) {
  const badge = Math.round(size * 0.34);
  return StyleSheet.create({
    wrap: { alignItems: align === "center" ? "center" : "flex-start" },
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
      textAlign: align === "center" ? "center" : "left",
    },
    modalRoot: { flex: 1, justifyContent: "flex-end" },
    modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: c.overlay },
    modalSheet: {
      backgroundColor: c.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 18,
      maxHeight: "88%",
    },
    modalTitle: { fontSize: 20, fontWeight: "800", color: c.text },
    sheetSubtitle: { fontSize: 14, color: c.placeholder, lineHeight: 20, marginBottom: 10 },
    sheetHeaderRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
    sheetHeaderIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: c.iconBlobBg,
      alignItems: "center",
      justifyContent: "center",
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: "800",
      color: c.textTertiary,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      marginBottom: 8,
      marginTop: 4,
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
      marginBottom: 4,
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
  size = 72,
  style,
  showCaption = true,
  align = "center",
  uploadAfterPick = false,
  badgeBorderColor,
  onProfileUpdated,
}: Props) {
  const insets = useSafeAreaInsets();
  const { showAlert } = useAppAlert();
  const { styleEpoch } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, size, badgeBorderColor ?? colors.card, align),
    [align, badgeBorderColor, colors, size, styleEpoch]
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

  const hasPhoto = Boolean(profile?.avatarLocalUri || profile?.avatarRemoteUrl);

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

  const clearCustomPhoto = async (current: UserProfile) => {
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
  };

  const selectCharacter = async (id: AvatarCharacterId) => {
    setBusy(true);
    try {
      const current = profile ?? (await loadUserProfile());
      if (current.avatarLocalUri || current.avatarRemoteUrl) {
        await clearCustomPhoto(current);
      }
      const next = await saveUserProfile({
        avatarCharacterId: id,
        avatarPortraitTouched: true,
        avatarLocalUri: undefined,
        avatarRemoteUrl: undefined,
        avatarStoragePath: undefined,
      });
      setProfile(next);
      onProfileUpdated?.(next);
    } catch (e) {
      showAlert({
        title: "Could not save character",
        message: e instanceof Error ? e.message : "Try again.",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
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
      const updated = await saveUserProfile({ avatarPortraitTouched: true });
      setProfile(updated);
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
      const updated = await saveUserProfile({ avatarPortraitTouched: true });
      setProfile(updated);
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

  const removePhoto = async () => {
    const current = profile ?? (await loadUserProfile());
    setBusy(true);
    try {
      await clearCustomPhoto(current);
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

  const confirmRemovePhoto = () => {
    showAlert({
      title: "Remove your photo?",
      message: "Your chosen character will show instead.",
      variant: "warning",
      buttons: [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => void removePhoto() },
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
          accessibilityLabel="Change profile portrait"
        >
          <View style={styles.avatar}>
            <ProfilePortrait profile={profile} size={size} />
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
        {showCaption ? (
          <Text style={styles.caption}>Tap to pick a character or your own photo</Text>
        ) : null}
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
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.sheetHeaderRow}>
                <View style={styles.sheetHeaderIcon}>
                  <Ionicons name="happy-outline" size={28} color={colors.primaryDark} />
                </View>
                <Text style={styles.modalTitle}>Profile portrait</Text>
              </View>
              <Text style={styles.sheetSubtitle}>
                Pick a Listahan character or use your own photo. Olive is the default until you choose.
              </Text>

              <Text style={styles.sectionLabel}>Characters</Text>
              <AvatarCharacterPickerGrid
                colors={colors}
                profile={profile}
                onSelect={(id) => {
                  void selectCharacter(id);
                }}
              />

              <Text style={styles.sectionLabel}>Your photo</Text>
              <Pressable
                style={({ pressed }) => [styles.sheetRow, pressed && { opacity: 0.75 }]}
                onPress={() => void pickFromLibrary()}
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
                  !hasPhoto && styles.sheetRowLast,
                  pressed && { opacity: 0.75 },
                ]}
                onPress={() => void pickFromCamera()}
              >
                <View style={styles.sheetRowIcon}>
                  <Ionicons name="camera-outline" size={22} color={colors.primaryDark} />
                </View>
                <Text style={styles.sheetRowLabel}>Take photo</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.placeholder} />
              </Pressable>

              {hasPhoto ? (
                <Pressable
                  style={({ pressed }) => [styles.sheetRow, styles.sheetRowLast, pressed && { opacity: 0.75 }]}
                  onPress={confirmRemovePhoto}
                >
                  <View style={styles.sheetRowIcon}>
                    <Ionicons name="trash-outline" size={22} color={colors.danger} />
                  </View>
                  <Text style={[styles.sheetRowLabel, styles.sheetRowLabelDanger]}>Remove photo</Text>
                  <Ionicons name="chevron-forward" size={20} color={colors.placeholder} />
                </Pressable>
              ) : null}
            </ScrollView>

            <Pressable
              style={({ pressed }) => [styles.sheetFooterBtn, pressed && { opacity: 0.85 }]}
              onPress={() => {
                Keyboard.dismiss();
                setSheetOpen(false);
              }}
            >
              <Text style={styles.sheetFooterBtnText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
