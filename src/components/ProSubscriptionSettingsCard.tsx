import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { AppThemeColors } from "../theme/colors";
import { useProSubscription } from "../context/ProSubscriptionContext";
import {
  PRO_PLAN_DISPLAY_NAME,
  PRO_PLAN_TAGLINE,
} from "../constants/proSubscription";

type Props = {
  colors: AppThemeColors;
  styles: {
    card: object;
    row: object;
    rowLast: object;
    rowBody: object;
    rowTitle: object;
    rowSubtitle: object;
    proBadge: object;
    proBadgeText: object;
    proCta: object;
    proCtaText: object;
    proLink: object;
    proLinkText: object;
  };
};

export function createProSubscriptionStyles(c: AppThemeColors) {
  return {
    proBadge: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: c.iconBlobBg,
    },
    proBadgeText: {
      fontSize: 12,
      fontWeight: "800" as const,
      color: c.primary,
      letterSpacing: 0.3,
    },
    proCta: {
      marginTop: 4,
      marginHorizontal: 16,
      marginBottom: 14,
      backgroundColor: c.primary,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center" as const,
    },
    proCtaText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "800" as const,
    },
    proLink: {
      alignItems: "center" as const,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    proLinkText: {
      fontSize: 15,
      fontWeight: "600" as const,
      color: c.linkBlue,
    },
  };
}

export default function ProSubscriptionSettingsCard({ colors, styles }: Props) {
  const {
    billingReady,
    loading,
    isProAdFree,
    monthlyPackage,
    purchasePro,
    restorePurchases,
    managementUrl,
  } = useProSubscription();
  const [busy, setBusy] = useState(false);

  if (Platform.OS === "web") {
    return (
      <View style={styles.card}>
        <View style={[styles.row, styles.rowLast]}>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>{PRO_PLAN_DISPLAY_NAME}</Text>
            <Text style={styles.rowSubtitle}>Subscriptions are managed in the Android or iOS app.</Text>
          </View>
        </View>
      </View>
    );
  }

  if (!billingReady) {
    return (
      <View style={styles.card}>
        <View style={[styles.row, styles.rowLast]}>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>{PRO_PLAN_DISPLAY_NAME}</Text>
            <Text style={styles.rowSubtitle}>
              Ad-free Pro will appear here once RevenueCat keys are added to this build.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const priceLabel = monthlyPackage?.product.priceString;

  const onPurchase = () => {
    void (async () => {
      setBusy(true);
      try {
        const res = await purchasePro();
        if (res.ok && res.activated) {
          Alert.alert("Welcome to Pro", "Ads are off on this device. AI perks will arrive in a later update.");
        } else if (!res.cancelled && res.message) {
          Alert.alert(res.message.includes("Restore") ? "Sync Pro" : "Could not subscribe", res.message);
        }
      } finally {
        setBusy(false);
      }
    })();
  };

  const onRestore = () => {
    void (async () => {
      setBusy(true);
      try {
        const res = await restorePurchases();
        if (res.ok && res.activated) {
          Alert.alert("Restored", "Your Pro subscription is active on this device.");
        } else {
          Alert.alert("Restore", res.message ?? "No active Pro subscription found.");
        }
      } finally {
        setBusy(false);
      }
    })();
  };

  const onManage = () => {
    if (!managementUrl) {
      Alert.alert(
        "Manage subscription",
        "Open Google Play → Payments & subscriptions → Subscriptions to manage Listahan Pro."
      );
      return;
    }
    void Linking.openURL(managementUrl);
  };

  return (
    <View style={styles.card}>
      <View style={[styles.row, isProAdFree ? styles.rowLast : undefined]}>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle}>{PRO_PLAN_DISPLAY_NAME}</Text>
          <Text style={styles.rowSubtitle}>{PRO_PLAN_TAGLINE}</Text>
        </View>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : isProAdFree ? (
          <View style={styles.proBadge}>
            <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
            <Text style={styles.proBadgeText}>Active</Text>
          </View>
        ) : null}
      </View>

      {!isProAdFree ? (
        <>
          <Pressable
            style={[styles.proCta, (busy || loading || !monthlyPackage) && { opacity: 0.7 }]}
            disabled={busy || loading || !monthlyPackage}
            onPress={onPurchase}
            accessibilityRole="button"
            accessibilityLabel={`Subscribe to ${PRO_PLAN_DISPLAY_NAME}`}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.proCtaText}>
                {priceLabel ? `Go ad-free · ${priceLabel}/mo` : "Go ad-free"}
              </Text>
            )}
          </Pressable>
          <Pressable
            style={styles.proLink}
            onPress={onRestore}
            disabled={busy}
            accessibilityRole="button"
          >
            <Text style={styles.proLinkText}>Restore purchases</Text>
          </Pressable>
        </>
      ) : (
        <Pressable
          style={[styles.proLink, styles.rowLast]}
          onPress={onManage}
          accessibilityRole="button"
        >
          <Text style={styles.proLinkText}>Manage subscription</Text>
        </Pressable>
      )}
    </View>
  );
}
