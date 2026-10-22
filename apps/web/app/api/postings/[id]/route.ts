import { eq } from "drizzle-orm";
import { getDb } from "../../../../lib/db";
import { postings } from "../../../../lib/db/schema";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [posting] = await getDb().select().from(postings).where(eq(postings.id, (await params).id));
  return posting ? Response.json({ posting }) : Response.json({ error: "Posting not found" }, { status: 404 });
}
