import { APP_DISPLAY_NAME } from "./appBranding";

export type PrivacySection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  /** When both are set, show bullets before paragraphs (default: after). */
  bulletsFirst?: boolean;
};

export const PRIVACY_POLICY_LAST_UPDATED = "May 19, 2026";

export const PRIVACY_POLICY_INTRO =
  `${APP_DISPLAY_NAME} is built for personal lists and notes on your phone. This page explains what stays on your device, what may go to the cloud, and what choices you have.`;

export const PRIVACY_POLICY_SECTIONS: PrivacySection[] = [
  {
    title: "The short version",
    paragraphs: [
      "Your grocery lists, to-dos, notes, and reminders are stored on your phone unless you choose to sync or share them.",
      "Your vault PIN never leaves your device. Vault passwords are only uploaded if you explicitly turn on Vault sync with someone you trust.",
      "We do not sell your data. We do not let other Listahan users browse or search your private content.",
    ],
  },
  {
    title: "What stays on your device",
    bulletsFirst: true,
    bullets: [
      "Grocery, to-do, notes, and reminder content (by default)",
      "Vault PIN and biometric unlock settings",
      "App preferences such as theme and text size",
    ],
    paragraphs: [
      "This data remains in local storage on your phone until you delete it or uninstall the app.",
    ],
  },
  {
    title: "Profile information (cloud)",
    paragraphs: [
      "If cloud features are enabled, we store a small public profile so you can sync with someone you choose:",
    ],
    bullets: [
      "Username and public tag (for example @name_ab12)",
      "Optional profile portrait",
      "A random device user ID (not your phone number or email)",
    ],
  },
  {
    title: "User sync (optional)",
    paragraphs: [
      "Sync is always optional and only with a person you invite using their exact public tag. There is no public user search.",
      "You choose which tools to share (grocery, to-do, notes, reminders, and optionally Vault).",
      "When a tool is enabled for sync, that tool’s data is stored in our secure cloud database so both devices can stay up to date.",
      "When you end sync, each device can restore its own backup from before the session.",
    ],
  },
  {
    title: "Vault",
    paragraphs: [
      "Vault is for sensitive entries on your device. Vault sync is off by default.",
      "If you enable Vault sync, vault sheet contents are uploaded for your sync partner only. Your vault PIN is not uploaded.",
      "You can turn off Vault sync in Vault settings at any time.",
    ],
  },
  {
    title: "Share and import codes",
    paragraphs: [
      "When you export a grocery list, to-do list, or reminder as a share code, a copy may be stored in the cloud for a limited time so the other person can import it.",
      "Only people with your code can access that export—not the whole Listahan community.",
    ],
  },
  {
    title: "Who can access cloud data",
    paragraphs: [
      "Your sync partner can see data for tools you have turned on while you are synced.",
      "Listahan’s service provider (cloud hosting) processes stored data to run the app.",
      "The app developer can access cloud-stored data when necessary to operate, secure, and fix the service—your vault PIN still cannot be read from the cloud because it is never sent.",
    ],
  },
  {
    title: "What we do not do",
    bullets: [
      "Sell or rent your personal content to advertisers",
      "Show your lists or vault to other users without your action",
      "Upload vault data unless you opt in to Vault sync",
      "Require an email or phone number to use the app",
    ],
  },
  {
    title: "Your choices",
    bulletsFirst: true,
    bullets: [
      "Use the app offline without sync",
      "Decline or end sync at any time",
      "Keep Vault local by leaving Vault sync disabled",
      "Delete content in the app or uninstall to remove local data",
    ],
    paragraphs: [
      "For cloud data tied to your profile, contact support if you need help deleting your public profile row.",
    ],
  },
  {
    title: "Children",
    paragraphs: [
      `${APP_DISPLAY_NAME} is not directed at children under 13. We do not knowingly collect personal information from children.`,
    ],
  },
  {
    title: "Changes",
    paragraphs: [
      "We may update this page when features change. The date at the top shows when it was last revised.",
    ],
  },
];

export const PRIVACY_POLICY_FOOTER =
  "Questions? Use Report a problem or General feedback in Settings. We will add a dedicated contact address before store release.";
