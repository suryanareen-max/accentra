import { sql } from "drizzle-orm";
import { getDb } from "../../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return Response.json({ status: "not_configured", database: "neon" }, { status: 503 });
  }

  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ status: "ok", database: "neon" });
  } catch {
    return Response.json({ status: "unavailable", database: "neon" }, { status: 503 });
  }
}
