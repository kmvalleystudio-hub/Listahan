Listahan — image assets

## Branding (source)

| File | Use |
|------|-----|
| `branding/listahan-logo-horizontal.svg` | Source for the **dashboard header** PNG (see below). |
| `branding/listahan-logo-horizontal.png` | **Generated** — wide logo for the tools screen header. Do not hand-edit; run `npm run icons:brand`. |
| `branding/listahan-logo-drawer.svg` | Source for **launcher** icons (see below). |

Replace the SVGs in `branding/` when the design team ships updates, then run:

```bash
npm run icons:brand
```

That rasterizes `listahan-logo-drawer.svg` into:

- `icon.png` — Expo / iOS / Android app icon
- `adaptive-icon.png` — Android adaptive foreground

## Legacy paths (Expo `app.json`)

- `splash-icon.png` — splash center image (update manually if you add a horizontal splash asset).

After changing launcher artwork, rebuild the dev client or store build so the home screen / app drawer icon updates.
