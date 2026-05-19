import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Pressable,
  ActivityIndicator,
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
import { searchProfiles, type SyncProfileSearchResult } from "../services/syncProfileSearch";
import { createSyncRequest, listIncomingSyncRequests, respondSyncRequest, type SyncRequestRow } from "../services/syncRequestService";
import { upsertSyncSnapshot } from "../services/syncSessionService";
import { exportEnabledSyncPayloads } from "../services/syncSnapshotExport";
import { applySyncSnapshots, captureLocalBackupForTools } from "../services/syncSnapshotImport";
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
    searchWrap: {
      marginHorizontal: GRID_PAD,
      marginBottom: 12,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.inputBg,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      paddingHorizontal: 12,
      gap: 8,
    },
    searchInput: { flex: 1, fontSize: 16, color: c.text, paddingVertical: 12 },
    list: { flex: 1, paddingHorizontal: GRID_PAD },
    resultRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    resultName: { fontSize: 16, fontWeight: "700", color: c.text },
    resultTag: { fontSize: 13, color: c.textSecondary, marginTop: 2 },
    empty: { textAlign: "center", color: c.placeholder, marginTop: 24, lineHeight: 22, paddingHorizontal: 20 },
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
  const { refreshSyncState, celebrateSyncConnected, session } = useSyncSession();
  const { refresh: refreshAppData } = useAppData();
  const initialSessionIdRef = useRef<string | undefined>(undefined);
  if (initialSessionIdRef.current === undefined) {
    initialSessionIdRef.current = session?.sessionId;
  }

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SyncProfileSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SyncProfileSearchResult | null>(null);
  const [requestBusy, setRequestBusy] = useState(false);
  const [incoming, setIncoming] = useState<SyncRequestRow[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const deviceIdRef = useRef("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchGenerationRef = useRef(0);

  const loadIncoming = useCallback(async () => {
    const profile = await loadUserProfile();
    deviceIdRef.current = profile.deviceProfileId;
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

  /** Requester: leave Sync search after partner accepts (accepter navigates in handleRespond). */
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

  const runSearch = useCallback(async (q: string) => {
    const generation = ++searchGenerationRef.current;
    if (!isSupabaseConfigured()) {
      setSearching(false);
      setSearchError("Cloud search is not configured.");
      setResults([]);
      return;
    }

    setSearching(true);
    setSearchError(null);

    try {
      const profile = await loadUserProfile();
      if (generation !== searchGenerationRef.current) return;

      void reconcilePublicProfileToCloud(profile);
      deviceIdRef.current = profile.deviceProfileId;
      if (!profile.deviceProfileId?.trim()) {
        setSearchError("Set up your username on this device before searching for others.");
        setResults([]);
        return;
      }

      const res = await searchProfiles(q, profile.deviceProfileId);
      if (generation !== searchGenerationRef.current) return;

      if (!res.ok) {
        setSearchError(res.message);
        setResults([]);
        return;
      }
      setResults(res.results);
    } catch (e) {
      if (generation !== searchGenerationRef.current) return;
      setSearchError(e instanceof Error ? e.message : "Search failed.");
      setResults([]);
    } finally {
      if (generation === searchGenerationRef.current) {
        setSearching(false);
      }
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 1) {
      setResults([]);
      setSearchError(null);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void runSearch(query.trim());
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  const handleRequestSync = async (tools: SyncToolsConfig) => {
    if (!preview) return;
    setRequestBusy(true);
    const created = await createSyncRequest(deviceIdRef.current, preview.deviceProfileId, tools);
    if (!created.ok) {
      setRequestBusy(false);
      showAlert({ title: "Could not send request", message: created.message, variant: "error" });
      return;
    }

    const requestBackup = await captureLocalBackupForTools(tools, vaultSyncAllowed);
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

    const partnerLabel = preview.publicTag || preview.username;
    setRequestBusy(false);
    setPreview(null);
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

    const backup = await captureLocalBackupForTools(req.tools, vaultSyncAllowed);
    const res = await respondSyncRequest(req.id, deviceIdRef.current, true);
    if (!res.ok || !res.sessionId) {
      setRespondingId(null);
      showAlert({ title: "Could not accept", message: res?.ok ? "No session." : res.message, variant: "error" });
      return;
    }

    await saveSyncBackup(res.sessionId, backup);

    const snaps = await listSyncSnapshots(res.sessionId, deviceIdRef.current);
    if (snaps.ok) {
      await applySyncSnapshots(
        snaps.snapshots.map((s) => ({ toolKey: s.toolKey, payload: s.payload })),
        req.tools
      );
      await refreshAppData();
    }

    setRespondingId(null);
    await loadIncoming();
    await refreshSyncState();
    celebrateSyncConnected(req.fromPublicTag || req.fromUsername, res.sessionId);
    navigation.reset({
      index: 0,
      routes: [{ name: "ToolsDashboard" }],
    });
  };

  const listHeader = useMemo(
    () => (
      <View>
        {searching ? <ActivityIndicator style={{ marginVertical: 16 }} color={colors.primary} /> : null}
        {searchError ? <Text style={styles.empty}>{searchError}</Text> : null}
        {!searching && !searchError && query.trim() && results.length === 0 ? (
          <Text style={styles.empty}>No users found. Try a username, @tag, or user ID.</Text>
        ) : null}
      </View>
    ),
    [searching, searchError, query, results.length, colors.primary, styles.empty]
  );

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

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={20} color={colors.placeholder} />
        <TextInput
          style={styles.searchInput}
          placeholder="Username, @tag, or user ID"
          placeholderTextColor={colors.placeholder}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      <FlatList
        style={styles.list}
        data={results}
        keyExtractor={(item) => item.deviceProfileId}
        ListHeaderComponent={listHeader}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable style={styles.resultRow} onPress={() => setPreview(item)}>
            <ProfilePortrait
              profile={{
                avatarLocalUri: null,
                avatarRemoteUrl: item.avatarUrl,
                avatarCharacterId: null,
                avatarPortraitTouched: false,
              }}
              size={44}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.resultName}>{item.username}</Text>
              <Text style={styles.resultTag}>{item.publicTag}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.placeholder} />
          </Pressable>
        )}
      />

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
