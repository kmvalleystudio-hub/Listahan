# Build an Android APK for Listahan

Use this when you want an **installable `.apk`** on a real phone (no USB to Metro required for *using* the app—the JS bundle is embedded in the build).

---

## Recommended: Expo Application Services (EAS) — build in the cloud

You run commands on your PC; Expo’s servers compile the native app. You need a **free Expo account**.

### Step 1 — Install EAS CLI (once)

Open **PowerShell** or **Command Prompt** and run:

```bash
npm install -g eas-cli
```

### Step 2 — Log in to Expo

```bash
eas login
```

Create an account at [expo.dev](https://expo.dev) if you don’t have one. Complete any browser verification it asks for.

### Step 3 — Go to your project folder

```bash
cd C:\SayCart
```

(Use your real project path if Listahan lives somewhere else.)

### Step 4 — Link the project to EAS (first time only)

```bash
eas init
```

If it asks, let it create or connect an **EAS project**. It may add an `extra.eas.projectId` field in `app.json`—**commit that** with the rest of your app.

### Step 5 — Push cloud env vars to EAS (required for Sync / share import)

Local `npx expo start` reads `.env` on your PC. **EAS cloud builds do not** unless you upload those variables.

From the project root (with `.env` containing `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and optional `EXPO_PUBLIC_OPENAI_API_KEY`):

```bash
npm run eas:env:sync
```

Verify:

```bash
npx eas-cli env:list --environment preview
```

You should see at least the two Supabase `EXPO_PUBLIC_*` entries. Re-run `eas:env:sync` after you change `.env`.

### Step 6 — Start the Android build (APK for sharing / sideload)

This repo includes `eas.json` with a **`preview`** profile that outputs an **APK** (not only an AAB).

One command (sync env + build):

```bash
npm run build:apk:full
```

Or build only (after env is already on EAS):

```bash
eas build -p android --profile preview
```

- The first time, EAS may ask you to **generate a new Android keystore** (say **yes** and let Expo store it). **Save any recovery instructions** it shows.
- Wait for the build to finish (often 10–20+ minutes). You’ll get a **URL** in the terminal.

### Step 7 — Download and install

1. Open the build URL on your phone (or download the APK on your PC and transfer it).
2. On Android: enable **Install unknown apps** for your browser or Files app if asked.
3. Install **Listahan**. Open it—it should run **without** needing `npx expo start` on your computer.

### Later updates

After you change app code and want a **new** APK:

```bash
eas build -p android --profile preview
```

---

## Optional: build on your own PC (advanced)

Requires **Android SDK**, **JDK**, and correct **`JAVA_HOME`** / `android/local.properties` (`sdk.dir`). From the project root:

```bash
npx expo prebuild
cd android
.\gradlew.bat assembleRelease
```

Release builds must be **signed**. If Gradle errors about signing, use **EAS** instead or follow [Android’s sign your release build](https://developer.android.com/studio/publish/app-signing) and configure `signingConfigs` in Gradle.

For a quick **debug** APK (not for Play Store):

```bash
cd android
.\gradlew.bat assembleDebug
```

APK path is typically under `android/app/build/outputs/apk/debug/`.

---

## Profiles in `eas.json` (short)

| Profile        | Output      | Typical use              |
|----------------|-------------|---------------------------|
| `preview`      | **APK**     | Sideload / internal tests |
| `production`   | **AAB**     | Google Play upload        |
| `development`  | APK + dev client | Debugging with dev menu |

---

## Troubleshooting

| Problem | What to try |
|--------|--------------|
| `eas: command not found` | Use `npx eas-cli …` instead of global install, or fix `npm -g` PATH. |
| Build fails on credentials | Run `eas credentials -p android` and follow prompts. |
| App opens but is blank / old JS | Run a **new** build after code changes; reinstall the new APK. |
| **No Sync button / import says “add Supabase”** | Run `npm run eas:env:sync`, then **rebuild** the APK (`npm run build:apk`). The previous APK was built without cloud env vars. |
| Voice doesn’t work | Same as dev: microphone permission; speech works best on a **physical device**. Also ensure `EXPO_PUBLIC_OPENAI_API_KEY` is on EAS preview if you use voice bulk add. |
