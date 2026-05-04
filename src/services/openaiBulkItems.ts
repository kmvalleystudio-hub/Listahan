import { getOpenAiApiKey } from "../constants/openaiConfig";

export type ParsedBulkItem = {
  name: string;
  quantity: string;
  price: string;
};

type OpenAiBulkResponse = {
  items: ParsedBulkItem[];
};

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";

function formatOpenAiRequestError(status: number, body: string): string {
  let apiMessage = "";
  try {
    const j = JSON.parse(body) as { error?: { message?: string } };
    apiMessage = j.error?.message?.trim() ?? "";
  } catch {
    /* ignore */
  }

  if (status === 429) {
    if (/quota|billing|plan|exceeded your current/i.test(apiMessage)) {
      return "Your OpenAI account has no usable quota (billing or credits). Open https://platform.openai.com/account/billing on a computer, add a payment method or credits, then try Bulk List again.";
    }
    return "OpenAI temporarily rate-limited this request. Wait a short time and try again.";
  }

  if (status === 401) {
    return "OpenAI rejected the API key. Check EXPO_PUBLIC_OPENAI_API_KEY in .env and restart Metro.";
  }

  if (apiMessage) {
    return `Couldn’t complete AI step (${status}): ${apiMessage}`;
  }

  return `OpenAI request failed (${status}).`;
}

function buildSystemPrompt(includePrice: boolean): string {
  const priceRules = includePrice
    ? `- price: per-unit amount only, digits and optional decimal (e.g. "12.50"); use "" if the user did not state a price`
    : `- price: always use empty string "" (this list does not track prices)`;

  return `You parse spoken grocery shopping lists into line items for a mobile app.
Output ONLY valid JSON with this exact shape (no markdown, no code fences):
{"items":[{"name":"","quantity":"","price":""}]}

Rules:
- name: concise product name only; do not put quantity or price in the name
- quantity: string the user can read (e.g. "3", "12"); default "1" if the user gave no quantity
${priceRules}
- Split separate products by commas, "and", "also", or clear breaks in the transcript
- Understand "3 pcs", "2 pieces", "two cans", "half dozen", "1 dozen" as quantities
- Ignore filler words; fix obvious speech-to-text errors when confident
- Omit items with empty or useless names; return at least one item when the transcript mentions any product`;
}

export async function parseBulkListTranscript(
  transcript: string,
  options: { includePrice: boolean }
): Promise<ParsedBulkItem[]> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    throw new Error(
      "OpenAI API key is missing. Add EXPO_PUBLIC_OPENAI_API_KEY to a .env file in the project root and restart Expo."
    );
  }

  const trimmed = transcript.trim();
  if (!trimmed) {
    throw new Error("No speech was captured. Try again and speak your list.");
  }

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        { role: "system", content: buildSystemPrompt(options.includePrice) },
        {
          role: "user",
          content: `Transcript:\n"""${trimmed}"""`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(formatOpenAiRequestError(res.status, errText));
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = data.choices?.[0]?.message?.content?.trim();
  if (!raw) {
    throw new Error("Empty response from OpenAI.");
  }

  let parsed: OpenAiBulkResponse;
  try {
    parsed = JSON.parse(raw) as OpenAiBulkResponse;
  } catch {
    throw new Error("Could not parse AI response. Try again with a clearer list.");
  }

  if (!Array.isArray(parsed.items)) {
    throw new Error("Invalid AI response shape.");
  }

  return parsed.items
    .map((row) => ({
      name: String(row.name ?? "").trim(),
      quantity: String(row.quantity ?? "1").trim() || "1",
      price: options.includePrice ? String(row.price ?? "").trim() : "",
    }))
    .filter((row) => row.name.length > 0);
}
