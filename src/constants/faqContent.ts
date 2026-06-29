import { APP_DISPLAY_NAME } from "./appBranding";
import { SUPPORT_EMAIL } from "./supportContact";

export type FaqItem = {
  question: string;
  answer: string;
  bullets?: string[];
};

export type FaqSection = {
  title: string;
  items: FaqItem[];
};

export const FAQ_LAST_UPDATED = "May 19, 2026";

export const FAQ_INTRO =
  `Quick answers for ${APP_DISPLAY_NAME}. Tap a topic below. Still stuck? Use Report a problem or General feedback in Settings — we read ${SUPPORT_EMAIL}.`;

export const FAQ_SECTIONS: FaqSection[] = [
  {
    title: "Getting started",
    items: [
      {
        question: "What is Listahan?",
        answer: `${APP_DISPLAY_NAME} is a personal productivity app: grocery lists with prices, to-dos, notes, reminders, and a secure Vault for sensitive lines. Everything works on your phone first; cloud sync and share codes are optional.`,
      },
      {
        question: "How do I open a tool?",
        answer: "From the home dashboard, tap a tile (Grocery, To-do, Notes, Reminder, or Vault). Use the back arrow or dashboard icon in the header to return home.",
      },
      {
        question: "How do I reorder dashboard tiles?",
        answer: "Long-press any tool tile until it wiggles, then drag to reorder. Tap Done or leave reorder mode when finished.",
        bullets: ["The greeting card explains: tap a tile, long-press to reorder."],
      },
      {
        question: "Where are Settings and Profile?",
        answer:
          "Profile (portrait, username, public tag, theme, text size) is opened from the person icon on the dashboard. Notifications, FAQ, privacy policy, and app version are under Settings (gear icon).",
      },
    ],
  },
  {
    title: "Grocery lists",
    items: [
      {
        question: "How do I create a grocery list?",
        answer: "Open Grocery → tap + → enter a list name. Open the list to add items.",
      },
      {
        question: "How do I add items?",
        answer: "Inside a list, tap + (or the expandable + button) → Add Item. Enter name, quantity, unit, and optional price.",
        bullets: [
          "Import with Code/QR merges items into the current list.",
          "Add bulk by Voice records a spoken list and splits it into rows.",
        ],
      },
      {
        question: "What happens when I check off every item?",
        answer:
          "The list stays on your home screen in a Completed section with a Done badge. Long-press it to Repeat This List or move it to Groceries Archive.",
      },
      {
        question: "Where do archived lists go?",
        answer: "Grocery → Groceries Archive (history). Open a row to preview; you can restore or delete from there.",
      },
    ],
  },
  {
    title: "Voice entry",
    items: [
      {
        question: "Why doesn’t voice work in Expo Go?",
        answer:
          "Speech recognition needs a development or release build installed on your phone (not the generic Expo Go app). Build with EAS or run a native Android build.",
      },
      {
        question: "How does bulk voice formatting work?",
        answer: "Say the quantity first, then the item name. Say AND (or use a comma) before the next item.",
        bullets: [
          "Example: one milk and two eggs and one coffee",
          "Example: 3 milk, 2 bread, 1 coffee",
          "Tap the (i) info icon on the bulk voice screen for the full format reminder.",
        ],
      },
      {
        question: "Can I add a single item by voice?",
        answer: "Yes — in Add Item, tap the mic next to the name field (in a dev/release build with microphone permission).",
      },
    ],
  },
  {
    title: "Import & share codes",
    items: [
      {
        question: "How do I import someone else’s list?",
        answer:
          "If you have a share code or QR: from Grocery/To-do home you can open Import, or inside a list use + → Import with Code/QR to merge into that list.",
        bullets: [
          "Paste the code, scan a QR with the camera, or pick a QR image from your photos.",
          "Import needs cloud configuration; if it fails, check your network and app version.",
        ],
      },
      {
        question: "How do I share my list?",
        answer:
          "Open a list → share/export flow (from list actions) to create a code or QR. Your partner imports it on their device.",
      },
    ],
  },
  {
    title: "Sync with another person",
    items: [
      {
        question: "How does user sync work?",
        answer:
          "Sync links two Listahan users so chosen tools (grocery, to-do, notes, reminders, and optionally Vault) can stay aligned. It is invite-only — there is no public user search.",
        bullets: [
          "Open Sync from the dashboard or Profile.",
          "Ask your partner for their full public tag from Profile (e.g. john_t1ci — the part after @).",
          "Enter it exactly on the Sync screen → Look up → send or accept a request.",
        ],
      },
      {
        question: "Why can’t I find someone by name?",
        answer:
          "There is no username search. You must enter their complete public tag (username plus 4-character suffix) exactly as shown on their Profile screen.",
      },
      {
        question: "How do I include Vault in sync?",
        answer:
          "Vault sync is off by default. In Vault → Settings, turn on Include Vault in user sync and confirm with your vault PIN (not biometrics). Your partner must accept sync with vault enabled on their side too.",
      },
    ],
  },
  {
    title: "Vault",
    items: [
      {
        question: "What is Vault for?",
        answer:
          "Passwords, PINs, recovery codes, and other sensitive lines — stored on your device. There is no grocery-style check-off flow.",
      },
      {
        question: "Is my vault PIN uploaded?",
        answer: "No. Your PIN and biometric unlock settings stay on this device. Only sheet contents upload if you explicitly enable Vault sync with a trusted partner.",
      },
      {
        question: "I forgot my vault PIN",
        answer:
          "Use Forgot PIN on the vault lock screen and answer your recovery question. If that fails, vault data cannot be recovered — this protects your secrets.",
      },
    ],
  },
  {
    title: "To-do, Notes & Reminders",
    items: [
      {
        question: "To-do lists",
        answer:
          "Same pattern as grocery: create a list, add tasks, check them off. Completed lists can be archived to To-dos Archive. Some lists support timers/chimes.",
      },
      {
        question: "Notes",
        answer: "Quick capture — tap + for a new note. Long-press a note on the home list to delete.",
      },
      {
        question: "Reminders not firing?",
        answer:
          "Allow notifications for Listahan in system settings (Settings → Notifications opens system settings). On Android, exact-time reminders may need alarm permission — accept when prompted.",
        bullets: ["Set the date at least one minute in the future.", "Reminders need the app installed; they are not SMS."],
      },
    ],
  },
  {
    title: "Data & privacy",
    items: [
      {
        question: "Is my data stored in the cloud?",
        answer:
          "Lists, notes, and reminders stay on your phone by default. A small public profile (username, tag, optional portrait) and sync data go to the cloud only when you use sync or share features.",
      },
      {
        question: "Does Listahan work offline?",
        answer: "Yes for local lists. Sync, share import, and profile portrait upload need internet.",
      },
      {
        question: "Where is the privacy policy?",
        answer: "Settings → Privacy policy. It explains what stays on-device vs what may sync.",
      },
    ],
  },
  {
    title: "Troubleshooting",
    items: [
      {
        question: "App says it can’t connect to Metro",
        answer:
          "That message appears in developer builds when the PC bundler isn’t running. Install a release or preview APK/AAB from a proper build — the published app does not need Metro.",
      },
      {
        question: "Sync or import says to add Supabase",
        answer:
          "The build you installed may be missing cloud environment keys. Install an official build from the developer; sideload test builds from a dev PC may not include sync.",
      },
      {
        question: "Still need help?",
        answer: `Email us at ${SUPPORT_EMAIL} via Settings → Report a problem or General feedback. Include your Android version and what you were trying to do.`,
      },
    ],
  },
];
