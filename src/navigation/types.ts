import type { NativeStackScreenProps } from "@react-navigation/native-stack";

export type RootStackParamList = {
  Home: undefined;
  CreateList: undefined;
  ListDetail: { listId: string; autoOpenAdd?: boolean };
  History: undefined;
  CompletedListPreview: { historyId: string };
  AllDone: { listId: string };
};

export type HomeProps = NativeStackScreenProps<RootStackParamList, "Home">;
export type CreateListProps = NativeStackScreenProps<RootStackParamList, "CreateList">;
export type ListDetailProps = NativeStackScreenProps<RootStackParamList, "ListDetail">;
export type HistoryProps = NativeStackScreenProps<RootStackParamList, "History">;
export type CompletedListPreviewProps = NativeStackScreenProps<
  RootStackParamList,
  "CompletedListPreview"
>;
export type AllDoneProps = NativeStackScreenProps<RootStackParamList, "AllDone">;
