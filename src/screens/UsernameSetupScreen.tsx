import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar as RNStatusBar,
} from "react-native";
import { useAppStyles } from "../hooks/useAppStyles";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { RootStackParamList } from "../navigation/types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTheme } from "../context/ThemeContext";
import { useAppAlert } from "../context/AppAlertContext";
import type { AppThemeColors } from "../theme/colors";
import { darkColors } from "../theme/colors";
import { APP_DISPLAY_NAME } from "../constants/appBranding";
import ListahanOnboardingFooter from "../components/ListahanOnboardingFooter";
import ProfileAvatarField from "../components/ProfileAvatarField";
import UsernameSetupBackgroundArt from "../components/UsernameSetupBackgroundArt";
import {
  loadUserProfile,
  readLegacyDisplayNameForUsernamePrefill,
  saveUserProfile,
} from "../utils/userProfileStorage";
import {
  normalizeUsername,
  usernameSuggestionFromLegacyDisplayName,
  usernameValidationMessage,
} from "../utils/usernameRules";
import { checkUsernameAvailableOnServer } from "../services/usernameAvailability";
import { upsertPublicProfileMeta, uploadProfileAvatarToCloud } from "../services/profileCloudSync";
import { isSupabaseConfigured } from "../services/supabaseClient";

type Props = NativeStackScreenProps<RootStackParamList, "UsernameSetup">;

const GRID_PAD = 20;

function createStyles(c: AppThemeColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.background,
      overflow: "hidden",
    },
    body: {
      flex: 1,
      justifyContent: "center",
      minHeight: 0,
      paddingHorizontal: GRID_PAD,
      zIndex: 1,
    },
    title: {
      fontSize: 26,
      fontWeight: "800",
      color: c.text,
      textAlign: "center",
      marginBottom: 10,
    },
    subtitle: {
      fontSize: 15,
      color: c.placeholder,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: 18,
    },
    avatarSlot: {
      marginBottom: 18,
    },
    label: {
      fontSize: 13,
      fontWeight: "700",
      color: c.textTertiary,
      marginBottom: 8,
      letterSpacing: 0.3,
    },
    inlineRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    inputWrap: {
      flex: 1,
      minWidth: 0,
      position: "relative",
    },
    input: {
      backgroundColor: c.inputBg,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      paddingLeft: 14,
      paddingRight: 14,
      paddingVertical: Platform.OS === "ios" ? 14 : 12,
      fontSize: 17,
      fontWeight: "600",
      color: c.text,
    },
    inputBusy: {
      paddingRight: 44,
    },
    inputSpinner: {
      position: "absolute",
      right: 12,
      top: 0,
      bottom: 0,
      justifyContent: "center",
    },
    hint: {
      fontSize: 13,
      color: c.placeholder,
      lineHeight: 19,
      marginTop: 8,
      marginBottom: 16,
    },
    submitBtn: {
      flexShrink: 0,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 16,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "stretch",
      backgroundColor: c.primary,
      minWidth: 112,
    },
    submitBtnDisabled: { opacity: 0.45 },
    submitLabel: { color: "#fff", fontSize: 15, fontWeight: "800" },
  });
}

export default function UsernameSetupScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { scheme, setScheme } = useTheme();
  const { showAlert } = useAppAlert();
  const colors = darkColors;
  const styles = useAppStyles(createStyles);

  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const draftTrimmed = draft.trim();
  const showAvatar = draftTrimmed.length > 0;

  useFocusEffect(
    useCallback(() => {
      RNStatusBar.setBarStyle("light-content");
      return () => {
        RNStatusBar.setBarStyle(scheme === "dark" ? "light-content" : "dark-content");
      };
    }, [scheme])
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const legacy = await readLegacyDisplayNameForUsernamePrefill();
      const suggestion = usernameSuggestionFromLegacyDisplayName(legacy);
      if (!cancelled && suggestion) setDraft(suggestion);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async () => {
    const normalized = normalizeUsername(draft);
    const localErr = usernameValidationMessage(normalized);
    if (localErr) {
      showAlert({ title: "Username", message: localErr, variant: "error" });
      return;
    }
    setBusy(true);
    try {
      const current = await loadUserProfile();
      const prevUsername = current.username;
      const wasClaimingFirstUsername = !normalizeUsername(prevUsername);

      const goToWelcome = () => {
        if (wasClaimingFirstUsername) setScheme("light");
        navigation.reset({
          index: 0,
          routes: [{ name: "Welcome", params: { username: normalized } }],
        });
      };

      if (normalizeUsername(current.username) === normalized) {
        goToWelcome();
        return;
      }
      const remote = await checkUsernameAvailableOnServer(normalized, current.deviceProfileId);
      if (!remote.ok) {
        showAlert({
          title: remote.usernameTaken ? "Username taken" : "Username",
          message: remote.message,
          variant: remote.usernameTaken ? "error" : "warning",
        });
        return;
      }
      await saveUserProfile({ username: normalized });
      let next = await loadUserProfile();
      if (next.avatarLocalUri && isSupabaseConfigured()) {
        const up = await uploadProfileAvatarToCloud(
          next.deviceProfileId,
          normalized,
          next.tagSuffix,
          next.avatarLocalUri,
          null
        );
        if (up.ok) {
          next = await saveUserProfile({
            avatarRemoteUrl: up.publicUrl,
            avatarStoragePath: up.storagePath,
          });
        }
      }
      const meta = await upsertPublicProfileMeta({
        deviceProfileId: next.deviceProfileId,
        username: next.username,
        tagSuffix: next.tagSuffix,
        avatarStoragePath: next.avatarStoragePath ?? null,
      });
      if (!meta.ok && isSupabaseConfigured()) {
        await saveUserProfile({ username: prevUsername });
        showAlert({
          title: "Couldn't save username",
          message: meta.message ?? "Try again.",
          variant: "error",
        });
        return;
      }
      goToWelcome();
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <View style={[styles.screen, { paddingTop: insets.top + 20 }]}>
        <UsernameSetupBackgroundArt opacity={0.055} />
        <View style={styles.body}>
          <Text style={styles.title}>Choose your username</Text>
          <Text style={styles.subtitle}>
            This is how others will find you in {APP_DISPLAY_NAME} when sync and discovery arrive. Usernames are
            unique.
          </Text>

          {showAvatar ? (
            <ProfileAvatarField
              colors={colors}
              size={76}
              style={styles.avatarSlot}
              uploadAfterPick={false}
              badgeBorderColor={colors.background}
            />
          ) : null}

          <Text style={styles.label}>Username</Text>
          <View style={styles.inlineRow}>
            <View style={styles.inputWrap}>
              <TextInput
                style={[styles.input, busy && styles.inputBusy]}
                value={draft}
                onChangeText={setDraft}
                placeholder="e.g. john_lists"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                maxLength={30}
                editable={!busy}
                returnKeyType="done"
                onSubmitEditing={() => void onSubmit()}
              />
              {busy ? (
                <View style={styles.inputSpinner} pointerEvents="none">
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : null}
            </View>
            <Pressable
              style={[styles.submitBtn, busy && styles.submitBtnDisabled]}
              onPress={() => void onSubmit()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Continue"
            >
              <Text style={styles.submitLabel}>Continue</Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>3–30 characters: letters, numbers, underscores. Stored in lowercase.</Text>
        </View>

        <ListahanOnboardingFooter
          colors={colors}
          variant="dark"
          paddingBottom={Math.max(insets.bottom, 18)}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
