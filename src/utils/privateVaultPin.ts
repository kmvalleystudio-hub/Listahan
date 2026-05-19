import AsyncStorage from "@react-native-async-storage/async-storage";

const PIN_KEY = "saycart_private_vault_pin_v1";
const ASYNC_PIN_FALLBACK_KEY = "@saycart/private_vault_pin_async_fallback_v1";

const BIO_PREF_KEY = "saycart_private_vault_bio_pref_v1";
const ASYNC_BIO_PREF_FALLBACK = "@saycart/private_vault_bio_pref_async_v1";

const VAULT_SYNC_ALLOWED_KEY = "saycart_private_vault_sync_allowed_v1";
const ASYNC_VAULT_SYNC_ALLOWED_FALLBACK = "@saycart/private_vault_sync_allowed_async_v1";

const RECOVERY_Q_KEY = "saycart_private_vault_recovery_q_v1";
const ASYNC_RECOVERY_Q_FALLBACK = "@saycart/private_vault_recovery_q_async_v1";

const RECOVERY_A_KEY = "saycart_private_vault_recovery_a_v1";
const ASYNC_RECOVERY_A_FALLBACK = "@saycart/private_vault_recovery_a_async_v1";

export const PIN_LENGTH_MIN = 6;
export const PIN_LENGTH_MAX = 6;

type SecureStoreModule = typeof import("expo-secure-store");

let secureStoreCache: SecureStoreModule | null | undefined;

function tryLoadSecureStore(): SecureStoreModule | null {
  if (secureStoreCache !== undefined) {
    return secureStoreCache;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("expo-secure-store") as SecureStoreModule;
    secureStoreCache = mod;
    return mod;
  } catch (e) {
    secureStoreCache = null;
    return null;
  }
}

async function readPinFromFallback(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(ASYNC_PIN_FALLBACK_KEY);
  } catch {
    return null;
  }
}

async function writePinToFallback(pin: string): Promise<void> {
  await AsyncStorage.setItem(ASYNC_PIN_FALLBACK_KEY, pin);
}

async function readVaultString(secureKey: string, asyncFallbackKey: string): Promise<string | null> {
  const SecureStore = tryLoadSecureStore();
  if (SecureStore) {
    try {
      const v = await SecureStore.getItemAsync(secureKey);
      if (v != null && v !== "") return v;
    } catch {
      /* fall through */
    }
  }
  try {
    return await AsyncStorage.getItem(asyncFallbackKey);
  } catch {
    return null;
  }
}

async function writeVaultString(secureKey: string, asyncFallbackKey: string, value: string): Promise<void> {
  const SecureStore = tryLoadSecureStore();
  if (SecureStore) {
    try {
      await SecureStore.setItemAsync(secureKey, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      await AsyncStorage.removeItem(asyncFallbackKey);
      return;
    } catch {
      /* fall through */
    }
  }
  await AsyncStorage.setItem(asyncFallbackKey, value);
}

async function deleteVaultString(secureKey: string, asyncFallbackKey: string): Promise<void> {
  const SecureStore = tryLoadSecureStore();
  if (SecureStore) {
    try {
      await SecureStore.deleteItemAsync(secureKey);
    } catch {
      /* ignore */
    }
  }
  try {
    await AsyncStorage.removeItem(asyncFallbackKey);
  } catch {
    /* ignore */
  }
}

export function normalizeRecoveryAnswer(answer: string): string {
  return answer.trim().toLowerCase();
}

/** When unset, biometrics stay available (matches behavior before this preference existed). */
export async function getBiometricsPreference(): Promise<boolean> {
  const raw = await readVaultString(BIO_PREF_KEY, ASYNC_BIO_PREF_FALLBACK);
  if (raw === null || raw === "") return true;
  return raw === "1";
}

export async function setBiometricsPreference(enabled: boolean): Promise<void> {
  await writeVaultString(BIO_PREF_KEY, ASYNC_BIO_PREF_FALLBACK, enabled ? "1" : "0");
}

/** Explicit opt-in to upload Vault sheets during user sync (enabled only after PIN verification). */
export async function getVaultSyncAllowed(): Promise<boolean> {
  const raw = await readVaultString(VAULT_SYNC_ALLOWED_KEY, ASYNC_VAULT_SYNC_ALLOWED_FALLBACK);
  return raw === "1";
}

export async function setVaultSyncAllowed(enabled: boolean): Promise<void> {
  await writeVaultString(VAULT_SYNC_ALLOWED_KEY, ASYNC_VAULT_SYNC_ALLOWED_FALLBACK, enabled ? "1" : "0");
}

export async function getRecoveryQuestion(): Promise<string | null> {
  const q = await readVaultString(RECOVERY_Q_KEY, ASYNC_RECOVERY_Q_FALLBACK);
  const t = q?.trim();
  return t && t.length > 0 ? t : null;
}

export async function hasRecoverySecret(): Promise<boolean> {
  const q = await getRecoveryQuestion();
  const a = await readVaultString(RECOVERY_A_KEY, ASYNC_RECOVERY_A_FALLBACK);
  return Boolean(q && a && a.trim().length > 0);
}

export async function setRecoverySecret(question: string, answer: string): Promise<void> {
  const q = question.trim();
  const a = normalizeRecoveryAnswer(answer);
  if (q.length < 4) {
    throw new Error("Choose a question at least 4 characters.");
  }
  if (a.length < 2) {
    throw new Error("Answer must be at least 2 characters.");
  }
  await writeVaultString(RECOVERY_Q_KEY, ASYNC_RECOVERY_Q_FALLBACK, q);
  await writeVaultString(RECOVERY_A_KEY, ASYNC_RECOVERY_A_FALLBACK, a);
}

export async function verifyRecoveryAnswer(input: string): Promise<boolean> {
  const stored = await readVaultString(RECOVERY_A_KEY, ASYNC_RECOVERY_A_FALLBACK);
  if (!stored) return false;
  return normalizeRecoveryAnswer(input) === stored;
}

/** Clears recovery data (e.g. before replacing PIN via forgot flow). */
export async function clearRecoverySecret(): Promise<void> {
  await deleteVaultString(RECOVERY_Q_KEY, ASYNC_RECOVERY_Q_FALLBACK);
  await deleteVaultString(RECOVERY_A_KEY, ASYNC_RECOVERY_A_FALLBACK);
}

export async function getStoredPin(): Promise<string | null> {
  const SecureStore = tryLoadSecureStore();
  if (SecureStore) {
    try {
      return await SecureStore.getItemAsync(PIN_KEY);
    } catch {
      return readPinFromFallback();
    }
  }
  return readPinFromFallback();
}

export async function setStoredPin(pin: string): Promise<void> {
  const SecureStore = tryLoadSecureStore();
  if (SecureStore) {
    try {
      await SecureStore.setItemAsync(PIN_KEY, pin, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      await AsyncStorage.removeItem(ASYNC_PIN_FALLBACK_KEY);
      return;
    } catch {
      /* fall through to async */
    }
  }
  await writePinToFallback(pin);
}

export async function hasStoredPin(): Promise<boolean> {
  const p = await getStoredPin();
  return typeof p === "string" && p.length >= PIN_LENGTH_MIN && p.length <= PIN_LENGTH_MAX;
}

export function isValidPinFormat(pin: string): boolean {
  if (!/^\d+$/.test(pin)) return false;
  return pin.length >= PIN_LENGTH_MIN && pin.length <= PIN_LENGTH_MAX;
}
