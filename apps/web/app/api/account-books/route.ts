import { listAccountBooks } from "../../../lib/document-store";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ accountBooks: await listAccountBooks() });
}
