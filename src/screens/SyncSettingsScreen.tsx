import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { SyncSettingsProps } from "../navigation/types";
import { useTheme } from "../context/ThemeContext";
import { useAppStyles } from "../hooks/useAppStyles";
import type { AppThemeColors } from "../theme/colors";
import { useAppAlert } from "../context/AppAlertContext";
import { useSyncSession } from "../context/SyncSessionContext";
import { usePrivateVault } from "../context/PrivateVaultContext";
import {
  SYNC_TOOL_IDS,
  SYNC_TOOL_LABELS,
  type SyncToolsConfig,
  hasEnabledSyncTool,
} from "../constants/syncTools";
import VaultSyncPinConfirmModal from "../components/VaultSyncPinConfirmModal";
import {
  VAULT_SYNC_CLOUD_DISCLAIMER,
  VAULT_SYNC_PIN_PROMPT,
  VAULT_SYNC_SAFETY_REASSURANCE,
} from "../constants/vaultSyncDisclosure";

const GRID_PAD = 16;

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
    backBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 8, paddingRight: 8 },
    backText: { fontSize: 16, fontWeight: "600", color: c.linkBlue },
    headerTitle: { fontSize: 22, fontWeight: "800", color: c.text },
    scrollContent: { paddingHorizontal: GRID_PAD, paddingBottom: 32, gap: 16 },
    card: {
      backgroundColor: c.card,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      padding: 16,
      gap: 8,
    },
    partner: { fontSize: 17, fontWeight: "800", color: c.text },
    partnerSub: { fontSize: 14, color: c.textSecondary, lineHeight: 20 },
    sectionTitle: {
      fontSize: 12,
      fontWeight: "800",
      color: c.textTertiary,
      letterSpacing: 0.6,
      marginTop: 8,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    rowLabel: { fontSize: 16, fontWeight: "600", color: c.text, flex: 1 },
    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: StyleSheet.hairlineWidth,
    },
    statusPillOn: {
      backgroundColor: c.totalBg,
      borderColor: c.totalBorder,
    },
    statusPillOff: {
      backgroundColor: c.inputBg,
      borderColor: c.borderMuted,
    },
    statusText: { fontSize: 13, fontWeight: "700" },
    statusTextOn: { color: c.totalLabel },
    statusTextOff: { color: c.textTertiary },
    unsyncBtn: {
      marginTop: 16,
      backgroundColor: c.danger,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
    },
    unsyncText: { color: "#fff", fontSize: 16, fontWeight: "700" },
    saveChangesBtn: {
      marginTop: 16,
      backgroundColor: c.primary,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
    },
    saveChangesText: { color: "#fff", fontSize: 16, fontWeight: "700" },
    discardBtn: {
      marginTop: 10,
      paddingVertical: 12,
      alignItems: "center",
    },
    discardText: { color: c.linkBlue, fontSize: 15, fontWeight: "600" },
  });
}

