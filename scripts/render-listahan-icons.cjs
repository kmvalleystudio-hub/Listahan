/**
 * Rasterizes branding SVGs into PNGs used by the app.
 * Run after updating files in assets/branding/:
 *   npm run icons:brand
 *
 * - listahan-logo-drawer.png (preferred) or listahan-logo-drawer.svg → assets/icon.png, assets/adaptive-icon.png
 * - listahan-logo-horizontal.svg → listahan-logo-horizontal.png (dashboard header in light UI)
 * - listahan-logo-horizontal-on-dark.svg → listahan-logo-horizontal-on-dark.png (dashboard header in dark UI)
 */
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const root = path.join(__dirname, "..");
const drawerPngSource = path.join(root, "assets", "branding", "listahan-logo-drawer.png");
const drawerSvgSource = path.join(root, "assets", "branding", "listahan-logo-drawer.svg");
const horizontal = path.join(root, "assets", "branding", "listahan-logo-horizontal.svg");
const horizontalOnDark = path.join(root, "assets", "branding", "listahan-logo-horizontal-on-dark.svg");

async function main() {
  const drawerSource = fs.existsSync(drawerPngSource) ? drawerPngSource : drawerSvgSource;
  if (!fs.existsSync(drawerSource)) {
    throw new Error(`Missing drawer logo: ${drawerPngSource} or ${drawerSvgSource}`);
  }
  if (!fs.existsSync(horizontal)) {
    throw new Error(`Missing horizontal SVG: ${horizontal}`);
  }
  if (!fs.existsSync(horizontalOnDark)) {
    throw new Error(`Missing dark-UI horizontal SVG: ${horizontalOnDark}`);
  }

  const drawerPng = await sharp(drawerSource)
    .resize(1024, 1024, {
      fit: "contain",
      background: { r: 249, g: 246, b: 242, alpha: 1 },
    })
    .png()
    .toBuffer();

  await sharp(drawerPng).toFile(path.join(root, "assets", "icon.png"));
  await sharp(drawerPng).toFile(path.join(root, "assets", "adaptive-icon.png"));
  // eslint-disable-next-line no-console
  console.log(
    `Wrote assets/icon.png and assets/adaptive-icon.png from ${path.basename(drawerSource)}`
  );

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

  const horizDarkOut = path.join(root, "assets", "branding", "listahan-logo-horizontal-on-dark.png");
  await sharp(horizontalOnDark)
    .trim()
    .resize(1200, null, {
      fit: "inside",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(horizDarkOut);
  // eslint-disable-next-line no-console
  console.log(
    "Wrote assets/branding/listahan-logo-horizontal-on-dark.png from listahan-logo-horizontal-on-dark.svg"
  );
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
