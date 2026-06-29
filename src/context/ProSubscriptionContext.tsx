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
  customerHasProEntitlement,
  fetchCustomerInfo,
  fetchProMonthlyPackage,
  getRevenueCatApiKey,
  getSubscriptionManagementUrl,
  isRevenueCatSupported,
  purchaseProPackage,
  resolveProEntitlementAfterPurchase,
  restoreRevenueCatPurchases,
  subscribeToCustomerInfoUpdates,
  syncPurchasesFromStore,
} from "../services/revenueCat";
import { loadUserProfile } from "../utils/userProfileStorage";

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
    setIsProAdFree(customerHasProEntitlement(info));
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
      const profile = await loadUserProfile();
      const ok = await configureRevenueCat(profile.deviceProfileId);
      if (!ok) return;
      const [info, pkg] = await Promise.all([fetchCustomerInfo(), fetchProMonthlyPackage()]);
      applyCustomerInfo(info);
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
    try {
      const info = await purchaseProPackage(monthlyPackage);
      const resolved = await resolveProEntitlementAfterPurchase(info);
      applyCustomerInfo(resolved);
      if (customerHasProEntitlement(resolved)) {
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
        const resolved = await resolveProEntitlementAfterPurchase(null);
        applyCustomerInfo(resolved);
        if (customerHasProEntitlement(resolved)) {
          return { ok: true, activated: true };
        }
      }
      return { ok: false, message: purchaseErrorMessage(e) };
    }
  }, [applyCustomerInfo, billingReady, monthlyPackage]);

  const restorePurchases = useCallback(async (): Promise<PurchaseResult> => {
    if (!billingReady) {
      return { ok: false, message: "Subscriptions are not available in this build yet." };
    }
    try {
      let info = await restoreRevenueCatPurchases();
      if (!customerHasProEntitlement(info)) {
        info = (await syncPurchasesFromStore()) ?? info;
      }
      if (!customerHasProEntitlement(info)) {
        info = (await resolveProEntitlementAfterPurchase(info)) ?? info;
      }
      applyCustomerInfo(info);
      if (customerHasProEntitlement(info)) {
        return { ok: true, activated: true };
      }
      return { ok: false, message: "No active Pro subscription found for this account." };
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
