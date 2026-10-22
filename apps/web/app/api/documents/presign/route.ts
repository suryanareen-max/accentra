import { randomUUID } from "node:crypto";
import { MAX_FILE_BYTES, SUPPORTED_MIMES, type SupportedMime } from "../../../../lib/contracts";
import { createDocument } from "../../../../lib/document-store";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { filename?: string; size?: number; contentType?: SupportedMime; contentHash?: string } | null;
    if (!body?.filename || !body.size || !body.contentType || !SUPPORTED_MIMES.includes(body.contentType)) return Response.json({ error: "Unsupported file. Use PDF, JPG, PNG, HEIC, XLSX, XLS, CSV, or DOCX." }, { status: 400 });
    if (body.size > MAX_FILE_BYTES) return Response.json({ error: "Files must be 50 MB or smaller." }, { status: 413 });
    const id = randomUUID();
    const record = await createDocument({ id, filename: body.filename, contentType: body.contentType, size: body.size, contentHash: body.contentHash ?? "pending" });
    return Response.json({ document: record, uploadUrl: `/api/documents/${id}/upload`, extractUrl: `/api/documents/${id}/extract` }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to prepare the upload." }, { status: 500 });
  }
}
