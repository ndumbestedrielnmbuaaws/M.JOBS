import "server-only";
import mammoth from "mammoth";
import { extractText as extractPdfText, getDocumentProxy } from "unpdf";
import { AppError } from "./http";

export { MAX_CV_BYTES } from "./constants";

const MIN_TEXT_CHARS = 200;

export type CvKind = "pdf" | "docx";

export const CV_MIME: Record<CvKind, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

// Check magic bytes: the browser-supplied MIME type can be anything
export function detectKind(buf: Buffer): CvKind | null {
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) return "docx";
  return null;
}

export async function extractText(buf: Buffer, kind: CvKind): Promise<string> {
  let text: string;
  try {
    if (kind === "pdf") {
      const doc = await getDocumentProxy(new Uint8Array(buf));
      text = (await extractPdfText(doc, { mergePages: true })).text;
    } else {
      text = (await mammoth.extractRawText({ buffer: buf })).value;
    }
  } catch {
    throw new AppError("Could not read the file. Is it a valid PDF or DOCX?", 422);
  }

  text = text
    .replace(/\u0000/g, "") // Postgres rejects null bytes
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (text.length < MIN_TEXT_CHARS)
    throw new AppError("No readable text found. The PDF may be a scanned image; upload a text-based PDF or DOCX.", 422);

  return text;
}
