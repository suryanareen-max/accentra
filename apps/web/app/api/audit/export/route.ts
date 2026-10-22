import { desc } from "drizzle-orm";
import { getDb } from "../../../../lib/db";
import { reviews, postings } from "../../../../lib/db/schema";
export async function GET() {
  const [reviewRows, postingRows] = await Promise.all([getDb().select().from(reviews).orderBy(desc(reviews.updatedAt)), getDb().select().from(postings).orderBy(desc(postings.createdAt))]);
  const rows: unknown[][] = [["id","action","document_id","reference","reviewer_or_error","timestamp"]];
  for (const r of reviewRows) {
    const edits = r.edits as Array<{ at?: string; reviewer?: string }>;
    for (const e of edits) rows.push([r.id,`worksheet.${r.status.toLowerCase()}`,r.documentId,"",e.reviewer || r.reason,e.at || r.updatedAt.toISOString()]);
  }
  for (const p of postingRows) rows.push([p.id,`autocount.${p.status.toLowerCase()}`,p.documentId,p.externalReference,p.lastError,p.updatedAt.toISOString()]);
  const csv = rows.map((r)=>r.map((v)=>'"'+String(v??"").replaceAll('"','""')+'"').join(",")).join("\r\n");
  return new Response(csv,{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":"attachment; filename=accentra-audit.csv"}});
}
