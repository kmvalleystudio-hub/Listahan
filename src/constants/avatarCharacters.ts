export const DEFAULT_AVATAR_CHARACTER_ID = "olive" as const;

export type AvatarCharacterId =
  | "olive"
  | "peach"
  | "sky"
  | "lilac"
  | "ember"
  | "mint"
  | "honey"
  | "cocoa";

export type AvatarCharacter = {
  id: AvatarCharacterId;
  label: string;
  /** Circle backdrop behind the mascot. */
  bg: string;
};

export const AVATAR_CHARACTERS: readonly AvatarCharacter[] = [
  { id: "olive", label: "Olive", bg: "#E4EAC4" },
  { id: "peach", label: "Peach", bg: "#FFE4D6" },
  { id: "sky", label: "Sky", bg: "#D9EEFF" },
  { id: "lilac", label: "Lilac", bg: "#EDE4FF" },
  { id: "ember", label: "Ember", bg: "#FFE8D1" },
  { id: "mint", label: "Mint", bg: "#D8F5EC" },
  { id: "honey", label: "Honey", bg: "#FFF3C4" },
  { id: "cocoa", label: "Cocoa", bg: "#E8DDD4" },
] as const;

const ID_SET = new Set<string>(AVATAR_CHARACTERS.map((c) => c.id));

export function normalizeAvatarCharacterId(value: string | undefined | null): AvatarCharacterId {
  const id = (value ?? "").trim().toLowerCase();
  if (ID_SET.has(id)) return id as AvatarCharacterId;
  return DEFAULT_AVATAR_CHARACTER_ID;
}

export function getAvatarCharacter(id: AvatarCharacterId): AvatarCharacter {
  return AVATAR_CHARACTERS.find((c) => c.id === id) ?? AVATAR_CHARACTERS[0];
}

/** Character shown when the user has not customized their portrait yet. */
export function getEffectiveAvatarCharacterId(profile: {
  avatarCharacterId: string;
  avatarPortraitTouched: boolean;
}): AvatarCharacterId {
  if (!profile.avatarPortraitTouched) return DEFAULT_AVATAR_CHARACTER_ID;
  return normalizeAvatarCharacterId(profile.avatarCharacterId);
}
