import { getDocument } from "../../../lib/document-store";
import { buildWorksheet } from "../../../lib/accounting-worksheet";
import { listJournalPostings } from "../../../lib/journal-postings";
import { AccountingWorkpaper } from "../../../components/accounting-workpaper";
import { SessionControls } from "../../../components/session-controls";
import { DocumentAnalysisChat } from "../../../components/document-analysis-chat";
import type { AccountingWorksheet } from "../../../lib/contracts";
export const dynamic = "force-dynamic";
export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  const doc = await getDocument(id);
  if (!doc) return <main className="main"><h1>Document not found</h1><a href="/dashboard">Back to dashboard</a></main>;
  const worksheet: AccountingWorksheet = doc.worksheet || (doc.extracted ? buildWorksheet(doc.extracted) : { version: 1, sourceKind: "unstructured", businessEvidenceConfirmed: false, financialYear: "", journals: [], notices: ["Read the original document to prepare source-linked transaction proposals. If an earlier upload did not save its file, upload it again."], generatedAt: doc.createdAt, updatedAt: doc.createdAt });
  const rows = await listJournalPostings(id);
  const submissions = rows.map((r) => ({ id: r.id, status: r.status, externalReference: r.externalReference, lastError: r.lastError, journalId: (r.payload as { journalId?: string }).journalId }));
  return <><header className="workpaper-topbar"><a href="/dashboard">accentra·ai</a><SessionControls /></header><main className="workpaper-main"><AccountingWorkpaper documentId={id} filename={doc.filename} initialWorksheet={worksheet} submissions={submissions} /><DocumentAnalysisChat documentId={id} /></main></>;
}
