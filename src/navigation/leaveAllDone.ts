import type { NavigationProp } from "@react-navigation/native";
import type { RootStackParamList } from "./types";

type HomeRoute = "GroceryHome" | "TodoHome";

/** Dismiss All Done and return to the tool home without leaving a modal on the stack (web-safe). */
export function leaveAllDone(
  navigation: NavigationProp<RootStackParamList>,
  homeName: HomeRoute
): void {
  const state = navigation.getState();
  const prev = state.routes[state.index - 1];
  if (prev?.name === homeName && navigation.canGoBack()) {
    navigation.goBack();
    return;
  }
  navigation.navigate(homeName);
}
