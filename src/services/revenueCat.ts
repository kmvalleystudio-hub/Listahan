import { Platform } from "react-native";
import {
  GOOGLE_PLAY_PRO_SUBSCRIPTION_IDS,
  REVENUECAT_ENTITLEMENT_PRO,
  REVENUECAT_PRO_MONTHLY_PACKAGE_ID,
} from "../constants/proSubscription";

export type PurchasesModule = typeof import("react-native-purchases");
export type CustomerInfo = import("react-native-purchases").CustomerInfo;
export type PurchasesPackage = import("react-native-purchases").PurchasesPackage;

let purchasesMod: PurchasesModule | null | undefined;
let configured = false;
let configuredAppUserId: string | null = null;

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

function matchesProProductId(productId: string): boolean {
  const id = productId.trim().toLowerCase();
  if (!id) return false;
  return GOOGLE_PLAY_PRO_SUBSCRIPTION_IDS.some((sku) => id === sku.toLowerCase() || id.startsWith(`${sku.toLowerCase()}:`));
}

function subscriptionRecordIsActive(
  sub: NonNullable<CustomerInfo["subscriptionsByProductIdentifier"]>[string] | undefined
): boolean {
  if (!sub) return false;
  if (sub.refundedAt) return false;
  if (!sub.expiresDate) return true;
  return new Date(sub.expiresDate).getTime() > Date.now();
}

/** RevenueCat entitlement `pro` is active. */
export function customerHasProEntitlement(info: CustomerInfo | null | undefined): boolean {
  if (!info) return false;
  if (info.entitlements.active[REVENUECAT_ENTITLEMENT_PRO]) return true;
  const all = info.entitlements.all[REVENUECAT_ENTITLEMENT_PRO];
  return Boolean(all?.isActive);
}

/** Pro access for ad-free — entitlement or an active Play subscription synced into CustomerInfo. */
export function customerHasProAccess(info: CustomerInfo | null | undefined): boolean {
  if (!info) return false;
  if (customerHasProEntitlement(info)) return true;

  if ((info.activeSubscriptions ?? []).some(matchesProProductId)) return true;

  for (const sku of GOOGLE_PLAY_PRO_SUBSCRIPTION_IDS) {
    if (subscriptionRecordIsActive(info.subscriptionsByProductIdentifier[sku])) return true;
  }

  for (const [productId, sub] of Object.entries(info.subscriptionsByProductIdentifier ?? {})) {
    if (matchesProProductId(productId) && subscriptionRecordIsActive(sub)) return true;
  }

  return false;
}

export function describeProSyncState(info: CustomerInfo | null | undefined): string {
  if (!info) return "No RevenueCat customer info.";
  if (customerHasProAccess(info)) return "Pro is active on this device.";
  const subs = info.activeSubscriptions ?? [];
  const rcId = configuredAppUserId ?? info.originalAppUserId ?? "unknown";
  if (subs.length > 0) {
    return `Play subscription(s): ${subs.join(", ")}. RevenueCat user: ${rcId}.`;
  }
  return `No Play subscription on this billing account. RevenueCat user: ${rcId}.`;
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
    configuredAppUserId = appUserId;
    return true;
  }

  if (configuredAppUserId === appUserId) {
    return true;
  }

  try {
    await Purchases.logIn(appUserId);
    configuredAppUserId = appUserId;
  } catch {
    // keep previous session if login fails
  }
  return true;
}

export function getConfiguredRevenueCatAppUserId(): string | null {
  return configuredAppUserId;
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Android-first: sync Play billing, then restore, with retries for RC propagation. */
export async function restoreAndSyncProFromStore(): Promise<CustomerInfo | null> {
  const attempts: Array<() => Promise<CustomerInfo | null>> =
    Platform.OS === "android"
      ? [
          () => syncPurchasesFromStore(),
          () => restoreRevenueCatPurchases(),
          () => syncPurchasesFromStore(),
          async () => {
            await delay(2000);
            return syncPurchasesFromStore();
          },
          async () => {
            await delay(4000);
            return syncPurchasesFromStore();
          },
          () => invalidateAndFetchCustomerInfo(),
        ]
      : [
          () => restoreRevenueCatPurchases(),
          () => syncPurchasesFromStore(),
          () => invalidateAndFetchCustomerInfo(),
        ];

  let last: CustomerInfo | null = null;
  for (const attempt of attempts) {
    try {
      last = (await attempt()) ?? last;
    } catch {
      // try next strategy
    }
    if (customerHasProAccess(last)) return last;
  }
  return last;
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
  if (customerHasProAccess(info)) return info ?? null;
  return restoreAndSyncProFromStore();
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
