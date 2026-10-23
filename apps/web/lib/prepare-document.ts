import { readUploadResponse } from "./upload-response";
import type { DocumentRecord } from "./contracts";
export async function prepareDocument(id: string, onProgress?: (message: string) => void, reread = false): Promise<DocumentRecord> {
  onProgress?.("Reading the document…");
  let result = await readUploadResponse(await fetch(`/api/documents/${id}`, { cache: "no-store" }), "Loading document");
  if (reread || !result.document.extracted || (!result.document.extracted.ocr && !result.document.extracted.source_text?.trim())) result = await readUploadResponse(await fetch(`/api/documents/${id}/extract`, { method: "POST" }), "Reading document");
  let document = result.document as DocumentRecord;
  while (document.extracted?.ocr?.pendingPages.length) {
    const before = document.extracted.ocr.pendingPages.length;
    onProgress?.(`OCR: reading page ${document.extracted.ocr.pendingPages[0]} of ${document.extracted.quality.pages}…`);
    result = await readUploadResponse(await fetch(`/api/documents/${id}/ocr`, { method: "POST" }), "OCR transcription");
    document = result.document;
    if ((document.extracted?.ocr?.pendingPages.length ?? 0) >= before) throw new Error("OCR made no progress. Retry this document.");
  }
  // Reading a chat attachment must not replace a workpaper already edited by a reviewer.
  if (document.worksheet && !reread) return document;
  onProgress?.("Preparing journal proposals…");
  result = await readUploadResponse(await fetch(`/api/documents/${id}/classify`, { method: "POST" }), "Classifying document");
  return result.document;
}
