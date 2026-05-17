import React from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import type { AppThemeColors } from "../theme/colors";
import {
  AVATAR_CHARACTERS,
  getEffectiveAvatarCharacterId,
  normalizeAvatarCharacterId,
  type AvatarCharacterId,
} from "../constants/avatarCharacters";
import { AvatarCharacterArt } from "./avatarCharacters/AvatarCharacterArt";
import type { UserProfile } from "../utils/userProfileStorage";

const CELL = 68;
const GAP = 10;

type Props = {
  colors: AppThemeColors;
  profile: Pick<UserProfile, "avatarCharacterId" | "avatarPortraitTouched"> | null;
  onSelect: (id: AvatarCharacterId) => void;
};

export default function AvatarCharacterPickerGrid({ colors, profile, onSelect }: Props) {
  const selectedId = profile ? getEffectiveAvatarCharacterId(profile) : normalizeAvatarCharacterId(null);

  return (
    <View style={styles.grid}>
      {AVATAR_CHARACTERS.map((character) => {
        const selected = selectedId === character.id;
        return (
          <Pressable
            key={character.id}
            style={({ pressed }) => [
              styles.cell,
              {
                backgroundColor: character.bg,
                borderColor: selected ? colors.primary : colors.border,
              },
              pressed && { opacity: 0.88 },
            ]}
            onPress={() => onSelect(character.id)}
            accessibilityRole="button"
            accessibilityLabel={`${character.label} character`}
            accessibilityState={{ selected }}
          >
            <AvatarCharacterArt characterId={character.id} width={CELL - 8} height={CELL - 8} />
            <Text style={[styles.label, { color: colors.textSecondary }]} numberOfLines={1}>
              {character.label}
            </Text>
            {selected ? <View style={[styles.dot, { backgroundColor: colors.primary }]} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GAP,
    justifyContent: "center",
    marginBottom: 14,
  },
  cell: {
    width: CELL,
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 2,
    paddingTop: 4,
    paddingBottom: 6,
    paddingHorizontal: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  dot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
