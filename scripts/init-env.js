/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Creates .env from .env.example if .env is missing (Windows-friendly).
 * Run: node scripts/init-env.js
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const target = path.join(root, ".env");
const example = path.join(root, ".env.example");

if (fs.existsSync(target)) {
  console.log("[Listahan] .env already exists at:\n  " + target);
  process.exit(0);
}

if (!fs.existsSync(example)) {
  console.error("[Listahan] Missing .env.example — cannot bootstrap.");
  process.exit(1);
}

fs.copyFileSync(example, target);
console.log("[Listahan] Created .env at:\n  " + target);
console.log("Open .env and set EXPO_PUBLIC_OPENAI_API_KEY=your_key, then: npx expo start --clear");
