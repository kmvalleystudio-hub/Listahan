import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_APP_FONT_FAMILY_ID,
  normalizeAppFontFamilyId,
  type AppFontFamilyId,
} from "./appFontFamilies";

export const COLOR_SCHEME_STORAGE_KEY = "@saycart/color_scheme_v1";
/** Legacy float multiplier (0.85–1.25); migrated to level on read. */
export const FONT_SCALE_STORAGE_KEY = "@saycart/font_scale_v1";
export const FONT_SIZE_LEVEL_STORAGE_KEY = "@saycart/font_size_level_v1";
export const USE_SYSTEM_FONT_STORAGE_KEY = "@saycart/use_system_font_v1";
export const FONT_FAMILY_STORAGE_KEY = "@saycart/font_family_v1";

export const FONT_SIZE_LEVEL_MIN = 1;
export const FONT_SIZE_LEVEL_MAX = 5;
export const DEFAULT_FONT_SIZE_LEVEL = 3;

/** Step 3 matches the original default (100%) text size. */
export const FONT_SCALE_BY_LEVEL: Record<number, number> = {
  1: 0.85,
  2: 0.925,
  3: 1,
  4: 1.075,
  5: 1.25,
};

export const DEFAULT_FONT_SCALE = FONT_SCALE_BY_LEVEL[DEFAULT_FONT_SIZE_LEVEL];

export function clampFontSizeLevel(level: number): number {
  return Math.min(FONT_SIZE_LEVEL_MAX, Math.max(FONT_SIZE_LEVEL_MIN, Math.round(level)));
}

export function fontScaleForLevel(level: number): number {
  return FONT_SCALE_BY_LEVEL[clampFontSizeLevel(level)] ?? DEFAULT_FONT_SCALE;
}

/** Map a legacy multiplier (0.85–1.25) to the nearest slider step. */
export function fontSizeLevelFromScale(scale: number): number {
  if (!Number.isFinite(scale)) return DEFAULT_FONT_SIZE_LEVEL;
  // Old app default was 1.0 — always step 3, not step 5 (1.25 is also 0.25 away).
  if (Math.abs(scale - DEFAULT_FONT_SCALE) < 0.02) {
    return DEFAULT_FONT_SIZE_LEVEL;
  }
  let best = DEFAULT_FONT_SIZE_LEVEL;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (let level = FONT_SIZE_LEVEL_MIN; level <= FONT_SIZE_LEVEL_MAX; level += 1) {
    const delta = Math.abs(fontScaleForLevel(level) - scale);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = level;
    }
  }
  return best;
}

export function fontScaleLabel(scale: number): string {
  return `${Math.round(scale * 100)}%`;
}

export async function loadAppearancePreferences(): Promise<{
  scheme: "light" | "dark" | null;
  fontSizeLevel: number;
  useSystemFontSize: boolean;
  fontFamilyId: AppFontFamilyId;
}> {
  try {
    const [schemeRaw, levelRaw, legacyScaleRaw, systemRaw, fontFamilyRaw] = await Promise.all([
      AsyncStorage.getItem(COLOR_SCHEME_STORAGE_KEY),
      AsyncStorage.getItem(FONT_SIZE_LEVEL_STORAGE_KEY),
      AsyncStorage.getItem(FONT_SCALE_STORAGE_KEY),
      AsyncStorage.getItem(USE_SYSTEM_FONT_STORAGE_KEY),
      AsyncStorage.getItem(FONT_FAMILY_STORAGE_KEY),
    ]);

    const scheme = schemeRaw === "dark" || schemeRaw === "light" ? schemeRaw : null;
    let fontSizeLevel = DEFAULT_FONT_SIZE_LEVEL;
    const parsedLevel = levelRaw != null ? Number.parseInt(levelRaw, 10) : Number.NaN;
    if (Number.isFinite(parsedLevel) && parsedLevel >= FONT_SIZE_LEVEL_MIN && parsedLevel <= FONT_SIZE_LEVEL_MAX) {
      fontSizeLevel = parsedLevel;
      const legacyScale = legacyScaleRaw != null ? Number.parseFloat(legacyScaleRaw) : Number.NaN;
      if (
        parsedLevel === FONT_SIZE_LEVEL_MAX &&
        Number.isFinite(legacyScale) &&
        Math.abs(legacyScale - DEFAULT_FONT_SCALE) < 0.02
      ) {
        fontSizeLevel = DEFAULT_FONT_SIZE_LEVEL;
        void persistFontSizeLevel(fontSizeLevel);
      }
    } else if (legacyScaleRaw != null) {
      const parsedScale = Number.parseFloat(legacyScaleRaw);
      if (Number.isFinite(parsedScale)) {
        fontSizeLevel = fontSizeLevelFromScale(parsedScale);
        // Rewrite as an integer level so 1.0 does not read back as ambiguous later.
        void persistFontSizeLevel(fontSizeLevel);
      }
    }
    const useSystemFontSize = systemRaw === "true";
    const fontFamilyId = normalizeAppFontFamilyId(fontFamilyRaw ?? DEFAULT_APP_FONT_FAMILY_ID);

    return {
      scheme,
      fontSizeLevel: clampFontSizeLevel(fontSizeLevel),
      useSystemFontSize,
      fontFamilyId,
    };
  } catch {
    return {
      scheme: null,
      fontSizeLevel: DEFAULT_FONT_SIZE_LEVEL,
      useSystemFontSize: false,
      fontFamilyId: DEFAULT_APP_FONT_FAMILY_ID,
    };
  }
}

export async function persistFontSizeLevel(level: number): Promise<void> {
  const clamped = clampFontSizeLevel(level);
  await AsyncStorage.setItem(FONT_SIZE_LEVEL_STORAGE_KEY, String(clamped));
}

export async function persistUseSystemFontSize(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(USE_SYSTEM_FONT_STORAGE_KEY, enabled ? "true" : "false");
}

export async function persistFontFamilyId(fontFamilyId: AppFontFamilyId): Promise<void> {
  await AsyncStorage.setItem(FONT_FAMILY_STORAGE_KEY, normalizeAppFontFamilyId(fontFamilyId));
}

export { DEFAULT_APP_FONT_FAMILY_ID, type AppFontFamilyId };

/** @deprecated Use clampFontSizeLevel + fontScaleForLevel */
export function clampFontScale(value: number): number {
  return fontScaleForLevel(fontSizeLevelFromScale(value));
}
