import { getDocument, updateDocument, listDocuments } from "../../../../../lib/document-store";
import { demoAccounts } from "../../../../../lib/chart-of-accounts";
import { classifyDocument } from "../../../../../lib/classifier";
import { validateDocument } from "../../../../../lib/validator";
import { buildWorksheet, worksheetIssues } from "../../../../../lib/accounting-worksheet";
import { listJournalPostings } from "../../../../../lib/journal-postings";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const record = await getDocument((await params).id); if (!record?.extracted) return Response.json({ error: "Extract the document first" }, { status: 400 });
  if ((await listJournalPostings(record.id)).length) return Response.json({ error: "Submitted journals are locked. Classification cannot replace them." }, { status: 409 });
  const classified = classifyDocument(record.extracted, demoAccounts);
  const worksheet = buildWorksheet(record.extracted);
  const duplicate = (await listDocuments()).some((candidate) => candidate.id !== record.id && candidate.contentHash === record.contentHash && record.contentHash !== "pending");
  if (duplicate) worksheet.notices.push("The same file has been uploaded before. Check for duplicate transactions before approving anything.");
  const validation = validateDocument(record.extracted, classified, { duplicate });
  validation.findings = worksheetIssues(worksheet).map((message, index) => ({ rule_id: `J${index + 1}`, severity: "error", message, field_paths: ["worksheet"], evidence: [], suggested_fix: null, blocking: true }));
  validation.blocking_count = validation.findings.length; validation.postable = validation.blocking_count === 0;
  const next = await updateDocument(record.id, { classified, worksheet, validation, state: "NEEDS_REVIEW" });
  return Response.json({ document: next, classifier: "classifier-v1-local", validator: validation.ruleset_version });
}
