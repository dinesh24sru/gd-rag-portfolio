import { PermanentIngestionError } from "@gd-rag/shared";
import { isAllowedContentType } from "../documents/limits";

async function extractPdf(body: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(body);
  const result = await extractText(pdf, { mergePages: true });
  const text = Array.isArray(result.text) ? result.text.join("\n") : String(result.text ?? "");
  return text;
}

/** Extract UTF-8 text from an uploaded original. PDF via unpdf; text/markdown as UTF-8. */
export async function extractTextFromObject(params: {
  body: Uint8Array;
  contentType: string;
}): Promise<string> {
  const contentType = params.contentType.trim().toLowerCase();
  if (!isAllowedContentType(contentType)) {
    throw new PermanentIngestionError(`Unsupported contentType: ${contentType}`);
  }

  let text: string;
  if (contentType === "application/pdf") {
    try {
      text = await extractPdf(params.body);
    } catch (err) {
      const message = err instanceof Error ? err.message : "PDF extraction failed";
      throw new PermanentIngestionError(message);
    }
  } else {
    text = new TextDecoder("utf-8", { fatal: false }).decode(params.body);
  }

  const normalized = text.replace(/\u0000/g, "").trim();
  if (!normalized) {
    throw new PermanentIngestionError("Document produced no extractable text");
  }
  return normalized;
}
