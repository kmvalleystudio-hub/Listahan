export async function runOcrFromImageBase64(base64: string): Promise<string> {
  const body = new URLSearchParams();
  body.append("language", "eng");
  body.append("isOverlayRequired", "false");
  body.append("OCREngine", "2");
  body.append("scale", "true");
  body.append("base64Image", `data:image/jpeg;base64,${base64}`);

  const res = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    headers: {
      apikey: "helloworld",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error("OCR request failed.");
  }

  const json = (await res.json()) as {
    IsErroredOnProcessing?: boolean;
    ErrorMessage?: string[] | string;
    ParsedResults?: Array<{ ParsedText?: string }>;
  };

  if (json.IsErroredOnProcessing) {
    const msg = Array.isArray(json.ErrorMessage) ? json.ErrorMessage.join(", ") : json.ErrorMessage;
    throw new Error(msg || "OCR processing failed.");
  }

  const text = (json.ParsedResults ?? [])
    .map((p) => p.ParsedText ?? "")
    .join("\n")
    .trim();

  return text;
}

export async function runOcrFromImageUri(imageUri: string): Promise<string> {
  const form = new FormData();
  form.append("file", {
    uri: imageUri,
    name: "scan.jpg",
    type: "image/jpeg",
  } as unknown as Blob);
  form.append("language", "eng");
  form.append("isOverlayRequired", "false");
  form.append("OCREngine", "2");
  form.append("scale", "true");

  const res = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    headers: { apikey: "helloworld" },
    body: form,
  });
  if (!res.ok) throw new Error("OCR request failed.");

  const json = (await res.json()) as {
    IsErroredOnProcessing?: boolean;
    ErrorMessage?: string[] | string;
    ParsedResults?: Array<{ ParsedText?: string }>;
  };
  if (json.IsErroredOnProcessing) {
    const msg = Array.isArray(json.ErrorMessage) ? json.ErrorMessage.join(", ") : json.ErrorMessage;
    throw new Error(msg || "OCR processing failed.");
  }
  return (json.ParsedResults ?? [])
    .map((p) => p.ParsedText ?? "")
    .join("\n")
    .trim();
}
