import { useFonts } from "expo-font";
import {
  Caveat_400Regular,
  Caveat_700Bold,
} from "@expo-google-fonts/caveat";
import {
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  Lato_400Regular,
  Lato_700Bold,
} from "@expo-google-fonts/lato";
import {
  Merriweather_400Regular,
  Merriweather_700Bold,
} from "@expo-google-fonts/merriweather";
import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
} from "@expo-google-fonts/nunito";
import {
  OpenSans_400Regular,
  OpenSans_700Bold,
} from "@expo-google-fonts/open-sans";
import {
  Poppins_400Regular,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";
import {
  Roboto_400Regular,
  Roboto_500Medium,
  Roboto_700Bold,
} from "@expo-google-fonts/roboto";
import type { TextStyle } from "react-native";

export type AppFontFamilyId =
  | "system"
  | "roboto"
  | "open_sans"
  | "lato"
  | "inter"
  | "nunito"
  | "poppins"
  | "merriweather"
  | "caveat";

export type AppFontFamilyOption = {
  id: AppFontFamilyId;
  label: string;
  hint: string;
};

export const DEFAULT_APP_FONT_FAMILY_ID: AppFontFamilyId = "system";

export const APP_FONT_FAMILY_OPTIONS: AppFontFamilyOption[] = [
  { id: "system", label: "System", hint: "Device default" },
  { id: "roboto", label: "Neutral", hint: "Roboto" },
  { id: "open_sans", label: "Readable", hint: "Open Sans" },
  { id: "lato", label: "Classic", hint: "Lato" },
  { id: "inter", label: "Modern", hint: "Inter" },
  { id: "nunito", label: "Rounded", hint: "Nunito" },
  { id: "poppins", label: "Friendly", hint: "Poppins" },
  { id: "merriweather", label: "Serif", hint: "Merriweather" },
  { id: "caveat", label: "Handwritten", hint: "Caveat" },
];

const FONT_FACE_BY_ID: Record<
  Exclude<AppFontFamilyId, "system">,
  { regular: string; semibold?: string; bold: string }
> = {
  roboto: {
    regular: "Roboto_400Regular",
    semibold: "Roboto_500Medium",
    bold: "Roboto_700Bold",
  },
  open_sans: {
    regular: "OpenSans_400Regular",
    bold: "OpenSans_700Bold",
  },
  lato: {
    regular: "Lato_400Regular",
    bold: "Lato_700Bold",
  },
  inter: {
    regular: "Inter_400Regular",
    semibold: "Inter_600SemiBold",
    bold: "Inter_700Bold",
  },
  nunito: {
    regular: "Nunito_400Regular",
    semibold: "Nunito_600SemiBold",
    bold: "Nunito_700Bold",
  },
  poppins: {
    regular: "Poppins_400Regular",
    semibold: "Poppins_600SemiBold",
    bold: "Poppins_700Bold",
  },
  merriweather: {
    regular: "Merriweather_400Regular",
    bold: "Merriweather_700Bold",
  },
  caveat: {
    regular: "Caveat_400Regular",
    bold: "Caveat_700Bold",
  },
};

export const APP_FONT_LOAD_MAP = {
  Roboto_400Regular,
  Roboto_500Medium,
  Roboto_700Bold,
  OpenSans_400Regular,
  OpenSans_700Bold,
  Lato_400Regular,
  Lato_700Bold,
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Poppins_400Regular,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Merriweather_400Regular,
  Merriweather_700Bold,
  Caveat_400Regular,
  Caveat_700Bold,
};

const PRESERVED_FONT_FAMILIES = new Set([
  "monospace",
  "Menlo",
  "CaveatRegular",
  "CaveatBold",
]);

export function normalizeAppFontFamilyId(value: unknown): AppFontFamilyId {
  if (typeof value === "string" && APP_FONT_FAMILY_OPTIONS.some((o) => o.id === value)) {
    return value as AppFontFamilyId;
  }
  return DEFAULT_APP_FONT_FAMILY_ID;
}

function numericFontWeight(weight: TextStyle["fontWeight"]): number {
  if (weight == null) return 400;
  if (typeof weight === "number") return weight;
  if (weight === "bold") return 700;
  if (weight === "normal") return 400;
  const parsed = Number.parseInt(weight, 10);
  return Number.isFinite(parsed) ? parsed : 400;
}

/** Pick a loaded font file for a text style (undefined = platform system font). */
export function resolveAppTextFontFamily(
  fontFamilyId: AppFontFamilyId,
  style: TextStyle
): string | undefined {
  if (fontFamilyId === "system") return undefined;
  const existing = style.fontFamily;
  if (existing && PRESERVED_FONT_FAMILIES.has(existing)) return existing;

  const faces = FONT_FACE_BY_ID[fontFamilyId];
  const weight = numericFontWeight(style.fontWeight);
  if (weight >= 700) return faces.bold;
  if (weight >= 600 && faces.semibold) return faces.semibold;
  return faces.regular;
}

/** Preview line in the font picker (regular weight). */
export function previewFontFamilyForId(fontFamilyId: AppFontFamilyId): string | undefined {
  if (fontFamilyId === "system") return undefined;
  return FONT_FACE_BY_ID[fontFamilyId].regular;
}

export function useAppFontAssets(): boolean {
  const [loaded] = useFonts(APP_FONT_LOAD_MAP);
  return loaded;
}
