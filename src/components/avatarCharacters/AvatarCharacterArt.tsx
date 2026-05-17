import React from "react";
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";
import type { AvatarCharacterId } from "../../constants/avatarCharacters";

type ArtProps = { width: number; height: number };

function Olive({ width, height }: ArtProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 100 100">
      <Circle cx="50" cy="52" r="34" fill="#BAC67A" />
      <Rect x="30" y="38" width="40" height="30" rx="6" fill="#F8FAE8" />
      <Path d="M36 48h8M44 48h8M52 48h8" stroke="#7A872C" strokeWidth="2.5" strokeLinecap="round" />
      <Path d="M36 56h20" stroke="#7A872C" strokeWidth="2.5" strokeLinecap="round" />
      <Circle cx="40" cy="66" r="2.5" fill="#7A872C" />
      <Circle cx="50" cy="66" r="2.5" fill="#7A872C" />
      <Circle cx="60" cy="66" r="2.5" fill="#7A872C" />
      <Ellipse cx="38" cy="44" rx="4" ry="5" fill="#2D3A12" />
      <Ellipse cx="62" cy="44" rx="4" ry="5" fill="#2D3A12" />
      <Path d="M44 58 Q50 63 56 58" stroke="#2D3A12" strokeWidth="2" fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function Peach({ width, height }: ArtProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 100 100">
      <Circle cx="50" cy="54" r="32" fill="#FFB4A2" />
      <Circle cx="36" cy="48" r="7" fill="#fff" />
      <Circle cx="64" cy="48" r="7" fill="#fff" />
      <Circle cx="38" cy="49" r="3.5" fill="#3D2318" />
      <Circle cx="62" cy="49" r="3.5" fill="#3D2318" />
      <Circle cx="39" cy="47" r="1.2" fill="#fff" />
      <Circle cx="63" cy="47" r="1.2" fill="#fff" />
      <Ellipse cx="32" cy="58" rx="5" ry="3" fill="#FF8F7A" opacity={0.55} />
      <Ellipse cx="68" cy="58" rx="5" ry="3" fill="#FF8F7A" opacity={0.55} />
      <Path d="M46 62 Q50 67 54 62" stroke="#3D2318" strokeWidth="2" fill="none" strokeLinecap="round" />
      <Path d="M50 22 Q54 30 50 34 Q46 30 50 22" fill="#7CB342" />
    </Svg>
  );
}

function Sky({ width, height }: ArtProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 100 100">
      <Circle cx="50" cy="56" r="30" fill="#7EC8E3" />
      <Ellipse cx="38" cy="28" rx="16" ry="10" fill="#fff" opacity={0.95} />
      <Ellipse cx="58" cy="24" rx="14" ry="9" fill="#fff" opacity={0.9} />
      <Circle cx="40" cy="50" r="5" fill="#fff" />
      <Circle cx="60" cy="50" r="5" fill="#fff" />
      <Circle cx="42" cy="51" r="2.5" fill="#1E4D63" />
      <Circle cx="58" cy="51" r="2.5" fill="#1E4D63" />
      <Path d="M44 62 Q50 66 56 62" stroke="#1E4D63" strokeWidth="2" fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function Lilac({ width, height }: ArtProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 100 100">
      <Circle cx="50" cy="54" r="32" fill="#C4B5FD" />
      <Path d="M50 18 L52 28 L62 26 L54 32 L58 42 L50 36 L42 42 L46 32 L38 26 L48 28 Z" fill="#A78BFA" />
      <Ellipse cx="38" cy="50" rx="5" ry="6" fill="#fff" />
      <Ellipse cx="62" cy="50" rx="5" ry="6" fill="#fff" />
      <Circle cx="39" cy="51" r="2.8" fill="#4C1D95" />
      <Circle cx="61" cy="51" r="2.8" fill="#4C1D95" />
      <Path d="M46 62 Q50 66 54 62" stroke="#4C1D95" strokeWidth="2" fill="none" strokeLinecap="round" />
      <Circle cx="30" cy="58" r="3" fill="#F9A8D4" opacity={0.8} />
      <Circle cx="70" cy="58" r="3" fill="#F9A8D4" opacity={0.8} />
    </Svg>
  );
}

