import AsyncStorage from "@react-native-async-storage/async-storage";
import { generateDeviceProfileId, isUuidV4Like } from "./deviceProfileId";
import {
  DEFAULT_AVATAR_CHARACTER_ID,
  normalizeAvatarCharacterId,
} from "../constants/avatarCharacters";
import { generateTagSuffix, isValidTagSuffix, normalizeTagSuffix } from "./listahanTagSuffix";

export const USER_PROFILE_STORAGE_KEY = "@listahan/user_profile_v1";

export type UserProfile = {
  /** Lowercase unique handle (letters, digits, underscore). Required for app use. */
  username: string;
  /** Four random a-z/0-9 chars; fixed after first assignment (public tag suffix). */
  tagSuffix: string;
  /** ISO date — set once when the profile is first created. */
  createdAt: string;
  /**
   * Listahan **user ID** (UUID v4). Same value as `device_profile_id` / `user_id` in Supabase
   * `listahan_public_profiles` and the avatar storage folder name.
   */
  deviceProfileId: string;
  /** Local file URI for avatar image. */
  avatarLocalUri?: string;
  /** Public HTTPS URL after upload to Supabase Storage (optional). */
  avatarRemoteUrl?: string;
  /** Object path in bucket, e.g. `{uuid}/avatar.jpg`. */
  avatarStoragePath?: string;
  /** Selected mascot when no custom photo is set. */
  avatarCharacterId: string;
  /** True after the user picks a character or photo in the avatar picker. */
  avatarPortraitTouched: boolean;
};

const DEFAULT_PROFILE: Omit<UserProfile, "createdAt" | "deviceProfileId" | "tagSuffix"> = {
  username: "",
  avatarCharacterId: DEFAULT_AVATAR_CHARACTER_ID,
  avatarPortraitTouched: false,
};

function ensureTagSuffix(profile: UserProfile): UserProfile {
  if (isValidTagSuffix(profile.tagSuffix)) return profile;
  return { ...profile, tagSuffix: generateTagSuffix() };
}

function normalize(parsed: unknown): UserProfile {
  const fallbackId = generateDeviceProfileId();
  if (!parsed || typeof parsed !== "object") {
    return ensureTagSuffix({
      ...DEFAULT_PROFILE,
      tagSuffix: "",
      createdAt: new Date().toISOString(),
      deviceProfileId: fallbackId,
    });
  }
  const o = parsed as Record<string, unknown>;
  let username = typeof o.username === "string" ? o.username.trim().toLowerCase() : "";
  const tagSuffix = normalizeTagSuffix(typeof o.tagSuffix === "string" ? o.tagSuffix : "");
  const createdAt =
    typeof o.createdAt === "string" && !Number.isNaN(new Date(o.createdAt).getTime())
      ? o.createdAt
      : new Date().toISOString();
  let deviceProfileId = typeof o.deviceProfileId === "string" ? o.deviceProfileId.trim() : "";
  if (!deviceProfileId || !isUuidV4Like(deviceProfileId)) {
    deviceProfileId = fallbackId;
  }
  const avatarLocalUri = typeof o.avatarLocalUri === "string" ? o.avatarLocalUri.trim() : undefined;
  const avatarRemoteUrl = typeof o.avatarRemoteUrl === "string" ? o.avatarRemoteUrl.trim() : undefined;
  const avatarStoragePath = typeof o.avatarStoragePath === "string" ? o.avatarStoragePath.trim() : undefined;
  const hasPhoto = Boolean(avatarLocalUri || avatarRemoteUrl);
  const avatarCharacterId = normalizeAvatarCharacterId(
    typeof o.avatarCharacterId === "string" ? o.avatarCharacterId : ""
  );
  const avatarPortraitTouched = o.avatarPortraitTouched === true || hasPhoto;
  return ensureTagSuffix({
    username,
    tagSuffix,
    createdAt,
    deviceProfileId,
    avatarLocalUri: avatarLocalUri || undefined,
    avatarRemoteUrl: avatarRemoteUrl || undefined,
    avatarStoragePath: avatarStoragePath || undefined,
    avatarCharacterId,
    avatarPortraitTouched,
  });
}

