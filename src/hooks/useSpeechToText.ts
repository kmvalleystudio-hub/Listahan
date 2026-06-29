import Constants, { ExecutionEnvironment } from "expo-constants";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

function friendlySpeechError(raw: string): string {
  const msg = raw.trim();
  if (!msg) return "Voice input didn't work. Try again.";
  if (/no speech|no match|speech timeout|didn.?t hear|couldn.?t hear/i.test(msg)) {
    return "Couldn't hear you. Try speaking again.";
  }
  if (/permission|denied|not allowed/i.test(msg)) {
    return "Microphone access is needed for voice input.";
  }
  if (msg.length > 120) return "Voice input didn't work. Try again.";
  return msg;
}

type SpeechPack = typeof import("expo-speech-recognition");

export type SpeechStartOptions = {
  /** Long-form dictation: accumulate finalized phrases; enables continuous recognition when supported. */
  bulk?: boolean;
};

export function useSpeechToText() {
  const [listening, setListening] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const onTextRef = useRef<(text: string) => void>(() => {});
  const modeRef = useRef<"single" | "bulk">("single");
  const bulkCommittedRef = useRef("");

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
      if (modeRef.current === "bulk") {
        const trimmed = t.trim();
        if (ev.isFinal && trimmed) {
          bulkCommittedRef.current = bulkCommittedRef.current
            ? `${bulkCommittedRef.current} ${trimmed}`
            : trimmed;
          onTextRef.current(bulkCommittedRef.current);
        }
      } else {
        onTextRef.current(t);
      }
    });
    const subError = ExpoSpeechRecognitionModule.addListener("error", (ev) => {
      setLastError(friendlySpeechError(ev.message ?? "Speech error"));
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

  const clearLastError = useCallback(() => setLastError(null), []);

  const start = useCallback(
    async (onText: (text: string) => void, options?: SpeechStartOptions) => {
      onTextRef.current = onText;
      const bulk = options?.bulk === true;
      modeRef.current = bulk ? "bulk" : "single";
      bulkCommittedRef.current = "";

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
          interimResults: !bulk,
          maxAlternatives: 1,
          continuous: bulk,
          addsPunctuation: bulk,
          requiresOnDeviceRecognition: false,
        });
      } catch (e) {
        setListening(false);
        setLastError(e instanceof Error ? e.message : "Could not start recognition");
      }
    },
    []
  );

  return { start, stop, listening, lastError, clearLastError };
}
