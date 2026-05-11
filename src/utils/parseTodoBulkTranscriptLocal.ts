import { toTitleCaseWords } from "./textFormat";

/**
 * Split spoken tasks on **and** (same rhythm as grocery bulk).
 * Example: "call mom and buy milk and jog two miles"
 */
export function parseTodoBulkTranscriptLocal(transcript: string): string[] {
  const raw = transcript.trim();
  if (!raw) return [];
  return raw
    .split(/\s+\band\b\s+/i)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((chunk) => toTitleCaseWords(chunk));
}
