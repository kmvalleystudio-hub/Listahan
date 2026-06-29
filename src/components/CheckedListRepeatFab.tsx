import React from "react";
import { Pressable, Text, View, type TextStyle, type ViewStyle } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

type Props = {
  visible: boolean;
  onRepeat: () => void;
  onArchive: () => void;
  accentColor: string;
  styles: {
    completedActionsRow: ViewStyle;
    repeatListBtn: ViewStyle;
    repeatListBtnText: TextStyle;
    archiveListBtn: ViewStyle;
    archiveListBtnText: TextStyle;
  };
};

export default function CheckedListRepeatFab({ visible, onRepeat, onArchive, accentColor, styles }: Props) {
  if (!visible) return null;

  return (
    <View style={styles.completedActionsRow}>
      <Pressable
        style={({ pressed }) => [styles.repeatListBtn, pressed && { opacity: 0.92 }]}
        onPress={onRepeat}
        accessibilityRole="button"
        accessibilityLabel="Repeat this list"
      >
        <Ionicons name="repeat" size={18} color="#fff" />
        <Text style={styles.repeatListBtnText}>Repeat this list</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.archiveListBtn, pressed && { opacity: 0.92 }]}
        onPress={onArchive}
        accessibilityRole="button"
        accessibilityLabel="Archive this list"
      >
        <Ionicons name="archive-outline" size={20} color={accentColor} />
        <Text style={styles.archiveListBtnText}>Archive</Text>
      </Pressable>
    </View>
  );
}
