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
  { canonical: "cooked ham", aliases: ["cooked ham", "ham", "sweet ham"], units: ["100g", "250g", "500g"] },
  { canonical: "bear brand", aliases: ["bear brand"], units: ["33g", "300g", "840g"] },
  { canonical: "coke", aliases: ["coke", "coca cola", "coca-cola"], units: ["237ml", "330ml", "500ml", "1.5L"] },
  {
    canonical: "pancit canton",
    aliases: ["pancit canton", "extra big pancit canton", "pancit", "canton noodles"],
    units: ["pack", "200g", "500g"],
  },
  {
    canonical: "baby diaper",
    aliases: ["baby diaper", "diaper", "eq diaper", "eq diaper small", "diapers"],
    units: ["small", "medium", "large", "pc"],
  },
  {
    canonical: "evaporada",
    aliases: ["evaporada", "evaporated milk"],
    units: ["370ml", "500ml"],
  },
  { canonical: "tocino", aliases: ["tocino"], units: ["250g", "500g"] },
  {
    canonical: "dove soap",
    aliases: ["dove soap", "dove bar", "dove beauty bar"],
    units: ["90g", "135g", "pack"],
  },
  {
    canonical: "sunsilk shampoo",
    aliases: ["sunsilk", "sunsilk green", "sunsilk shampoo"],
    units: ["180ml", "200ml", "350ml"],
  },
  { canonical: "notebook", aliases: ["notebook", "notebooks", "school notebook"], units: ["pc", "pack"] },
  { canonical: "carrots", aliases: ["carrots", "carrot"], units: ["500g", "1kg", "pc"] },
  { canonical: "lemon juice", aliases: ["lemon", "lemon 3in1"], units: ["pc", "500ml", "1L"] },
];

const UNIT_PATTERN =
  /\b(\d+(?:\.\d+)?)\s?(ml|l|g|kg|mg|oz|lb|lbs|pcs?|pc|packs?|pack|bottles?|bottle|cans?|can)\b/i;

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
}

/** Single-word tokens from registry names/aliases (for OCR word trust + fuzzy match). */
export function getRegistryVocabularyTokens(): Set<string> {
  const s = new Set<string>();
  const addPhrase = (phrase: string) => {
    const n = normalizeName(phrase);
    if (!n) return;
    for (const part of n.split(" ").filter(Boolean)) {
      s.add(part);
    }
  };
  for (const entry of PRODUCT_REGISTRY) {
    addPhrase(entry.canonical);
    for (const a of entry.aliases) addPhrase(a);
  }
  return s;
}

function scoreAliasMatch(query: string, alias: string): number {
  if (!query || !alias) return 0;
  const qTokens = new Set(query.split(" ").filter(Boolean));
  const aTokens = alias.split(" ").filter(Boolean);
  let score = 0;
  if (query === alias) score += 100;
  if (query.includes(alias) || alias.includes(query)) score += 20;
  for (const t of aTokens) {
    if (qTokens.has(t)) score += 5;
  }
  return score;
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return dp[b.length];
}

function scoreTypoSimilarity(query: string, alias: string): number {
  if (!query || !alias) return 0;
  const distance = levenshteinDistance(query, alias);
  const maxLen = Math.max(query.length, alias.length);
  if (maxLen === 0) return 0;
  const similarity = 1 - distance / maxLen;
  if (similarity < 0.55) return 0;
  return Math.round(similarity * 30);
}

function bestRegistryMatch(itemName: string): { canonical: string; units: string[]; score: number } | null {
  const q = normalizeName(itemName);
  if (!q) return null;
  let best: { canonical: string; units: string[]; score: number } | null = null;

  for (const entry of PRODUCT_REGISTRY) {
    for (const alias of entry.aliases) {
      const a = normalizeName(alias);
      if (!a) continue;
      const score = scoreAliasMatch(q, a) + scoreTypoSimilarity(q, a);
      if (!best || score > best.score) {
        best = { canonical: entry.canonical, units: entry.units, score };
      }
    }
  }
  return best;
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
  const best = bestRegistryMatch(itemName);
  if (!best || best.score < 10) return [];
  return [...best.units];
}

export function lookupCanonicalItemName(itemName: string): string {
  const best = bestRegistryMatch(itemName);
  if (!best || best.score < 10) return itemName.trim();
  return best.canonical;
}

async function fetchOpenFoodFactsName(query: string): Promise<string> {
  const cleaned = query.trim();
  if (!cleaned) return "";
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
    cleaned
  )}&search_simple=1&action=process&json=1&page_size=8`;
  const res = await fetch(url);
  if (!res.ok) return "";
  const data = (await res.json()) as { products?: Array<{ product_name?: string }> };
  const candidate = data.products?.find((p) => p.product_name?.trim())?.product_name?.trim();
  return candidate ?? "";
}

export async function resolveTrustedProductName(itemName: string): Promise<{ name: string; unitOptions: string[] }> {
  const cleaned = itemName.replace(/^[-–—]+\s*/, "").trim();
  if (!cleaned) return { name: "", unitOptions: [] };

  const localBest = bestRegistryMatch(cleaned);
  if (localBest && localBest.score >= 18) {
    return { name: localBest.canonical, unitOptions: [...localBest.units] };
  }

  try {
    const apiName = await fetchOpenFoodFactsName(cleaned);
    if (apiName) {
      const canonical = lookupCanonicalItemName(apiName);
      const options = lookupUnitsForItem(canonical || apiName);
      return { name: canonical || apiName.trim(), unitOptions: options };
    }
  } catch {
    // Ignore network issues and use local fallback below.
  }

  const fallback = lookupCanonicalItemName(cleaned);
  return { name: fallback, unitOptions: lookupUnitsForItem(fallback) };
}
