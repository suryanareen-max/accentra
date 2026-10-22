import { getDocument } from "../../../../../../lib/document-store";
import { worksheetCsv, worksheetIssues } from "../../../../../../lib/accounting-worksheet";
import { makeJournalPayload } from "../../../../../../lib/autocount-payload";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const doc = await getDocument((await params).id);
  if (!doc?.worksheet) return Response.json({ error: "Save the worksheet before exporting." }, { status: 409 });
  if (new URL(request.url).searchParams.get("format") === "json") {
    const issues = worksheetIssues(doc.worksheet);
    if (issues.length) return Response.json({ error: "Resolve the worksheet before creating a posting payload.", issues }, { status: 409 });
    return Response.json({ documentId: doc.id, endpoint: "/{accountBookId}/journalEntry", postingMode: "GL journals only; no stock movement, invoice document or payment allocation is created", journals: doc.worksheet.journals.filter((j) => j.included).map((j) => makeJournalPayload(j, doc.id)) }, { headers: { "content-disposition": `attachment; filename="journal-${doc.id}.json"` } });
  }
  return new Response("\ufeff" + worksheetCsv(doc.worksheet), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="journal-${doc.id}.csv"` } });
}