export async function loadUserProfile(): Promise<UserProfile> {
  try {
    const raw = await AsyncStorage.getItem(USER_PROFILE_STORAGE_KEY);
    if (!raw) {
      const fresh = ensureTagSuffix({
        ...DEFAULT_PROFILE,
        tagSuffix: "",
        createdAt: new Date().toISOString(),
        deviceProfileId: generateDeviceProfileId(),
      });
      await AsyncStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(fresh));
      return fresh;
    }
    const parsed = JSON.parse(raw) as unknown;
    const next = normalize(parsed);
    const prev = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    const prevId = typeof prev.deviceProfileId === "string" ? prev.deviceProfileId.trim() : "";
    const prevSuffix = normalizeTagSuffix(typeof prev.tagSuffix === "string" ? prev.tagSuffix : "");
    const prevCharacterId =
      typeof prev.avatarCharacterId === "string" ? normalizeAvatarCharacterId(prev.avatarCharacterId) : "";
    const needsAvatarMigration =
      prev.avatarCharacterId === undefined || prev.avatarPortraitTouched === undefined;
    if (
      !prevId ||
      !isUuidV4Like(prevId) ||
      prevSuffix !== next.tagSuffix ||
      prevCharacterId !== next.avatarCharacterId ||
      needsAvatarMigration
    ) {
      await AsyncStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(next));
    }
    return next;
  } catch {
    const fresh = ensureTagSuffix({
      ...DEFAULT_PROFILE,
      tagSuffix: "",
      createdAt: new Date().toISOString(),
      deviceProfileId: generateDeviceProfileId(),
    });
    await AsyncStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(fresh));
    return fresh;
  }
}

export async function saveUserProfile(
  patch: Partial<
    Pick<
      UserProfile,
      | "username"
      | "avatarLocalUri"
      | "avatarRemoteUrl"
      | "avatarStoragePath"
      | "avatarCharacterId"
      | "avatarPortraitTouched"
    >
  >
): Promise<UserProfile> {
  const current = await loadUserProfile();
  const next: UserProfile = {
    ...current,
    username: patch.username !== undefined ? patch.username.trim().toLowerCase() : current.username,
    avatarLocalUri:
      "avatarLocalUri" in patch
        ? patch.avatarLocalUri?.trim() || undefined
        : current.avatarLocalUri,
    avatarRemoteUrl:
      "avatarRemoteUrl" in patch
        ? patch.avatarRemoteUrl?.trim() || undefined
        : current.avatarRemoteUrl,
    avatarStoragePath:
      "avatarStoragePath" in patch
        ? patch.avatarStoragePath?.trim() || undefined
        : current.avatarStoragePath,
    avatarCharacterId:
      patch.avatarCharacterId !== undefined
        ? normalizeAvatarCharacterId(patch.avatarCharacterId)
        : current.avatarCharacterId,
    avatarPortraitTouched:
      patch.avatarPortraitTouched !== undefined
        ? patch.avatarPortraitTouched
        : current.avatarPortraitTouched,
  };
  if (next.avatarLocalUri || next.avatarRemoteUrl) {
    next.avatarPortraitTouched = true;
  }
  await AsyncStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(next));
  return next;
}

/** Reads legacy `displayName` from stored JSON for onboarding hint only. */
export async function readLegacyDisplayNameForUsernamePrefill(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(USER_PROFILE_STORAGE_KEY);
    if (!raw) return "";
    const o = JSON.parse(raw) as Record<string, unknown>;
    return typeof o.displayName === "string" ? o.displayName.trim() : "";
  } catch {
    return "";
  }
}

export function profileInitials(username: string): string {
  const t = username.trim();
  if (!t) return "?";
  return t.slice(0, 2).toUpperCase();
}

export function profileGreetingName(username: string): string {
  const t = username.trim();
  return t || "there";
}

/** Public handle shown in profile and discovery (e.g. `@mike_lists_x7k2`). */
export function listahanPublicTag(username: string, tagSuffix?: string): string | null {
  const u = username.trim().toLowerCase();
  if (!u) return null;
  const suffix = normalizeTagSuffix(tagSuffix);
  return suffix ? `@${u}_${suffix}` : `@${u}`;
}

export function formatMemberSince(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