function Ember({ width, height }: ArtProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 100 100">
      <Circle cx="50" cy="56" r="30" fill="#FDBA74" />
      <Path d="M32 34 Q28 18 38 26 Q36 12 46 24 Q44 8 54 22 Q58 10 62 26 Q72 16 68 34" fill="#EA580C" />
      <Circle cx="40" cy="52" r="5" fill="#fff" />
      <Circle cx="60" cy="52" r="5" fill="#fff" />
      <Circle cx="41" cy="53" r="2.5" fill="#7C2D12" />
      <Circle cx="59" cy="53" r="2.5" fill="#7C2D12" />
      <Path d="M44 64 Q50 68 56 64" stroke="#7C2D12" strokeWidth="2" fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function Mint({ width, height }: ArtProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 100 100">
      <Circle cx="50" cy="55" r="31" fill="#6EE7B7" />
      <Path d="M50 20 Q58 32 50 38 Q42 32 50 20" fill="#34D399" />
      <Path d="M44 30 Q50 26 56 30" stroke="#059669" strokeWidth="1.5" fill="none" />
      <Ellipse cx="39" cy="51" rx="5" ry="6" fill="#fff" />
      <Ellipse cx="61" cy="51" rx="5" ry="6" fill="#fff" />
      <Circle cx="40" cy="52" r="2.5" fill="#065F46" />
      <Circle cx="60" cy="52" r="2.5" fill="#065F46" />
      <Path d="M45 63 Q50 67 55 63" stroke="#065F46" strokeWidth="2" fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function Honey({ width, height }: ArtProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 100 100">
      <Circle cx="50" cy="54" r="32" fill="#FDE047" />
      <Path d="M28 48h44M28 56h44M28 64h44" stroke="#CA8A04" strokeWidth="4" opacity={0.35} />
      <Circle cx="40" cy="50" r="5" fill="#fff" />
      <Circle cx="60" cy="50" r="5" fill="#fff" />
      <Circle cx="41" cy="51" r="2.5" fill="#713F12" />
      <Circle cx="59" cy="51" r="2.5" fill="#713F12" />
      <Path d="M46 62 Q50 66 54 62" stroke="#713F12" strokeWidth="2" fill="none" strokeLinecap="round" />
      <Path d="M44 24 L50 14 L56 24 L52 24 L54 32 L50 28 L46 32 L48 24 Z" fill="#F59E0B" />
    </Svg>
  );
}

function Cocoa({ width, height }: ArtProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 100 100">
      <Circle cx="50" cy="56" r="30" fill="#A8A29E" />
      <Circle cx="34" cy="32" r="10" fill="#78716C" />
      <Circle cx="66" cy="32" r="10" fill="#78716C" />
      <Circle cx="34" cy="34" r="6" fill="#A8A29E" />
      <Circle cx="66" cy="34" r="6" fill="#A8A29E" />
      <Ellipse cx="40" cy="52" rx="5" ry="6" fill="#fff" />
      <Ellipse cx="60" cy="52" rx="5" ry="6" fill="#fff" />
      <Circle cx="41" cy="53" r="2.5" fill="#292524" />
      <Circle cx="59" cy="53" r="2.5" fill="#292524" />
      <Ellipse cx="50" cy="60" rx="6" ry="4" fill="#57534E" />
    </Svg>
  );
}

const ART: Record<AvatarCharacterId, React.ComponentType<ArtProps>> = {
  olive: Olive,
  peach: Peach,
  sky: Sky,
  lilac: Lilac,
  ember: Ember,
  mint: Mint,
  honey: Honey,
  cocoa: Cocoa,
};

export function AvatarCharacterArt({
  characterId,
  width,
  height,
}: {
  characterId: AvatarCharacterId;
  width: number;
  height: number;
}) {
  const Component = ART[characterId];
  return <Component width={width} height={height} />;
}
