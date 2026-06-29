/** RevenueCat entitlement — unlocks ad-free (AI entitlement added later). */
export const REVENUECAT_ENTITLEMENT_PRO = "pro";

/** Preferred monthly package id in RevenueCat / Play Console (fallback: first package in offering). */
export const REVENUECAT_PRO_MONTHLY_PACKAGE_ID = "listahan_pro_monthly";

/** Google Play subscription product ids (base plan suffix included when Play sends it). */
export const GOOGLE_PLAY_PRO_SUBSCRIPTION_IDS = [
  "listahan_pro_monthly",
  "listahan_pro_monthly:monthly",
] as const;

export const PRO_PLAN_DISPLAY_NAME = "Listahan Pro";

export const PRO_PLAN_TAGLINE = "Ad-free — AI features coming later for Pro subscribers.";
