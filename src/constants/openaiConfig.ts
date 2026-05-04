import Constants from "expo-constants";

/**
 * OpenAI key: prefer Metro-inlined EXPO_PUBLIC_* from .env, then app.config extra
 * (extra is filled when app.config.js runs with dotenv).
 */
export function getOpenAiApiKey(): string | undefined {
  const fromEnv =
    typeof process !== "undefined" ? process.env.EXPO_PUBLIC_OPENAI_API_KEY?.trim() : undefined;
  if (fromEnv) return fromEnv;

  const extra = Constants.expoConfig?.extra as { openaiApiKey?: string } | undefined;
  const fromExtra = extra?.openaiApiKey?.trim();
  if (fromExtra) return fromExtra;

  return undefined;
}
