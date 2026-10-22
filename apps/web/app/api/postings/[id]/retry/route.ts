import { eq } from "drizzle-orm";
import { getDb } from "../../../../../lib/db";
import { postings } from "../../../../../lib/db/schema";
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [posting] = await getDb().select().from(postings).where(eq(postings.id, (await params).id));
  return Response.json(posting ? { posting, error: "Verify this reference in AutoCount first. An ambiguous submission cannot be blindly retried." } : { error: "Posting not found" }, { status: posting ? 409 : 404 });
}