export default function SyncSettingsScreen({ navigation }: SyncSettingsProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useAppStyles(createStyles);
  const { showAlert } = useAppAlert();
  const { session, updateTools, endSession, celebrateSyncEnded } = useSyncSession();
  const { vaultSyncAllowed, refreshVaultSyncAllowed } = usePrivateVault();
  const [tools, setTools] = useState<SyncToolsConfig>(session?.tools ?? {
    grocery: true,
    todo: true,
    notes: false,
    reminders: false,
    vault: false,
  });
  const [vaultPinModal, setVaultPinModal] = useState(false);
  const toolsSessionIdRef = useRef<string | undefined>(session?.sessionId);

  const isSyncInitiator = session?.isInitiator ?? false;

  const unsavedChanges = useMemo(() => {
    if (!isSyncInitiator || !session) return false;
    return SYNC_TOOL_IDS.some((id) => tools[id] !== session.tools[id]);
  }, [isSyncInitiator, session, tools]);

  useEffect(() => {
    if (!session?.tools) return;
    if (session.sessionId !== toolsSessionIdRef.current) {
      toolsSessionIdRef.current = session.sessionId;
      setTools(session.tools);
      return;
    }
    if (unsavedChanges) return;
    setTools(session.tools);
  }, [session?.tools, session?.sessionId, unsavedChanges]);

  const discardChanges = useCallback(() => {
    if (!session) return;
    setTools({ ...session.tools });
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void refreshVaultSyncAllowed();
    }, [refreshVaultSyncAllowed])
  );

  const toggleTool = useCallback(
    (id: (typeof SYNC_TOOL_IDS)[number], value: boolean) => {
      if (id === "vault" && value) {
        if (!vaultSyncAllowed) {
          showAlert({
            title: "Allow Vault in sync",
            message:
              "Open Vault → Settings and turn on “Include Vault in user sync.” You must enter your vault PIN (not biometrics) to enable it.",
            variant: "warning",
            buttons: [
              { text: "Cancel", style: "cancel" },
              {
                text: "Vault settings",
                onPress: () => navigation.navigate("PrivateVaultSettings"),
              },
            ],
          });
          return;
        }
        setVaultPinModal(true);
        return;
      }
      setTools((prev) => ({ ...prev, [id]: value }));
    },
    [navigation, showAlert, vaultSyncAllowed]
  );

  const saveTools = useCallback(
    async (opts?: { silent?: boolean }): Promise<boolean> => {
      if (!hasEnabledSyncTool(tools)) {
        showAlert({
          title: "Choose tools",
          message: "At least one tool must stay enabled while syncing.",
          variant: "warning",
        });
        return false;
      }
      const res = await updateTools(tools);
      if (!res.ok) {
        showAlert({ title: "Could not update", message: res.message, variant: "error" });
        return false;
      }
      if (!opts?.silent) {
        showAlert({ title: "Saved", message: "Sync tools updated.", variant: "success" });
      }
      return true;
    },
    [tools, updateTools, showAlert]
  );

  useEffect(() => {
    const unsub = navigation.addListener("beforeRemove", (e) => {
      if (!unsavedChanges) return;
      e.preventDefault();
      showAlert({
        title: "Unsaved changes",
        message: "Save your tool changes or discard them before leaving.",
        variant: "warning",
        buttons: [
          { text: "Keep editing", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              discardChanges();
              navigation.dispatch(e.data.action);
            },
          },
          {
            text: "Save",
            onPress: () => {
              void (async () => {
                const ok = await saveTools({ silent: true });
                if (ok) navigation.dispatch(e.data.action);
              })();
            },
          },
        ],
      });
    });
    return unsub;
  }, [navigation, unsavedChanges, discardChanges, showAlert, saveTools]);

  const handleUnsync = () => {
    if (!session) return;
    showAlert({
      title: "End sync?",
      message: isSyncInitiator
        ? "This stops sharing with the other user. Both devices restore the lists each had before sync."
        : "This stops sharing and restores your Listahan from before sync on this device.",
      variant: "warning",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unsync",
          style: "destructive",
          onPress: () => {
            void (async () => {
              const sessionId = session.sessionId;
              const ended = await endSession();
              if (!ended.ok) {
                showAlert({ title: "Could not unsync", message: ended.message, variant: "error" });
                return;
              }
              celebrateSyncEnded(sessionId);
              navigation.goBack();
            })();
          },
        },
      ],
    });
  };

  if (!session) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 8, padding: 24 }]}>
        <Text style={{ color: colors.text }}>No active sync session.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.linkBlue, fontWeight: "600" }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.linkBlue} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sync settings</Text>
        {isSyncInitiator && unsavedChanges ? (
          <Pressable onPress={() => void saveTools()} hitSlop={12}>
            <Text style={{ color: colors.linkBlue, fontWeight: "700", fontSize: 16 }}>Save</Text>
          </Pressable>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.card}>
          <Text style={styles.partner}>Synced with {session.partnerPublicTag || session.partnerUsername}</Text>
          <Text style={styles.partnerSub}>
            {isSyncInitiator
              ? "Changes to enabled tools update in realtime for both of you."
              : "Tool choices are managed on the device that sent the sync request."}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>TOOLS SYNCING</Text>
        <View style={styles.card}>
          {SYNC_TOOL_IDS.map((id) => {
            const enabled = isSyncInitiator ? tools[id] : session.tools[id];
            return (
              <View key={id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>{SYNC_TOOL_LABELS[id]}</Text>
                  {isSyncInitiator && id === "vault" && !vaultSyncAllowed ? (
                    <Text
                      style={[
                        styles.rowLabel,
                        { fontSize: 12, fontWeight: "500", color: colors.textTertiary, marginTop: 4 },
                      ]}
                    >
                      Enable in Vault → Settings (PIN required).
                    </Text>
                  ) : null}
                </View>
                {isSyncInitiator ? (
                  <Switch
                    value={enabled}
                    onValueChange={(v) => toggleTool(id, v)}
                    disabled={id === "vault" && !vaultSyncAllowed}
                    trackColor={{ false: colors.switchTrackOff, true: colors.switchTrackOn }}
                    thumbColor={enabled ? colors.switchThumbOn : colors.switchThumbOff}
                    ios_backgroundColor={colors.iosSwitchBg}
                  />
                ) : (
                  <View
                    style={[styles.statusPill, enabled ? styles.statusPillOn : styles.statusPillOff]}
                    accessibilityRole="text"
                    accessibilityLabel={`${SYNC_TOOL_LABELS[id]}, ${enabled ? "syncing" : "not syncing"}`}
                  >
                    <Ionicons
                      name={enabled ? "checkmark-circle" : "remove-circle-outline"}
                      size={17}
                      color={enabled ? colors.success : colors.textTertiary}
                    />
                    <Text style={[styles.statusText, enabled ? styles.statusTextOn : styles.statusTextOff]}>
                      {enabled ? "On" : "Off"}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {isSyncInitiator && unsavedChanges ? (
          <>
            <Pressable style={styles.saveChangesBtn} onPress={() => void saveTools()} activeOpacity={0.9}>
              <Text style={styles.saveChangesText}>Save changes</Text>
            </Pressable>
            <Pressable style={styles.discardBtn} onPress={discardChanges} accessibilityRole="button">
              <Text style={styles.discardText}>Discard changes</Text>
            </Pressable>
          </>
        ) : (
          <Pressable style={styles.unsyncBtn} onPress={handleUnsync} activeOpacity={0.9}>
            <Text style={styles.unsyncText}>End sync</Text>
          </Pressable>
        )}
      </ScrollView>

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
        confirmLabel="Enable Vault"
      />
    </View>
  );
}
