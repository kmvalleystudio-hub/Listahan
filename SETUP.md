# SayCart — setup and run

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS) and npm
- For physical devices: [Expo Go](https://expo.dev/go) or a [development build](https://docs.expo.dev/develop/development-builds/introduction/)

## 1. Install dependencies

From this project folder:

```bash
npm install
```

Align native-related packages with your Expo SDK (recommended):

```bash
npx expo install expo expo-speech-recognition @react-native-async-storage/async-storage react-native-gesture-handler react-native-reanimated react-native-screens react-native-safe-area-context
```

## 2. App icon and splash assets

`app.json` expects these files:

- `assets/icon.png`
- `assets/splash-icon.png`
- `assets/adaptive-icon.png`

Fastest way to get defaults: create a temporary Expo app and copy its `assets` folder into this project:

```bash
npx create-expo-app@latest _expo-assets --template blank-typescript
```

Then copy `_expo-assets/assets/*` into `./assets/` and delete `_expo-assets`.

## 3. Start the app

```bash
npx expo start
```

Press `i` / `a` for iOS simulator / Android emulator, or scan the QR code with Expo Go.

**Phone checklist (copy-paste):** see `samples/SAYCART_MOBILE_TEST.txt` — Metro, dev build, Wi‑Fi/tunnel/USB, and sample phrases for Bulk List by Voice.

**Installable APK (no Metro):** see `docs/BUILD_APK.md` — EAS cloud build or local Gradle.

## 4. Speech-to-text (important)

Voice uses the config plugin **`expo-speech-recognition`** in `app.json`. That **requires native code**.

- **Expo Go:** may or may not include the exact native module version for your SDK; if voice fails, use a **development build** (recommended for reliable speech).
- **Development build:**

  ```bash
  npx expo prebuild
  npx expo run:ios
  # or
  npx expo run:android
  ```

- **Permissions:** iOS/Android will prompt for microphone and speech recognition the first time you use the mic.
- **Accuracy:** results depend on the OS recognizer, language (`en-US` in code), accent, and background noise. Spoken prices are parsed with heuristics + `words-to-numbers` and may need manual correction.
- **Android Emulator + mic:** The virtual device does **not** use your PC mic until you enable it. In the emulator window, open **⋮ (More)** → **Microphone** → turn on **Virtual microphone uses host audio input**. If voice still fails, with the emulator running run `adb emu avd hostmicon`. Confirm Windows **Settings → System → Sound** shows input level when you talk; use a **physical phone** for the most dependable speech tests.

## 5. Changing the currency symbol

Edit `src/constants/currency.ts` and set `DEFAULT_CURRENCY_SYMBOL` (default is `₱`).

## Project layout

| Path | Purpose |
|------|---------|
| `App.tsx` | Navigation, providers, gesture root |
| `src/context/AppDataContext.tsx` | Lists + history + AsyncStorage |
| `src/storage/persist.ts` | Load/save keys and sanitization for disk |
| `src/screens/` | Home, create list, list detail, history, all-done |
| `src/hooks/useSpeechToText.ts` | Mic / speech recognition wrapper |
| `src/utils/parsePriceFromSpeech.ts` | Spoken → numeric price |
| `src/utils/items.ts` | Active vs completed sorting, “all done” check |

Data is stored under `@saycart/lists_v1` and `@saycart/history_v1` in AsyncStorage. Pending “CHECK” timers are **not** persisted (if the app is killed mid–2-second window, items revert to unchecked on next launch).

## 6. Bulk List by Voice (on-device)

The **Bulk List by Voice** banner records your speech, then **splits the transcript into rows** in `src/utils/parseBulkTranscriptLocal.ts`. **Format:** say **quantity first**, then the item name; say **AND** (or use a **comma**) before the next item—e.g. `one bear brand and two eggs and one coffee` or `3 milk, 2 bread`. **No internet and no API key** are required.

If you skip AND/commas and put multiple quantities in one phrase, parsing won’t know where one item ends—stick to the format above. **Spoken prices inside a long bulk phrase are not parsed**—use **Item Price** and edit lines, or add prices per item in the item modal.

Continuous speech works best on **Android 13+** (older versions may not support continuous recognition). Use a **development build** for microphone support (same as section 4).

*(Optional legacy code: `src/services/openaiBulkItems.ts` is unused; you can delete it if you standardize on local parsing only.)*
