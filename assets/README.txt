Listahan — image assets

## Branding (source)

| File | Use |
|------|-----|
| `branding/listahan-logo-horizontal.svg` | Source for **light UI** dashboard header PNG. |
| `branding/listahan-logo-horizontal.png` | **Generated** — header when the app is in light mode. |
| `branding/listahan-logo-horizontal-on-dark.svg` | Source for **dark UI** header PNG (from your `…-light` artwork). |
| `branding/listahan-logo-horizontal-on-dark.png` | **Generated** — header when the app is in dark mode. |
| `branding/listahan-logo-drawer.svg` | Source for **launcher** icons (see below). |

Replace the SVGs in `branding/` when the design team ships updates, then run:

```bash
npm run icons:brand
```

That rasterizes branding SVGs into:

- `icon.png` / `adaptive-icon.png` — from `listahan-logo-drawer.svg`
- `branding/listahan-logo-horizontal.png` — from `listahan-logo-horizontal.svg`
- `branding/listahan-logo-horizontal-on-dark.png` — from `listahan-logo-horizontal-on-dark.svg`

## Legacy paths (Expo `app.json`)

- `splash-icon.png` — splash center image (update manually if you add a horizontal splash asset).

After changing launcher artwork, rebuild the dev client or store build so the home screen / app drawer icon updates.
