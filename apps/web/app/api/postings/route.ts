import { getDocument } from "../../../lib/document-store";
import { worksheetIssues } from "../../../lib/accounting-worksheet";
import { cloudStatus } from "../../../lib/autocount-cloud";
import { listJournalPostings, postJournal } from "../../../lib/journal-postings";
export const maxDuration = 60;
export async function GET() {
  const rows = await listJournalPostings();
  return Response.json({ postings: rows.map((r) => ({ ...r, state: r.status, autocountDocNo: r.externalReference, endpoint: "journalEntry" })) });
}
export async function POST(request: Request) {
  try {
    const body = await request.json() as { documentId?: string; journalId?: string };
    const doc = body.documentId ? await getDocument(body.documentId) : undefined;
    if (!doc?.worksheet) return Response.json({ error: "Prepare and save an accountant worksheet first." }, { status: 409 });
    const selected = doc.worksheet.journals.filter((j) => j.included && (!body.journalId || j.id === body.journalId));
    const issues = worksheetIssues({ ...doc.worksheet, journals: selected });
    if (issues.length || selected.some((j) => !j.approvedAt)) return Response.json({ error: "Review and save the selected journals before posting.", issues }, { status: 409 });
    const status = cloudStatus();
    if (!status.configured) return Response.json({ error: `AutoCount is not connected. Configure ${status.missing.join(", ")} in Vercel.`, missing: status.missing }, { status: 503 });
    if (selected.length !== 1) return Response.json({ error: "Send one reviewed journal at a time so each result can be verified." }, { status: 400 });
    const results = await listJournalPostings();
    const duplicate = results.find((p) => (p.documentId !== doc.id || (p.payload as { journalId?: string }).journalId !== selected[0].id) && (p.payload as { reference?: string; request?: { master?: { docDate?: string } } }).reference === selected[0].reference && (p.payload as { request?: { master?: { docDate?: string } } }).request?.master?.docDate === selected[0].date);
    if (duplicate) return Response.json({ error: "A journal with this source reference and date has already been submitted from another upload. Check the posting log before proceeding." }, { status: 409 });
    const posting = await postJournal(doc.id, selected[0]);
    return Response.json({ posting, message: posting.status === "RECONCILED" ? "AutoCount saved the journal and its debits/credits were verified by reading it back." : "Check the posting result before retrying. No blind duplicate POST will be made." }, { status: posting.status === "RECONCILED" ? 200 : 409 });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Unable to send the journal." }, { status: 502 }); }
}
