/** Lowercase trimmed handle used for uniqueness (matches Supabase checks). */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidUsernamePattern(normalized: string): boolean {
  return /^[a-z0-9][a-z0-9_]{2,29}$/.test(normalized);
}

export function usernameValidationMessage(normalized: string): string | null {
  if (!normalized) return "Username is required.";
  if (normalized.length < 3 || normalized.length > 30) {
    return "Use 3–30 characters.";
  }
  if (!isValidUsernamePattern(normalized)) {
    return "Use letters, numbers, and underscores only. Start with a letter or number.";
  }
  return null;
}

/** Best-effort slug from an old display-name field (optional onboarding hint only). */
export function usernameSuggestionFromLegacyDisplayName(displayName: string): string {
  const t = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (t.length < 3) return "";
  return t.slice(0, 30);
}
