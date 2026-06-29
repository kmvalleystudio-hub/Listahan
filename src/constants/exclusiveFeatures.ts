/**
 * Gated capabilities — enable per flag when rolling out to exclusive users.
 * Implementation stays in the app; entry points respect these switches.
 */
export const EXCLUSIVE_FEATURES = {
  /** Grocery / to-do list detail: camera + upload “scan notes” flow. */
  scanNotesFromPhoto: false,
} as const;
