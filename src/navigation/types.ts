import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ToolId } from "../constants/toolsCatalog";

export type RootStackParamList = {
  ToolsDashboard: undefined;
  GroceryHome: undefined;
  ToolPlaceholder: { toolId: ToolId };
  CreateList: undefined;
  ListDetail: { listId: string; autoOpenAdd?: boolean };
  History: undefined;
  CompletedListPreview: { historyId: string };
  AllDone: { listId: string; tool?: "grocery" | "todo" };

  TodoHome: undefined;
  TodoCreateList: undefined;
  TodoListDetail: { listId: string; autoOpenAdd?: boolean };
  TodoRecent: undefined;
  TodoRecentPreview: { historyId: string };
};

export type ToolsDashboardProps = NativeStackScreenProps<RootStackParamList, "ToolsDashboard">;
export type GroceryHomeProps = NativeStackScreenProps<RootStackParamList, "GroceryHome">;
export type ToolPlaceholderProps = NativeStackScreenProps<RootStackParamList, "ToolPlaceholder">;
export type CreateListProps = NativeStackScreenProps<RootStackParamList, "CreateList">;
export type ListDetailProps = NativeStackScreenProps<RootStackParamList, "ListDetail">;
export type HistoryProps = NativeStackScreenProps<RootStackParamList, "History">;
export type CompletedListPreviewProps = NativeStackScreenProps<
  RootStackParamList,
  "CompletedListPreview"
>;
export type AllDoneProps = NativeStackScreenProps<RootStackParamList, "AllDone">;

export type TodoHomeProps = NativeStackScreenProps<RootStackParamList, "TodoHome">;
export type TodoCreateListProps = NativeStackScreenProps<RootStackParamList, "TodoCreateList">;
export type TodoListDetailProps = NativeStackScreenProps<RootStackParamList, "TodoListDetail">;
export type TodoRecentProps = NativeStackScreenProps<RootStackParamList, "TodoRecent">;
export type TodoRecentPreviewProps = NativeStackScreenProps<
  RootStackParamList,
  "TodoRecentPreview"
>;
