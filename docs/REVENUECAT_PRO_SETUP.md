# Listahan Pro (ad-free) — RevenueCat setup

Ad-free **Listahan Pro** uses [RevenueCat](https://www.revenuecat.com/) on top of **Google Play Billing**. AI features can be added later on the same `pro` entitlement.

## App constants (must match dashboard)

| Item | Value |
|------|--------|
| Entitlement | `pro` |
| Package id (preferred) | `listahan_pro_monthly` |
| Play product id (example) | `listahan_pro_monthly` |

Code: `src/constants/proSubscription.ts`

## 1. RevenueCat project

1. Create a project at [app.revenuecat.com](https://app.revenuecat.com).
2. Add **Android app** with package name `com.saycart.app`.
3. Connect **Google Play** (service account JSON — RevenueCat docs walk through this).
4. **Entitlements** → create entitlement identifier: `pro`.
5. **Products** → add subscription linked to Play product `listahan_pro_monthly`.
6. **Offerings** → default offering → add monthly package `listahan_pro_monthly` → attach product → grant entitlement `pro`.
7. Copy **Google Play API key** from RevenueCat → Project settings → API keys.

## 2. Google Play Console

1. **Monetize → Products → Subscriptions** → Create subscription.
2. Product ID: `listahan_pro_monthly` (must match RevenueCat).
3. Set price (e.g. ~$1/month per your Plan A).
4. Activate the subscription.
5. Add **license testers** (Settings → License testing) for sandbox purchases.

## 3. Environment variables

Add to `.env` (and EAS **production** / **preview** for store builds):

```env
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_xxxxxxxx
# When you ship iOS:
# EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_xxxxxxxx
```

Sync to EAS:

```powershell
cd C:\SayCart
npm run eas:env:sync
# Also add keys to production in Expo dashboard or extend the sync script.
```

Rebuild after any env change:

```powershell
npm run build:aab
```

## 4. Testing

- **Expo Go** does not run real purchases — use an **EAS internal** or **preview APK/AAB** build.
- Install on a device signed in with a **license tester** Google account.
- Settings → **Listahan Pro** → subscribe / restore.
- RevenueCat dashboard → **Customers** should show the device profile id (Listahan user id).

## 5. Ads (later)

Free tier will show ads when AdMob is added. Use `useIsProAdFree()` from `src/context/ProSubscriptionContext.tsx` to hide them for Pro users.

## 6. AI (later)

Keep the same `pro` entitlement or add `pro_ai` when ready — see `docs/FUTURE_AI_SUBSCRIPTION_AND_IMPROVE.md`.
