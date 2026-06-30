import AsyncStorage from "@react-native-async-storage/async-storage";
import { generateDeviceProfileId, isUuidV4Like } from "./deviceProfileId";

/** Stable RevenueCat App User ID — separate from profile id so migrations never orphan subscriptions. */
const REVENUECAT_APP_USER_ID_KEY = "@listahan/revenuecat_app_user_id_v1";

export async function getOrCreateRevenueCatAppUserId(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(REVENUECAT_APP_USER_ID_KEY);
    const stored = raw?.trim() ?? "";
    if (stored && isUuidV4Like(stored)) return stored;
  } catch {
    // fall through to create
  }
  const id = generateDeviceProfileId();
  try {
    await AsyncStorage.setItem(REVENUECAT_APP_USER_ID_KEY, id);
  } catch {
    // still return id for this session
  }
  return id;
}
