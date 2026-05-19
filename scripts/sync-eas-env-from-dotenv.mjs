/**
 * Push EXPO_PUBLIC_* variables from local .env to EAS (preview environment).
 * Run from project root: node scripts/sync-eas-env-from-dotenv.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env");

if (!fs.existsSync(envPath)) {
  console.error("Missing .env — copy .env.example and set EXPO_PUBLIC_SUPABASE_* (and optional OpenAI key).");
  process.exit(1);
}

const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
const vars = [];
for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq < 0) continue;
  const name = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  if (name.startsWith("EXPO_PUBLIC_") && value) vars.push({ name, value });
}

if (vars.length === 0) {
  console.error("No EXPO_PUBLIC_* entries in .env");
  process.exit(1);
}

for (const { name, value } of vars) {
  // EXPO_PUBLIC_* is inlined into the app bundle — EAS rejects "secret" for these names.
  const visibility = /KEY|SECRET|TOKEN/i.test(name) ? "sensitive" : "plaintext";
  console.log(`\n→ ${name} (${visibility})`);
  const r = spawnSync(
    "npx",
    [
      "eas-cli",
      "env:create",
      "preview",
      "--name",
      name,
      "--value",
      value,
      "--environment",
      "preview",
      "--visibility",
      visibility,
      "--non-interactive",
      "--force",
    ],
    { cwd: root, stdio: "inherit", shell: process.platform === "win32" }
  );
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log("\nDone. Verify: npx eas-cli env:list --environment preview");
