import { extractCsv, extractDocx, extractPdf, extractSpreadsheet, extractText } from "../../../../../lib/reader";
import { getDocument, readDocumentFile, updateDocument } from "../../../../../lib/document-store";
import { listJournalPostings } from "../../../../../lib/journal-postings";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const record = await getDocument(id);
    if (!record) return Response.json({ error: "Document not found" }, { status: 404 });
    if ((await listJournalPostings(id)).length) return Response.json({ error: "This document has submitted journals. Resolve the posting results before replacing its extraction." }, { status: 409 });
    await updateDocument(id, { state: "EXTRACTING", error: undefined });
    const bytes = await readDocumentFile(id);
    const pdf = record.contentType === "application/pdf" ? await extractPdf(bytes) : null;
    const spreadsheet = ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"].includes(record.contentType) ? extractSpreadsheet(bytes, record.filename) : null;
    const image = record.contentType.startsWith("image/");
    const text = pdf?.text ?? spreadsheet?.text ?? (record.contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ? await extractDocx(bytes) : image ? "" : new TextDecoder().decode(bytes));
    const extracted = record.contentType === "text/csv" ? extractCsv(text) : extractText(text, record.filename);
    if (pdf) { extracted.quality.pages = pdf.pages; extracted.source_pages = pdf.sourcePages; }
    if (spreadsheet) extracted.source_rows = spreadsheet.rows;
    if (image || (pdf && !pdf.text.trim())) extracted.quality.is_scanned = true;
    const next = await updateDocument(id, { state: "NEEDS_REVIEW", extracted, worksheet: undefined, classified: undefined, validation: undefined });
    return Response.json({ document: next, agent: { name: "Document Reader", version: "reader-v1-local", mode: "deterministic-fallback" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Extraction failed";
    console.error("Document extraction failed", { documentId: id, error });
    const next = await updateDocument(id, { state: "FAILED", error: message }).catch(() => undefined);
    return Response.json({ error: message, document: next }, { status: 500 });
  }
}
