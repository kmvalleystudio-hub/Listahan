import type { NavigationProp } from "@react-navigation/native";
import type { RootStackParamList } from "./types";

/** Pop back to the dashboard with the correct reverse slide animation. */
export function goToDashboard(navigation: NavigationProp<RootStackParamList>) {
  if (navigation.canGoBack()) {
    navigation.goBack();
    return;
  }
  navigation.navigate("ToolsDashboard");
}
