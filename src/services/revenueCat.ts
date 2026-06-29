import { Platform } from "react-native";
import {
  REVENUECAT_ENTITLEMENT_PRO,
  REVENUECAT_PRO_MONTHLY_PACKAGE_ID,
} from "../constants/proSubscription";

export type PurchasesModule = typeof import("react-native-purchases");
export type CustomerInfo = import("react-native-purchases").CustomerInfo;
export type PurchasesPackage = import("react-native-purchases").PurchasesPackage;

let purchasesMod: PurchasesModule | null | undefined;
let configured = false;

function loadPurchasesModule(): PurchasesModule | null {
  if (purchasesMod !== undefined) return purchasesMod;
  if (Platform.OS === "web") {
    purchasesMod = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    purchasesMod = require("react-native-purchases") as PurchasesModule;
  } catch {
    purchasesMod = null;
  }
  return purchasesMod;
}

export function isRevenueCatSupported(): boolean {
  return loadPurchasesModule() != null;
}

export function getRevenueCatApiKey(): string | null {
  if (Platform.OS === "android") {
    const key = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim();
    return key || null;
  }
  if (Platform.OS === "ios") {
    const key = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim();
    return key || null;
  }
  return null;
}

export function isRevenueCatConfigured(): boolean {
  return configured && isRevenueCatSupported() && getRevenueCatApiKey() != null;
}

export function customerHasProEntitlement(info: CustomerInfo | null | undefined): boolean {
  if (!info) return false;
  return Boolean(info.entitlements.active[REVENUECAT_ENTITLEMENT_PRO]);
}

export async function configureRevenueCat(appUserId: string): Promise<boolean> {
  const mod = loadPurchasesModule();
  const apiKey = getRevenueCatApiKey();
  if (!mod || !apiKey) return false;

  const { default: Purchases, LOG_LEVEL } = mod;
  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }

  if (!configured) {
    Purchases.configure({ apiKey, appUserID: appUserId });
    configured = true;
    return true;
  }

  try {
    await Purchases.logIn(appUserId);
  } catch {
    // same user or transient — entitlement refresh still works
  }
  return true;
}

export async function fetchCustomerInfo(): Promise<CustomerInfo | null> {
  const mod = loadPurchasesModule();
  if (!mod || !configured) return null;
  try {
    const { customerInfo } = await mod.default.getCustomerInfo();
    return customerInfo;
  } catch {
    return null;
  }
}

export async function fetchProMonthlyPackage(): Promise<PurchasesPackage | null> {
  const mod = loadPurchasesModule();
  if (!mod || !configured) return null;
  try {
    const offerings = await mod.default.getOfferings();
    const current = offerings.current;
    if (!current) return null;
    if (current.monthly) return current.monthly;
    const byId = current.availablePackages.find(
      (p) => p.identifier === REVENUECAT_PRO_MONTHLY_PACKAGE_ID
    );
    return byId ?? current.availablePackages[0] ?? null;
  } catch {
    return null;
  }
}

export async function purchaseProPackage(pkg: PurchasesPackage): Promise<CustomerInfo | null> {
  const mod = loadPurchasesModule();
  if (!mod || !configured) return null;
  const { customerInfo } = await mod.default.purchasePackage(pkg);
  return customerInfo;
}

export async function restoreRevenueCatPurchases(): Promise<CustomerInfo | null> {
  const mod = loadPurchasesModule();
  if (!mod || !configured) return null;
  const { customerInfo } = await mod.default.restorePurchases();
  return customerInfo;
}

export async function syncPurchasesFromStore(): Promise<CustomerInfo | null> {
  const mod = loadPurchasesModule();
  if (!mod || !configured) return null;
  try {
    const { customerInfo } = await mod.default.syncPurchasesForResult();
    return customerInfo;
  } catch {
    return null;
  }
}

export async function invalidateAndFetchCustomerInfo(): Promise<CustomerInfo | null> {
  const mod = loadPurchasesModule();
  if (!mod || !configured) return null;
  try {
    await mod.default.invalidateCustomerInfoCache();
  } catch {
    // cache invalidation is best-effort
  }
  return fetchCustomerInfo();
}

/** Play can finish billing before RevenueCat marks the pro entitlement active. */
export async function resolveProEntitlementAfterPurchase(
  info: CustomerInfo | null | undefined
): Promise<CustomerInfo | null> {
  if (customerHasProEntitlement(info)) return info ?? null;

  const synced = await syncPurchasesFromStore();
  if (customerHasProEntitlement(synced)) return synced;

  const restored = await restoreRevenueCatPurchases();
  if (customerHasProEntitlement(restored)) return restored;

  const refreshed = await invalidateAndFetchCustomerInfo();
  if (customerHasProEntitlement(refreshed)) return refreshed;

  return info ?? synced ?? restored ?? refreshed ?? null;
}

export function subscribeToCustomerInfoUpdates(
  listener: (info: CustomerInfo) => void
): () => void {
  const mod = loadPurchasesModule();
  if (!mod || !configured) return () => {};
  mod.default.addCustomerInfoUpdateListener(listener);
  return () => {
    mod.default.removeCustomerInfoUpdateListener(listener);
  };
}

export function getSubscriptionManagementUrl(info: CustomerInfo | null): string | null {
  return info?.managementURL?.trim() || null;
}
