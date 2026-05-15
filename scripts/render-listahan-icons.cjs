/**
 * Rasterizes branding SVGs into PNGs used by the app.
 * Run after updating files in assets/branding/:
 *   npm run icons:brand
 *
 * - listahan-logo-drawer.svg → assets/icon.png, assets/adaptive-icon.png
 * - listahan-logo-horizontal.svg → assets/branding/listahan-logo-horizontal.png (dashboard header)
 */
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const root = path.join(__dirname, "..");
const drawer = path.join(root, "assets", "branding", "listahan-logo-drawer.svg");
const horizontal = path.join(root, "assets", "branding", "listahan-logo-horizontal.svg");

async function main() {
  if (!fs.existsSync(drawer)) {
    throw new Error(`Missing drawer SVG: ${drawer}`);
  }
  if (!fs.existsSync(horizontal)) {
    throw new Error(`Missing horizontal SVG: ${horizontal}`);
  }

  const drawerPng = await sharp(drawer)
    .resize(1024, 1024, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  await sharp(drawerPng).toFile(path.join(root, "assets", "icon.png"));
  await sharp(drawerPng).toFile(path.join(root, "assets", "adaptive-icon.png"));
  // eslint-disable-next-line no-console
  console.log("Wrote assets/icon.png and assets/adaptive-icon.png from listahan-logo-drawer.svg");

  const horizOut = path.join(root, "assets", "branding", "listahan-logo-horizontal.png");
  await sharp(horizontal)
    .trim()
    .resize(1200, null, {
      fit: "inside",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(horizOut);
  // eslint-disable-next-line no-console
  console.log("Wrote assets/branding/listahan-logo-horizontal.png from listahan-logo-horizontal.svg");
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
