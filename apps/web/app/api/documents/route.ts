import { listDocuments } from "../../../lib/document-store";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ documents: await listDocuments() });
}
