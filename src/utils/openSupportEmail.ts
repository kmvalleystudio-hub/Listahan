import { Alert, Linking } from "react-native";
import { APP_DISPLAY_NAME } from "../constants/appBranding";
import { SUPPORT_EMAIL, supportMailtoUrl } from "../constants/supportContact";

export async function openSupportEmail(options: {
  kind: "problem" | "feedback";
}): Promise<void> {
  const subject =
    options.kind === "problem"
      ? `${APP_DISPLAY_NAME} — Problem report`
      : `${APP_DISPLAY_NAME} — Feedback`;
  const body =
    options.kind === "problem"
      ? "What went wrong:\n\n\nSteps to reproduce:\n1.\n2.\n\nDevice model:\nAndroid version:\n"
      : "I'd like to share:\n\n\n";

  const url = supportMailtoUrl({ subject, body });
  try {
    const can = await Linking.canOpenURL(url);
    if (!can) {
      Alert.alert("Email", `Contact us at ${SUPPORT_EMAIL}`);
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert("Email", `Could not open your mail app. Write to ${SUPPORT_EMAIL}`);
  }
}
