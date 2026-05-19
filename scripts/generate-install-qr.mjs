/**
 * Generate a QR code PNG (+ simple HTML page) that points to an APK install URL.
 *
 * Usage:
 *   node scripts/generate-install-qr.mjs "https://expo.dev/artifacts/eas/....apk"
 *   npm run qr:install -- "https://..."
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const url = process.argv[2]?.trim();
if (!url) {
  console.error("Usage: node scripts/generate-install-qr.mjs <APK_OR_INSTALL_URL>");
  console.error("Get a URL from: npm run build:apk  (then open the EAS build page)");
  process.exit(1);
}

const outDir = path.join(root, "dist", "install");
fs.mkdirSync(outDir, { recursive: true });

const pngPath = path.join(outDir, "listahan-install-qr.png");
const htmlPath = path.join(outDir, "install.html");

await QRCode.toFile(pngPath, url, {
  type: "png",
  width: 512,
  margin: 2,
  color: { dark: "#0f172a", light: "#ffffff" },
});

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Listahan — Install</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 420px; margin: 40px auto; padding: 0 20px; text-align: center; color: #0f172a; }
    img { width: 280px; height: 280px; }
    a { color: #5f6f22; word-break: break-all; }
    p { line-height: 1.5; color: #475569; }
  </style>
</head>
<body>
  <h1>Listahan</h1>
  <p>Scan to download the Android APK (current preview build).</p>
  <img src="listahan-install-qr.png" alt="Install QR code" />
  <p><a href="${url.replace(/"/g, "&quot;")}">Open install link</a></p>
  <p>On Android: allow install from browser/Files if prompted, then open the APK.</p>
</body>
</html>
`;

fs.writeFileSync(htmlPath, html, "utf8");

console.log("Wrote:", pngPath);
console.log("Wrote:", htmlPath);
console.log("URL:", url);
