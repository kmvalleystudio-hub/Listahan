import { parseBulkTranscriptLocal } from "./parseBulkTranscriptLocal";
import { extractUnitFromText, lookupCanonicalItemName, lookupUnitsForItem } from "./productRegistry";

export type ParsedScanItem = {
  name: string;
  quantity: string;
  unit: string;
  unitOptions: string[];
  price: string;
};

export function parseScannedListLocal(text: string): ParsedScanItem[] {
  const cleaned = text.replace(/\r/g, "\n").trim();
  if (!cleaned) return [];

  const lines = cleaned
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const out: ParsedScanItem[] = [];
  const stripLeadingDash = (value: string) => value.replace(/^[-–—]+\s*/, "").trim();

  for (const line of lines) {
    const byBulk = parseBulkTranscriptLocal(line);
    if (byBulk.length > 0) {
      out.push(
        ...byBulk.map((b) => ({
          name: lookupCanonicalItemName(stripLeadingDash(b.name)),
          quantity: b.quantity,
          unit: b.unit,
          unitOptions: b.unitOptions,
          price: b.price,
        }))
      );
      continue;
    }

    const parsed = extractUnitFromText(line);
    const rawName = stripLeadingDash(parsed.cleanedName || line);
    const name = lookupCanonicalItemName(rawName);
    if (!name.trim()) continue;
    out.push({
      name,
      quantity: "1",
      unit: parsed.unit,
      unitOptions: lookupUnitsForItem(name),
      price: "",
    });
  }

  return out;
}
