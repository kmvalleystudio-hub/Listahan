import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, Platform } from "react-native";
import type { CustomerInfo, PurchasesPackage } from "../services/revenueCat";
import {
  configureRevenueCat,
  customerHasProAccess,
  describeProSyncState,
  fetchCustomerInfo,
  fetchProMonthlyPackage,
  getRevenueCatApiKey,
  getSubscriptionManagementUrl,
  isRevenueCatSupported,
  purchaseProPackage,
  resolveProEntitlementAfterPurchase,
  restoreAndSyncProFromStore,
  subscribeToCustomerInfoUpdates,
} from "../services/revenueCat";
import { getOrCreateRevenueCatAppUserId } from "../utils/revenueCatAppUserId";

type ProSubscriptionContextValue = {
  /** Native billing available and API key present. */
  billingReady: boolean;
  loading: boolean;
  isProAdFree: boolean;
  monthlyPackage: PurchasesPackage | null;
  customerInfo: CustomerInfo | null;
  refresh: () => Promise<void>;
  purchasePro: () => Promise<PurchaseResult>;
  restorePurchases: () => Promise<PurchaseResult>;
  managementUrl: string | null;
};

const ProSubscriptionContext = createContext<ProSubscriptionContextValue | null>(null);

type PurchaseResult = {
  ok: boolean;
  activated?: boolean;
  cancelled?: boolean;
  message?: string;
};

function isAlreadySubscribedError(message: string | undefined): boolean {
  if (!message) return false;
  return /already subscribed|item already owned|already own/i.test(message);
}

function purchaseErrorMessage(e: unknown): string {
  const err = e as { userCancelled?: boolean; message?: string };
  if (err?.userCancelled) return "";
  const msg = typeof err?.message === "string" ? err.message : "";
  if (isAlreadySubscribedError(msg)) {
    return "You're already subscribed. Tap Restore purchases to sync Pro on this device.";
  }
  if (msg) return msg;
  return "Purchase could not be completed. Try again or restore purchases.";
}

export function ProSubscriptionProvider({ children }: { children: React.ReactNode }) {
  const billingReady =
    Platform.OS !== "web" && isRevenueCatSupported() && getRevenueCatApiKey() != null;

  const [loading, setLoading] = useState(billingReady);
  const [isProAdFree, setIsProAdFree] = useState(false);
  const [monthlyPackage, setMonthlyPackage] = useState<PurchasesPackage | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);

  const applyCustomerInfo = useCallback((info: CustomerInfo | null) => {
    setCustomerInfo(info);
    setIsProAdFree(customerHasProAccess(info));
  }, []);

  const applyCustomerInfoRef = useRef(applyCustomerInfo);
  applyCustomerInfoRef.current = applyCustomerInfo;

  const refresh = useCallback(async () => {
    if (!billingReady) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const revenueCatUserId = await getOrCreateRevenueCatAppUserId();
      const ok = await configureRevenueCat(revenueCatUserId);
      if (!ok) return;
      const [info, pkg] = await Promise.all([fetchCustomerInfo(), fetchProMonthlyPackage()]);
      const synced = customerHasProAccess(info) ? info : await resolveProEntitlementAfterPurchase(info);
      applyCustomerInfo(synced);
      setMonthlyPackage(pkg);
    } finally {
      setLoading(false);
    }
  }, [applyCustomerInfo, billingReady]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!billingReady) return;
    return subscribeToCustomerInfoUpdates((info) => {
      applyCustomerInfoRef.current(info);
    });
  }, [billingReady]);

  useEffect(() => {
    if (!billingReady) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => sub.remove();
  }, [billingReady, refresh]);

  const purchasePro = useCallback(async (): Promise<PurchaseResult> => {
    if (!billingReady) {
      return { ok: false, message: "Subscriptions are not available in this build yet." };
    }
    if (!monthlyPackage) {
      return {
        ok: false,
        message: "Pro plan is not set up in the store yet. Try again after the next app update.",
      };
    }
    const existing = await restoreAndSyncProFromStore();
    if (customerHasProAccess(existing)) {
      applyCustomerInfo(existing);
      return { ok: true, activated: true };
    }
    try {
      const info = await purchaseProPackage(monthlyPackage);
      const resolved = await resolveProEntitlementAfterPurchase(info);
      applyCustomerInfo(resolved);
      if (customerHasProAccess(resolved)) {
        return { ok: true, activated: true };
      }
      return {
        ok: false,
        message:
          "Payment went through but Pro is still syncing. Tap Restore purchases or reopen Settings in a minute.",
      };
    } catch (e) {
      const err = e as { userCancelled?: boolean; message?: string };
      if (err?.userCancelled) {
        return { ok: false, message: "", cancelled: true };
      }
      if (isAlreadySubscribedError(err?.message)) {
        const resolved = await restoreAndSyncProFromStore();
        applyCustomerInfo(resolved);
        if (customerHasProAccess(resolved)) {
          return { ok: true, activated: true };
        }
        return {
          ok: false,
          message:
            "Play says you're already subscribed, but Pro didn't sync yet. " +
            "Confirm the same Google account as Play → Subscriptions, wait a minute, then tap Restore again. " +
            describeProSyncState(resolved),
        };
      }
      return { ok: false, message: purchaseErrorMessage(e) };
    }
  }, [applyCustomerInfo, billingReady, monthlyPackage]);

  const restorePurchases = useCallback(async (): Promise<PurchaseResult> => {
    if (!billingReady) {
      return { ok: false, message: "Subscriptions are not available in this build yet." };
    }
    try {
      const info = await restoreAndSyncProFromStore();
      applyCustomerInfo(info);
      if (customerHasProAccess(info)) {
        return { ok: true, activated: true };
      }
      return {
        ok: false,
        message:
          "Google Play shows no active Listahan Pro for this device account. " +
          "Use the same Google account as Play → Subscriptions, then try again. " +
          describeProSyncState(info),
      };
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : "Could not restore purchases.",
      };
    }
  }, [applyCustomerInfo, billingReady]);

  const managementUrl = useMemo(() => getSubscriptionManagementUrl(customerInfo), [customerInfo]);

  const value = useMemo(
    () => ({
      billingReady,
      loading,
      isProAdFree,
      monthlyPackage,
      customerInfo,
      refresh,
      purchasePro,
      restorePurchases,
      managementUrl,
    }),
    [
      billingReady,
      loading,
      isProAdFree,
      monthlyPackage,
      customerInfo,
      refresh,
      purchasePro,
      restorePurchases,
      managementUrl,
    ]
  );

  return <ProSubscriptionContext.Provider value={value}>{children}</ProSubscriptionContext.Provider>;
}

export function useProSubscription(): ProSubscriptionContextValue {
  const ctx = useContext(ProSubscriptionContext);
  if (!ctx) {
    throw new Error("useProSubscription must be used within ProSubscriptionProvider");
  }
  return ctx;
}

/** Ad-free gate for future AdMob — false when billing unavailable. */
export function useIsProAdFree(): boolean {
  const ctx = useContext(ProSubscriptionContext);
  return ctx?.isProAdFree ?? false;
}
