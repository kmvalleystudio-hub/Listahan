import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import type { SyncSearchProps } from "../navigation/types";
import { useTheme } from "../context/ThemeContext";
import { useAppStyles } from "../hooks/useAppStyles";
import type { AppThemeColors } from "../theme/colors";
import { useAppAlert } from "../context/AppAlertContext";
import { usePrivateVault } from "../context/PrivateVaultContext";
import { useSyncSession } from "../context/SyncSessionContext";
import { lookupProfileByPublicTag, type SyncProfileSearchResult } from "../services/syncProfileSearch";
import { listahanPublicTag, parsePublicTagInput } from "../utils/userProfileStorage";
import { createSyncRequest, listIncomingSyncRequests, respondSyncRequest, type SyncRequestRow } from "../services/syncRequestService";
import { upsertSyncSnapshot } from "../services/syncSessionService";
import { exportEnabledSyncPayloads } from "../services/syncSnapshotExport";
import { applyInitiatorSnapshotsOnAccept, captureFullLocalBackup } from "../services/syncSnapshotImport";
import { saveSyncBackup } from "../utils/syncBackupStorage";
import { listSyncSnapshots } from "../services/syncSessionService";
import { reconcilePublicProfileToCloud } from "../services/profileCloudSync";
import { loadUserProfile } from "../utils/userProfileStorage";
import { isSupabaseConfigured } from "../services/supabaseClient";
import SyncUserPreviewModal from "../components/SyncUserPreviewModal";
import { ProfilePortrait } from "../components/ProfilePortrait";
import type { SyncToolsConfig } from "../constants/syncTools";
import { useAppData } from "../context/AppDataContext";

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
    body: { flex: 1, paddingHorizontal: GRID_PAD },
    intro: {
      fontSize: 15,
      color: c.textSecondary,
      lineHeight: 22,
      marginBottom: 16,
    },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.inputBg,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      paddingHorizontal: 12,
      gap: 8,
      marginBottom: 12,
    },
    tagPrefix: { fontSize: 16, fontWeight: "700", color: c.text },
    input: { flex: 1, fontSize: 16, color: c.text, paddingVertical: 12 },
    lookupBtn: {
      backgroundColor: c.primary,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
      marginBottom: 16,
    },
    lookupBtnDisabled: { opacity: 0.55 },
    lookupBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
    errorText: {
      color: c.danger,
      fontSize: 14,
      fontWeight: "600",
      lineHeight: 20,
      marginBottom: 12,
    },
    foundCard: {
      backgroundColor: c.card,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      padding: 16,
      gap: 14,
    },
    foundHero: { flexDirection: "row", alignItems: "center", gap: 12 },
    foundName: { fontSize: 18, fontWeight: "800", color: c.text },
    foundTag: { fontSize: 14, fontWeight: "600", color: c.textSecondary, marginTop: 2 },
    metaBlock: { gap: 4 },
    metaLabel: {
      fontSize: 11,
      fontWeight: "800",
      color: c.textTertiary,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    metaValue: { fontSize: 14, fontWeight: "600", color: c.text, lineHeight: 20 },
    foundActions: { flexDirection: "row", gap: 10, marginTop: 4 },
    secondaryBtn: {
      flex: 1,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
      backgroundColor: c.inputBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    secondaryBtnText: { fontSize: 15, fontWeight: "700", color: c.text },
    primaryBtn: {
      flex: 1,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
      backgroundColor: c.primary,
    },
    primaryBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
    resultName: { fontSize: 16, fontWeight: "700", color: c.text },
    resultTag: { fontSize: 13, color: c.textSecondary, marginTop: 2 },
    incoming: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      backgroundColor: c.card,
      paddingHorizontal: GRID_PAD,
      paddingTop: 12,
      maxHeight: 240,
    },
    incomingTitle: {
      fontSize: 12,
      fontWeight: "800",
      color: c.textTertiary,
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    incomingCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    incomingActions: { flexDirection: "row", gap: 8 },
    acceptBtn: {
      backgroundColor: c.primary,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    rejectBtn: {
      backgroundColor: c.inputBg,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    acceptText: { color: "#fff", fontWeight: "700", fontSize: 13 },
    rejectText: { color: c.text, fontWeight: "700", fontSize: 13 },
  });
}

export default function SyncSearchScreen({ navigation }: SyncSearchProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useAppStyles(createStyles);
  const { showAlert } = useAppAlert();
  const { vaultSyncAllowed, refreshVaultSyncAllowed } = usePrivateVault();
  const { refreshSyncState, celebrateSyncConnected, session, runDuringSyncAccept, seedSnapshotVersions } =
    useSyncSession();
  const { refresh: refreshAppData } = useAppData();
  const initialSessionIdRef = useRef<string | undefined>(undefined);
  if (initialSessionIdRef.current === undefined) {
    initialSessionIdRef.current = session?.sessionId;
  }

  const [tagInput, setTagInput] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [foundUser, setFoundUser] = useState<SyncProfileSearchResult | null>(null);
  const [preview, setPreview] = useState<SyncProfileSearchResult | null>(null);
  const [requestBusy, setRequestBusy] = useState(false);
  const [incoming, setIncoming] = useState<SyncRequestRow[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const deviceIdRef = useRef("");
  const localUsernameRef = useRef("");

  const loadIncoming = useCallback(async () => {
    const profile = await loadUserProfile();
    deviceIdRef.current = profile.deviceProfileId;
    localUsernameRef.current = profile.username.trim().toLowerCase();
    void reconcilePublicProfileToCloud(profile);
    const listed = await listIncomingSyncRequests(profile.deviceProfileId);
    if (listed.ok) setIncoming(listed.requests);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadIncoming();
      void refreshSyncState();
      void refreshVaultSyncAllowed();
    }, [loadIncoming, refreshSyncState, refreshVaultSyncAllowed])
  );

  /** Requester: leave Sync after partner accepts (accepter navigates in handleRespond). */
  useEffect(() => {
    const sid = session?.sessionId;
    if (!sid || sid === initialSessionIdRef.current) return;
    initialSessionIdRef.current = sid;
    const timer = setTimeout(() => {
      navigation.reset({
        index: 0,
        routes: [{ name: "ToolsDashboard" }],
      });
    }, 2600);
    return () => clearTimeout(timer);
  }, [session?.sessionId, navigation]);

  const clearFound = useCallback(() => {
    setFoundUser(null);
    setLookupError(null);
  }, []);

  const onTagInputChange = useCallback(
    (text: string) => {
      let next = text.trimStart().toLowerCase();
      if (next.startsWith("@")) next = next.slice(1);
      setTagInput(next);
      if (foundUser || lookupError) clearFound();
    },
    [foundUser, lookupError, clearFound]
  );

  const runLookup = useCallback(async () => {
    Keyboard.dismiss();
    clearFound();

    if (!isSupabaseConfigured()) {
      setLookupError("Cloud sync is not configured on this build.");
      return;
    }

    const parsedTag = parsePublicTagInput(tagInput);
    if (!parsedTag.ok) {
      setLookupError(parsedTag.message);
      return;
    }

    setLookupBusy(true);
    try {
      const profile = await loadUserProfile();
      void reconcilePublicProfileToCloud(profile);
      deviceIdRef.current = profile.deviceProfileId;
      localUsernameRef.current = profile.username.trim().toLowerCase();

      if (!profile.deviceProfileId?.trim()) {
        setLookupError("Set up your username on this device before requesting sync.");
        return;
      }

      const myTag = listahanPublicTag(profile.username, profile.tagSuffix);
      if (myTag && myTag.toLowerCase() === parsedTag.parsed.publicTag) {
        setLookupError("You cannot send a sync request to your own account.");
        return;
      }

      const res = await lookupProfileByPublicTag(
        parsedTag.parsed.username,
        parsedTag.parsed.tagSuffix,
        profile.deviceProfileId
      );
      if (!res.ok) {
        if (res.notFound) {
          setLookupError(
            "Incorrect tag — no user with this public tag exists. Copy it exactly from their Profile."
          );
        } else {
          setLookupError(res.message);
        }
        return;
      }

      setFoundUser(res.profile);
    } catch (e) {
      setLookupError(e instanceof Error ? e.message : "Lookup failed.");
    } finally {
      setLookupBusy(false);
    }
  }, [tagInput, clearFound]);

  const handleRequestSync = async (tools: SyncToolsConfig) => {
    const target = preview ?? foundUser;
    if (!target) return;
    setRequestBusy(true);
    const created = await createSyncRequest(deviceIdRef.current, target.deviceProfileId, tools);
    if (!created.ok) {
      setRequestBusy(false);
      showAlert({ title: "Could not send request", message: created.message, variant: "error" });
      return;
    }

    const requestBackup = await captureFullLocalBackup(vaultSyncAllowed);
    await saveSyncBackup(created.requestId, requestBackup);

    const payloads = await exportEnabledSyncPayloads(tools, vaultSyncAllowed);
    for (const [tool, payload] of Object.entries(payloads)) {
      await upsertSyncSnapshot({
        actorId: deviceIdRef.current,
        requestId: created.requestId,
        toolKey: tool,
        payload,
      });
    }

    const partnerLabel = target.publicTag || target.username;
    setRequestBusy(false);
    setPreview(null);
    setFoundUser(null);
    setTagInput("");
    showAlert({
      title: "Request sent",
      message: `Waiting for ${partnerLabel} to accept.`,
      variant: "success",
      buttons: [
        {
          text: "OK",
          onPress: () => {
            navigation.reset({
              index: 0,
              routes: [{ name: "ToolsDashboard" }],
            });
          },
        },
      ],
    });
  };

  const handleRespond = async (req: SyncRequestRow, accept: boolean) => {
    setRespondingId(req.id);
    if (!accept) {
      const res = await respondSyncRequest(req.id, deviceIdRef.current, false);
      setRespondingId(null);
      if (!res.ok) {
        showAlert({ title: "Could not reject", message: res.message, variant: "error" });
        return;
      }
      await loadIncoming();
      await refreshSyncState();
      return;
    }

    const recipientId = deviceIdRef.current;
    let acceptedSessionId: string | undefined;
    await runDuringSyncAccept(async () => {
      const backup = await captureFullLocalBackup(vaultSyncAllowed);
      const res = await respondSyncRequest(req.id, recipientId, true);
      if (!res.ok || !res.sessionId) {
        showAlert({
          title: "Could not accept",
          message: res?.ok ? "No session." : res.message,
          variant: "error",
        });
        return;
      }
      acceptedSessionId = res.sessionId;

      await saveSyncBackup(res.sessionId, backup);
      if (req.id !== res.sessionId) {
        await saveSyncBackup(req.id, backup);
      }

      const snaps = await listSyncSnapshots(res.sessionId, recipientId);
      if (snaps.ok) {
        const applied = await applyInitiatorSnapshotsOnAccept(snaps.snapshots, req.fromDeviceId, req.tools);
        seedSnapshotVersions(res.sessionId, applied);
        await refreshAppData();
      }
    });

    setRespondingId(null);
    if (!acceptedSessionId) return;

    await loadIncoming();
    await refreshSyncState();
    celebrateSyncConnected(req.fromPublicTag || req.fromUsername, acceptedSessionId);
    navigation.reset({
      index: 0,
      routes: [{ name: "ToolsDashboard" }],
    });
  };

  const canLookup = parsePublicTagInput(tagInput).ok && !lookupBusy;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.linkBlue} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sync</Text>
        <View style={{ width: 64 }} />
      </View>

      <ScrollView
        style={styles.body}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          Enter their full public tag from Profile (e.g. mike_t1ci — the part after @). There is no user search;
          it must match exactly.
        </Text>

        <View style={styles.inputWrap}>
          <Text style={styles.tagPrefix}>@</Text>
          <TextInput
            style={styles.input}
            placeholder="mike_t1ci"
            placeholderTextColor={colors.placeholder}
            value={tagInput}
            onChangeText={onTagInputChange}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => void runLookup()}
            editable={!lookupBusy}
          />
        </View>

        <Pressable
          style={[styles.lookupBtn, !canLookup && styles.lookupBtnDisabled]}
          disabled={!canLookup}
          onPress={() => void runLookup()}
          accessibilityRole="button"
          accessibilityLabel="Look up public tag"
        >
          {lookupBusy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.lookupBtnText}>Look up</Text>
          )}
        </Pressable>

        {lookupError ? <Text style={styles.errorText}>{lookupError}</Text> : null}

        {foundUser ? (
          <View style={styles.foundCard}>
            <View style={styles.foundHero}>
              <ProfilePortrait
                profile={{
                  avatarLocalUri: null,
                  avatarRemoteUrl: foundUser.avatarUrl,
                  avatarCharacterId: null,
                  avatarPortraitTouched: false,
                }}
                size={52}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.foundName}>{foundUser.username}</Text>
                {foundUser.publicTag ? (
                  <Text style={styles.foundTag}>{foundUser.publicTag}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Public tag</Text>
              <Text style={styles.metaValue} selectable>
                {foundUser.publicTag || tagInput.trim()}
              </Text>
            </View>
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>User ID</Text>
              <Text style={styles.metaValue} selectable>
                {foundUser.deviceProfileId}
              </Text>
            </View>

            <View style={styles.foundActions}>
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => {
                  clearFound();
                  setTagInput("");
                }}
                accessibilityRole="button"
                accessibilityLabel="Change username"
              >
                <Text style={styles.secondaryBtnText}>Change</Text>
              </Pressable>
              <Pressable
                style={styles.primaryBtn}
                onPress={() => setPreview(foundUser)}
                accessibilityRole="button"
                accessibilityLabel="Continue to send sync request"
              >
                <Text style={styles.primaryBtnText}>Send request</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {incoming.length > 0 ? (
        <View style={[styles.incoming, { paddingBottom: insets.bottom + 12 }]}>
          <Text style={styles.incomingTitle}>INCOMING REQUESTS</Text>
          <FlatList
            data={incoming}
            keyExtractor={(r) => r.id}
            renderItem={({ item }) => (
              <View style={styles.incomingCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultName}>{item.fromUsername}</Text>
                  <Text style={styles.resultTag}>{item.fromPublicTag}</Text>
                </View>
                <View style={styles.incomingActions}>
                  <Pressable
                    style={styles.rejectBtn}
                    disabled={respondingId === item.id}
                    onPress={() => void handleRespond(item, false)}
                  >
                    <Text style={styles.rejectText}>Reject</Text>
                  </Pressable>
                  <Pressable
                    style={styles.acceptBtn}
                    disabled={respondingId === item.id}
                    onPress={() => void handleRespond(item, true)}
                  >
                    {respondingId === item.id ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.acceptText}>Accept</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            )}
          />
        </View>
      ) : null}

      <SyncUserPreviewModal
        visible={!!preview}
        colors={colors}
        profile={preview}
        vaultSyncAllowed={vaultSyncAllowed}
        busy={requestBusy}
        onClose={() => setPreview(null)}
        onOpenVaultSettings={() => {
          setPreview(null);
          navigation.navigate("PrivateVaultSettings");
        }}
        onRequestSync={(tools) => void handleRequestSync(tools)}
      />
    </View>
  );
}
