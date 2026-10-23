import { getDocument, readDocumentFile, updateDocument } from "../../../../../lib/document-store";
import { listJournalPostings } from "../../../../../lib/journal-postings";
import { extractText, renderPdfPages } from "../../../../../lib/reader";
import { transcribePages } from "../../../../../lib/ocr";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id; const doc = await getDocument(id);
    if (!doc?.extracted) return Response.json({ error: "Read the document before running OCR." }, { status: 404 });
    if ((await listJournalPostings(id)).length) return Response.json({ error: "Submitted journals lock this document's source. Resolve the posting before changing extraction." }, { status: 409 });
    const pending = doc.extracted.ocr?.pendingPages ?? [];
    if (!pending.length) return Response.json({ document: doc });
    const batch = pending.slice(0, 2); const bytes = await readDocumentFile(id);
    let images: Array<{ page: number; data: Uint8Array }>;
    if (doc.contentType === "application/pdf") images = await renderPdfPages(bytes, batch);
    else if (doc.contentType.startsWith("image/")) {
      const { loadImage, createCanvas } = await import("@napi-rs/canvas");
      let image;
      try { image = await loadImage(Buffer.from(bytes)); } catch { return Response.json({ error: "This image format could not be decoded. Convert HEIC or unsupported images to PNG/JPEG and upload again." }, { status: 422 }); }
      const scale = Math.min(1, 2000 / Math.max(image.width, image.height));
      const canvas = createCanvas(Math.max(1, Math.round(image.width * scale)), Math.max(1, Math.round(image.height * scale))); canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      images = [{ page: 1, data: canvas.toBuffer("image/png") }];
    } else return Response.json({ error: "OCR is available for PDFs and images." }, { status: 400 });
    if (images.length !== batch.length) throw new Error("One of the requested PDF pages could not be rendered. Split the document and retry.");
    const recognized = await transcribePages(images);
    // Re-read to avoid dropping pages completed by another request.
    const latest = await getDocument(id); if (!latest?.extracted) return Response.json({ error: "Document is no longer available." }, { status: 404 });
    const pages = [...(latest.extracted.source_pages ?? [{ page: 1, text: "" }])].map((page) => recognized.find((item) => item.page === page.page) ?? page).sort((a,b) => a.page-b.page);
    const sourceText = pages.map((page) => page.text).join("\n\n");
    const extracted = extractText(sourceText, doc.filename);
    extracted.source_pages = pages; extracted.quality.pages = latest.extracted.quality.pages; extracted.quality.is_scanned = true;
    const processedPages = [...new Set([...(latest.extracted.ocr?.processedPages ?? []), ...recognized.map((page) => page.page)])];
    const pendingPages = (latest.extracted.ocr?.pendingPages ?? []).filter((page) => !processedPages.includes(page));
    extracted.quality.overall_confidence = Math.min(extracted.quality.overall_confidence, .7);
    extracted.quality.unreadable_regions = pages.filter((page) => !page.text.trim() || page.text.includes("[unreadable]")).length;
    extracted.ocr = { status: pendingPages.length ? "pending" : "complete", pendingPages, processedPages, warnings: ["AI OCR transcription requires comparison with the original file, especially dates, signs and amounts.", ...(extracted.quality.unreadable_regions ? ["Some pages contain blank or unreadable regions. Supply a clearer scan before relying on them."] : [])] };
    const document = await updateDocument(id, { extracted, state: "NEEDS_REVIEW", worksheet: undefined, classified: undefined, validation: undefined, error: undefined });
    return Response.json({ document, completedPages: recognized.map((page) => page.page) });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "OCR failed. Retry; completed pages are retained." }, { status: 502 }); }
}
