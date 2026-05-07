const PRODUCT_REGISTRY: Array<{
  canonical: string;
  aliases: string[];
  units: string[];
}> = [
  { canonical: "milk", aliases: ["milk", "fresh milk", "evap milk"], units: ["200ml", "500ml", "1L"] },
  { canonical: "coffee", aliases: ["coffee", "instant coffee"], units: ["25g", "50g", "100g"] },
  { canonical: "sugar", aliases: ["sugar", "brown sugar", "white sugar"], units: ["250g", "500g", "1kg"] },
  { canonical: "rice", aliases: ["rice"], units: ["1kg", "5kg", "10kg"] },
  { canonical: "cooking oil", aliases: ["oil", "cooking oil"], units: ["250ml", "500ml", "1L"] },
  { canonical: "soy sauce", aliases: ["soy sauce", "toyo"], units: ["150ml", "350ml", "1L"] },
  { canonical: "fish sauce", aliases: ["fish sauce", "patis"], units: ["150ml", "350ml", "1L"] },
  { canonical: "vinegar", aliases: ["vinegar", "suka"], units: ["250ml", "500ml", "1L"] },
  { canonical: "egg", aliases: ["egg", "eggs"], units: ["pc", "6pcs", "12pcs"] },
  { canonical: "bread", aliases: ["bread", "loaf bread"], units: ["loaf", "pack"] },
  { canonical: "butter", aliases: ["butter", "margarine"], units: ["100g", "225g", "500g"] },
  { canonical: "cheese", aliases: ["cheese"], units: ["165g", "200g", "500g"] },
  { canonical: "apple", aliases: ["apple", "apples"], units: ["pc", "500g", "1kg"] },
  { canonical: "banana", aliases: ["banana", "bananas"], units: ["pc", "500g", "1kg"] },
  { canonical: "chicken", aliases: ["chicken"], units: ["500g", "1kg"] },
  { canonical: "pork", aliases: ["pork"], units: ["500g", "1kg"] },
  { canonical: "beef", aliases: ["beef"], units: ["500g", "1kg"] },
  { canonical: "bear brand", aliases: ["bear brand"], units: ["33g", "300g", "840g"] },
  { canonical: "coke", aliases: ["coke", "coca cola", "coca-cola"], units: ["237ml", "330ml", "500ml", "1.5L"] },
];

const UNIT_PATTERN =
  /\b(\d+(?:\.\d+)?)\s?(ml|l|g|kg|mg|oz|lb|lbs|pcs?|pc|packs?|pack|bottles?|bottle|cans?|can)\b/i;

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeUnitSuffix(unit: string): string {
  const normalized = unit.trim().toLowerCase();
  if (normalized === "liter" || normalized === "liters") return "L";
  if (normalized === "pc" || normalized === "piece" || normalized === "pieces") return "pc";
  if (normalized === "lbs") return "lb";
  return normalized;
}

function normalizeDetectedUnit(raw: string): string {
  const m = raw.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)$/);
  if (!m) return raw.trim();
  const amount = m[1];
  const suffix = normalizeUnitSuffix(m[2]);
  const upper = suffix === "L" ? "L" : suffix;
  return `${amount}${upper}`;
}

export function extractUnitFromText(input: string): { cleanedName: string; unit: string } {
  const text = input.trim();
  if (!text) return { cleanedName: "", unit: "" };
  const m = text.match(UNIT_PATTERN);
  if (!m) return { cleanedName: text, unit: "" };
  const raw = `${m[1]}${m[2]}`;
  const cleanedName = text.replace(m[0], " ").replace(/\s+/g, " ").trim();
  return { cleanedName, unit: normalizeDetectedUnit(raw) };
}

export function lookupUnitsForItem(itemName: string): string[] {
  const q = normalizeName(itemName);
  if (!q) return [];
  const qTokens = new Set(q.split(" ").filter(Boolean));
  let bestUnits: string[] = [];
  let bestScore = 0;

  for (const entry of PRODUCT_REGISTRY) {
    for (const alias of entry.aliases) {
      const a = normalizeName(alias);
      if (!a) continue;
      const aTokens = a.split(" ").filter(Boolean);
      let score = 0;
      if (q === a) score += 100;
      if (q.includes(a) || a.includes(q)) score += 20;
      for (const t of aTokens) {
        if (qTokens.has(t)) score += 5;
      }
      if (score > bestScore) {
        bestScore = score;
        bestUnits = entry.units;
      }
    }
  }

  if (bestScore < 10) return [];
  return [...bestUnits];
}
