import { getDocument } from "../../../lib/document-store";
import { buildWorksheet } from "../../../lib/accounting-worksheet";
import { listJournalPostings } from "../../../lib/journal-postings";
import { AccountingWorkpaper } from "../../../components/accounting-workpaper";
import { SessionControls } from "../../../components/session-controls";
import { DocumentAnalysisChat } from "../../../components/document-analysis-chat";
export const dynamic = "force-dynamic";
export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  const doc = await getDocument(id);
  if (!doc?.extracted) return <main className="main"><h1>Document not ready</h1><p>Upload and read the document first.</p><a href="/dashboard">Back to dashboard</a></main>;
  const worksheet = doc.worksheet || buildWorksheet(doc.extracted);
  const rows = await listJournalPostings(id);
  const submissions = rows.map((r) => ({ id: r.id, status: r.status, externalReference: r.externalReference, lastError: r.lastError, journalId: (r.payload as { journalId?: string }).journalId }));
  return <><header className="workpaper-topbar"><a href="/dashboard">accentra·ai</a><SessionControls /></header><main className="workpaper-main"><AccountingWorkpaper documentId={id} filename={doc.filename} initialWorksheet={worksheet} initialSourceText={doc.extracted.source_text || ""} submissions={submissions} /><DocumentAnalysisChat documentId={id} /></main></>;
}
