const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export const LISTAHAN_TAG_SUFFIX_LEN = 4;

export function generateTagSuffix(): string {
  let out = "";
  for (let i = 0; i < LISTAHAN_TAG_SUFFIX_LEN; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]!;
  }
  return out;
}

export function isValidTagSuffix(value: string): boolean {
  return new RegExp(`^[a-z0-9]{${LISTAHAN_TAG_SUFFIX_LEN}}$`).test(value.trim().toLowerCase());
}

export function normalizeTagSuffix(value: string | undefined | null): string {
  const t = (value ?? "").trim().toLowerCase();
  return isValidTagSuffix(t) ? t : "";
}
