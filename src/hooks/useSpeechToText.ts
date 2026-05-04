import Constants, { ExecutionEnvironment } from "expo-constants";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

type SpeechPack = typeof import("expo-speech-recognition");

export function useSpeechToText() {
  const [listening, setListening] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const onTextRef = useRef<(text: string) => void>(() => {});

  useEffect(() => {
    if (isExpoGo) return;
    let pack: SpeechPack;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      pack = require("expo-speech-recognition") as SpeechPack;
    } catch {
      return;
    }
    const { ExpoSpeechRecognitionModule } = pack;
    const subResult = ExpoSpeechRecognitionModule.addListener("result", (ev) => {
      const t = ev.results[0]?.transcript ?? "";
      onTextRef.current(t);
    });
    const subError = ExpoSpeechRecognitionModule.addListener("error", (ev) => {
      const raw = (ev.message ?? "Speech error").trim();
      const emulatorMicHint =
        Platform.OS === "android" &&
        /no speech|no match|speech timeout|didn.?t hear|couldn.?t hear/i.test(raw)
          ? " On the Android Emulator: open the ⋮ sidebar → Microphone → turn on “Virtual microphone uses host audio input.” Or run adb emu avd hostmicon. A physical device is most reliable."
          : "";
      setLastError(raw + emulatorMicHint);
      setListening(false);
    });
    const subEnd = ExpoSpeechRecognitionModule.addListener("end", () => {
      setListening(false);
    });
    return () => {
      subResult.remove();
      subError.remove();
      subEnd.remove();
    };
  }, []);

  const stop = useCallback(() => {
    if (!isExpoGo) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { ExpoSpeechRecognitionModule } = require("expo-speech-recognition") as SpeechPack;
        ExpoSpeechRecognitionModule.stop();
      } catch {
        /* noop */
      }
    }
    setListening(false);
  }, []);

  const start = useCallback(async (onText: (text: string) => void) => {
    onTextRef.current = onText;
    if (isExpoGo) {
      setLastError(
        "Voice isn’t available in Expo Go. Build a dev client with: npx expo run:android (or iOS). See SETUP.md."
      );
      return;
    }
    setLastError(null);
    let ExpoSpeechRecognitionModule: SpeechPack["ExpoSpeechRecognitionModule"];
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      ExpoSpeechRecognitionModule = (require("expo-speech-recognition") as SpeechPack)
        .ExpoSpeechRecognitionModule;
    } catch {
      setLastError("Speech recognition isn’t available in this build.");
      return;
    }
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      const ok =
        perm.granted === true ||
        perm.status === "granted" ||
        (Platform.OS === "web" && perm.granted !== false);
      if (!ok) {
        setLastError("Microphone or speech permission was denied.");
        return;
      }
    } catch (e) {
      setLastError(e instanceof Error ? e.message : "Permission error");
      return;
    }

    setListening(true);
    try {
      ExpoSpeechRecognitionModule.start({
        lang: "en-US",
        interimResults: true,
        maxAlternatives: 1,
        continuous: false,
        requiresOnDeviceRecognition: false,
      });
    } catch (e) {
      setListening(false);
      setLastError(e instanceof Error ? e.message : "Could not start recognition");
    }
  }, []);

  return { start, stop, listening, lastError };
}
