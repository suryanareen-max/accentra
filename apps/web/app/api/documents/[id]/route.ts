import { getDocument, setDocumentTrashed } from "../../../../lib/document-store";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const record = await getDocument((await params).id);
  return record ? Response.json({ document: record }) : Response.json({ error: "Document not found" }, { status: 404 });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return changeTrash((await params).id, true);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const body = await request.json().catch(() => null);
  if (body?.action !== "restore") return Response.json({ error: "Only the restore action is supported." }, { status: 400 });
  return changeTrash((await params).id, false);
}

async function changeTrash(id: string, trashed: boolean) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return Response.json({ error: "Invalid document ID." }, { status: 400 });
  try {
    const document = await setDocumentTrashed(id, trashed);
    return document ? Response.json({ document: { id: document.id, filename: document.filename, trashed: document.trashed } }, { headers: { "Cache-Control": "no-store" } }) : Response.json({ error: "Document not found." }, { status: 404 });
  } catch {
    return Response.json({ error: `Could not ${trashed ? "remove" : "restore"} this document. Please retry.` }, { status: 500 });
  }
}
