import { getDocument, readDocumentFile } from "../../../../../lib/document-store";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const doc = await getDocument((await params).id);
    if (!doc) return Response.json({ error: "Document not found." }, { status: 404 });
    const bytes = await readDocumentFile(doc.id);
    const disposition = doc.contentType === "application/pdf" || doc.contentType.startsWith("image/") ? "inline" : "attachment";
    return new Response(new Uint8Array(bytes), { headers: { "content-type": doc.contentType, "content-disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(doc.filename)}`, "cache-control": "private, no-store", "x-frame-options": "SAMEORIGIN", "content-security-policy": "frame-ancestors 'self'" } });
  } catch { return Response.json({ error: "The original file is unavailable. Re-upload the source document." }, { status: 404 }); }
}
