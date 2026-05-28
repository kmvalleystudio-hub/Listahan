import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSyncSession } from "../context/SyncSessionContext";
import { useTheme } from "../context/ThemeContext";

/** Shown only while merging new partner snapshot data (Realtime), not on background catch-up polls. */
export default function SyncPartnerRefreshBar() {
  const { partnerRefreshing, session } = useSyncSession();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  if (!session || !partnerRefreshing) return null;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          top: insets.top,
          backgroundColor: colors.bg,
          borderBottomColor: colors.border,
        },
      ]}
      accessibilityLiveRegion="polite"
      accessibilityLabel="Refreshing changes from your sync partner"
    >
      <ActivityIndicator size="small" color={colors.linkBlue} />
      <Text style={[styles.text, { color: colors.textSecondary }]}>Refreshing…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: {
    fontSize: 13,
    fontWeight: "600",
  },
});
