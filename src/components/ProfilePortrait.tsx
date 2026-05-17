import React from "react";
import { View, Image, StyleSheet } from "react-native";
import {
  getAvatarCharacter,
  getEffectiveAvatarCharacterId,
  type AvatarCharacterId,
} from "../constants/avatarCharacters";
import { AvatarCharacterArt } from "./avatarCharacters/AvatarCharacterArt";
import type { UserProfile } from "../utils/userProfileStorage";

type Props = {
  profile: Pick<
    UserProfile,
    "avatarLocalUri" | "avatarRemoteUrl" | "avatarCharacterId" | "avatarPortraitTouched"
  > | null;
  size: number;
};

export function ProfilePortrait({ profile, size }: Props) {
  const uri = profile?.avatarLocalUri || profile?.avatarRemoteUrl;
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        resizeMode="cover"
      />
    );
  }

  const characterId: AvatarCharacterId = profile
    ? getEffectiveAvatarCharacterId(profile)
    : getAvatarCharacter("olive").id;

  const { bg } = getAvatarCharacter(characterId);

  return (
    <View
      style={[
        styles.characterWrap,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
      ]}
    >
      <AvatarCharacterArt characterId={characterId} width={size} height={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  characterWrap: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
});
