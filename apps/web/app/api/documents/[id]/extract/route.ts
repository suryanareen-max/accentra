import { extractCsv, extractText } from "../../../../../lib/reader";
import { getDocument, readDocumentFile, updateDocument } from "../../../../../lib/document-store";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const record = await getDocument(id);
  if (!record) return Response.json({ error: "Document not found" }, { status: 404 });
  await updateDocument(id, { state: "EXTRACTING" });
  try {
    const bytes = await readDocumentFile(id);
    const text = new TextDecoder().decode(bytes);
    const extracted = record.contentType === "text/csv" ? extractCsv(text) : extractText(record.contentType === "application/pdf" ? "" : text, record.filename);
    const next = await updateDocument(id, { state: "NEEDS_REVIEW", extracted });
    return Response.json({ document: next, agent: { name: "Document Reader", version: "reader-v1-local", mode: "deterministic-fallback" } });
  } catch (error) {
    const next = await updateDocument(id, { state: "FAILED", error: error instanceof Error ? error.message : "Extraction failed" });
    return Response.json({ document: next }, { status: 500 });
  }
}
