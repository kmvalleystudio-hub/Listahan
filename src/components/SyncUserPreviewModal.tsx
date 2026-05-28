import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Switch,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { AppThemeColors } from "../theme/colors";
import type { SyncProfileSearchResult } from "../services/syncProfileSearch";
import {
  DEFAULT_SYNC_TOOLS_REQUEST,
  SYNC_TOOL_IDS,
  SYNC_TOOL_LABELS,
  type SyncToolsConfig,
  hasEnabledSyncTool,
} from "../constants/syncTools";
import { useAppAlert } from "../context/AppAlertContext";
import { ProfilePortrait } from "./ProfilePortrait";
import VaultSyncPinConfirmModal from "./VaultSyncPinConfirmModal";
import {
  VAULT_SYNC_CLOUD_DISCLAIMER,
  VAULT_SYNC_PIN_PROMPT,
  VAULT_SYNC_SAFETY_REASSURANCE,
} from "../constants/vaultSyncDisclosure";

type Props = {
  visible: boolean;
  colors: AppThemeColors;
  profile: SyncProfileSearchResult | null;
  vaultSyncAllowed?: boolean;
  /** @deprecated Use vaultSyncAllowed */
  vaultUnlocked?: boolean;
  busy?: boolean;
  onClose: () => void;
  onOpenVaultSettings?: () => void;
  onRequestSync: (tools: SyncToolsConfig) => void;
};

export default function SyncUserPreviewModal({
  visible,
  colors,
  profile,
  vaultSyncAllowed,
  vaultUnlocked,
  busy = false,
  onClose,
  onOpenVaultSettings,
  onRequestSync,
}: Props) {
  const allowVaultSync = vaultSyncAllowed ?? vaultUnlocked ?? false;
  const { showAlert } = useAppAlert();
  const [tools, setTools] = useState<SyncToolsConfig>({ ...DEFAULT_SYNC_TOOLS_REQUEST });
  const [vaultPinModal, setVaultPinModal] = useState(false);

  useEffect(() => {
    if (!visible) {
      setTools({ ...DEFAULT_SYNC_TOOLS_REQUEST });
      setVaultPinModal(false);
    }
  }, [visible]);

  const promptVaultSyncSettings = () => {
    showAlert({
      title: "Include Vault in sync",
      message:
        "To sync Vault sheets, open Vault → Settings and turn on “Include Vault in user sync.” You must enter your vault PIN to enable this (biometrics are not accepted for this step).",
      variant: "info",
      buttons: [
        { text: "Not now", style: "cancel" },
        ...(onOpenVaultSettings
          ? [{ text: "Vault settings", onPress: onOpenVaultSettings }]
          : []),
      ],
    });
  };

  const toggleTool = (id: (typeof SYNC_TOOL_IDS)[number], value: boolean) => {
    if (id === "vault" && value) {
      if (!allowVaultSync) {
        promptVaultSyncSettings();
        return;
      }
      setVaultPinModal(true);
      return;
    }
    setTools((prev) => ({ ...prev, [id]: value }));
  };

  const handleRequest = () => {
    if (!hasEnabledSyncTool(tools)) {
      showAlert({
        title: "Choose tools",
        message: "Turn on at least one Listahan tool to sync.",
        variant: "warning",
      });
      return;
    }
    const vaultOn = tools.vault;
    showAlert({
      title: "Upload to the cloud?",
      message: vaultOn
        ? "List data and Vault entries (if enabled) upload to the cloud for your sync partner only. Your vault PIN stays on this device."
        : "Selected Listahan data will be uploaded to the cloud for your sync partner. Continue?",
      variant: "info",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          onPress: () => onRequestSync(tools),
        },
      ],
    });
  };

  if (!profile) return null;

  const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 28,
      maxHeight: "85%",
      gap: 14,
    },
    title: { fontSize: 18, fontWeight: "800", color: colors.text },
    hero: { flexDirection: "row", alignItems: "center", gap: 14 },
    name: { fontSize: 18, fontWeight: "800", color: colors.text },
    tag: { fontSize: 14, fontWeight: "600", color: colors.textSecondary, marginTop: 2 },
    section: { fontSize: 12, fontWeight: "800", color: colors.textTertiary, letterSpacing: 0.5 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: 12,
    },
    rowLabel: { fontSize: 15, fontWeight: "600", color: colors.text, flex: 1 },
    rowHint: { fontSize: 12, fontWeight: "500", color: colors.textTertiary, marginTop: 4, lineHeight: 17 },
    actions: { flexDirection: "row", gap: 10, marginTop: 8 },
    btn: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
    btnGhost: { backgroundColor: colors.inputBg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    btnPrimary: { backgroundColor: colors.primary },
    btnTextGhost: { color: colors.text, fontSize: 16, fontWeight: "700" },
    btnTextPrimary: { color: "#fff", fontSize: 16, fontWeight: "700" },
  });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Sync with this user</Text>
          <View style={styles.hero}>
            <ProfilePortrait
              profile={{
                avatarLocalUri: null,
                avatarRemoteUrl: profile.avatarUrl,
                avatarCharacterId: null,
                avatarPortraitTouched: false,
              }}
              size={56}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{profile.username}</Text>
              <Text style={styles.tag}>{profile.publicTag || profile.username}</Text>
              <Text style={[styles.tag, { marginTop: 6, fontWeight: "500", fontSize: 12 }]} selectable>
                User ID: {profile.deviceProfileId}
              </Text>
            </View>
          </View>

          <Text style={styles.section}>TOOLS TO SYNC</Text>
          <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
            {SYNC_TOOL_IDS.map((id) => {
              const vaultLocked = id === "vault" && !allowVaultSync;
              return (
                <Pressable
                  key={id}
                  style={styles.row}
                  onPress={vaultLocked ? promptVaultSyncSettings : undefined}
                  disabled={busy}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>{SYNC_TOOL_LABELS[id]}</Text>
                    {vaultLocked ? (
                      <Text style={styles.rowHint}>
                        Turn on “Include Vault in user sync” under Vault → Settings (PIN required, not
                        biometrics).
                      </Text>
                    ) : null}
                  </View>
                  <Switch
                    value={tools[id]}
                    onValueChange={(v) => toggleTool(id, v)}
                    disabled={busy || vaultLocked}
                    trackColor={{ false: colors.switchTrackOff, true: colors.switchTrackOn }}
                    thumbColor={tools[id] ? colors.switchThumbOn : colors.switchThumbOff}
                    ios_backgroundColor={colors.iosSwitchBg}
                  />
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={[styles.btn, styles.btnGhost]} onPress={onClose} disabled={busy}>
              <Text style={styles.btnTextGhost}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnPrimary, busy && { opacity: 0.7 }]}
              onPress={handleRequest}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnTextPrimary}>Request Sync</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>

      <VaultSyncPinConfirmModal
        visible={vaultPinModal}
        colors={colors}
        onClose={() => setVaultPinModal(false)}
        onVerified={() => {
          setVaultPinModal(false);
          setTools((prev) => ({ ...prev, vault: true }));
        }}
        disclaimer={VAULT_SYNC_CLOUD_DISCLAIMER}
        reassurance={VAULT_SYNC_SAFETY_REASSURANCE}
        message={VAULT_SYNC_PIN_PROMPT}
        confirmLabel="Include Vault"
      />
    </Modal>
  );
}
