/**
 * Debug probe: verifies expo-notifications resolves (Metro needs this in node_modules).
 * Writes one NDJSON line to debug-52ce9e.log in cwd. Run: npm run debug:deps
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const logPath = path.join(root, "debug-52ce9e.log");
const pkgPath = path.join(root, "node_modules", "expo-notifications", "package.json");
const exists = fs.existsSync(pkgPath);
const require = createRequire(path.join(root, "package.json"));
let resolveOk = false;
try {
  require.resolve("expo-notifications");
  resolveOk = true;
} catch {
  resolveOk = false;
}
const line = JSON.stringify({
  sessionId: "52ce9e",
  hypothesisId: "H1_node_modules",
  location: "scripts/debug-deps-probe.mjs",
  message: exists ? "expo_notifications_pkg_found" : "expo_notifications_pkg_missing",
  data: { pkgPath, exists, resolveOk, cwd: root },
  timestamp: Date.now(),
  runId: "probe",
}) + "\n";
fs.appendFileSync(logPath, line, "utf8");
console.log(exists ? "[debug:deps] expo-notifications OK" : "[debug:deps] MISSING expo-notifications — run npm install");
process.exit(exists ? 0 : 1);
