import { getDocument, updateDocument } from "../../../../../lib/document-store";
import { buildWorksheet, journalIssues, worksheetIssues } from "../../../../../lib/accounting-worksheet";
import type { AccountingWorksheet, JournalDraft, JournalLine } from "../../../../../lib/contracts";
import { auth } from "../../../../../lib/auth/server";
import { listJournalPostings } from "../../../../../lib/journal-postings";
import { getDb } from "../../../../../lib/db";
import { documents, reviews } from "../../../../../lib/db/schema";
import { eq, sql } from "drizzle-orm";

const text = (x: unknown, max = 4000) => typeof x === "string" ? x.slice(0, max) : "";
function sanitize(body: AccountingWorksheet, current: AccountingWorksheet): AccountingWorksheet {
  if (!Array.isArray(body.journals) || body.journals.length > 200) throw new Error("A worksheet must contain no more than 200 journals.");
  const ids = new Set<string>();
  const journals = body.journals.map((j): JournalDraft => {
    if (!j || typeof j.id !== "string" || ids.has(j.id) || !/^[a-zA-Z0-9-]{1,70}$/.test(j.id)) throw new Error("Invalid or repeated journal identifier.");
    ids.add(j.id);
    if (!Array.isArray(j.lines) || j.lines.length > 100) throw new Error("A journal must have no more than 100 lines.");
    const original = current.journals.find((x) => x.id === j.id);
    const lines = j.lines.map((l): JournalLine => ({ accountCode: text(l.accountCode, 50).trim(), accountName: text(l.accountName, 150).trim(), description: text(l.description, 1000), debit: Number(l.debit), credit: Number(l.credit), taxCode: text(l.taxCode, 30), department: text(l.department, 30) }));
    if (lines.some((l) => !Number.isFinite(l.debit) || !Number.isFinite(l.credit))) throw new Error("Debit and credit amounts must be finite numbers.");
    const next: JournalDraft = { ...j, id: j.id, reference: text(j.reference, 100), date: text(j.date, 10), rawDate: original?.rawDate || "", currency: text(j.currency, 3).toUpperCase(), currencyRate: Number(j.currencyRate), party: text(j.party, 150), description: text(j.description), kind: text(j.kind, 70), recommendedModule: original?.recommendedModule || "General ledger journal", amount: j.amount === null ? null : Number(j.amount), taxAmount: original?.taxAmount ?? null, taxTreatment: text(j.taxTreatment, 50), lines, treatment: text(j.treatment, 6000), standards: original?.standards || [], evidence: original?.evidence || { page: 1, excerpt: "Manually prepared from source evidence; confirm against original document." }, assumptions: original?.assumptions || [], included: j.included === true, confirmed: j.confirmed === true, source: original?.source || "manual", approvedAt: undefined };
    if (next.confirmed && journalIssues(next).length === 0 && body.businessEvidenceConfirmed === true) next.approvedAt = new Date().toISOString();
    else next.confirmed = false;
    return next;
  });
  return { ...current, businessEvidenceConfirmed: body.businessEvidenceConfirmed === true, financialYear: text(body.financialYear, 4), journals, updatedAt: new Date().toISOString() };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const doc = await getDocument((await params).id);
  if (!doc?.extracted) return Response.json({ error: "Extract the document first." }, { status: 404 });
  const worksheet = doc.worksheet || buildWorksheet(doc.extracted);
  return Response.json({ worksheet, issues: worksheetIssues(worksheet), postings: await listJournalPostings(doc.id) });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const doc = await getDocument((await params).id);
    if (!doc?.extracted) return Response.json({ error: "Extract the document first." }, { status: 404 });
    const current = doc.worksheet || buildWorksheet(doc.extracted);
    const body = await request.json() as AccountingWorksheet;
    if (doc.worksheet && body.updatedAt !== current.updatedAt) return Response.json({ error: "This worksheet changed in another tab. Reload before saving." }, { status: 409 });
    const existing = await listJournalPostings(doc.id);
    const worksheet = sanitize(body, current);
    for (const p of existing) {
      const journalId = (p.payload as { journalId?: string }).journalId;
      const original = current.journals.find((j) => j.id === journalId);
      const next = worksheet.journals.find((j) => j.id === journalId);
      if (!next || JSON.stringify([next.date, next.currency, next.currencyRate, next.amount, next.reference, next.description, next.lines]) !== JSON.stringify([original?.date, original?.currency, original?.currencyRate, original?.amount, original?.reference, original?.description, original?.lines])) return Response.json({ error: "Submitted journals are locked. Resolve the AutoCount posting or prepare a separate correcting entry." }, { status: 409 });
    }
    const findings = worksheetIssues(worksheet).map((message, index) => ({ rule_id: `J${index + 1}`, severity: "error" as const, message, field_paths: ["worksheet"], evidence: [], suggested_fix: null, blocking: true }));
    await updateDocument(doc.id, { worksheet, validation: { findings, blocking_count: findings.length, warning_count: 0, postable: !findings.length, checked_at: new Date().toISOString(), ruleset_version: "journal-workpaper-v1", confidence_floor: doc.extracted.quality.overall_confidence } });
    const session = await auth.getSession();
    const [row] = await getDb().select({ tenantId: documents.tenantId }).from(documents).where(eq(documents.id, doc.id));
    const edit = [{ before: current, after: worksheet, at: worksheet.updatedAt, reviewer: session.data?.user.email || "authenticated reviewer" }];
    await getDb().insert(reviews).values({ tenantId: row.tenantId, documentId: doc.id, status: worksheetIssues(worksheet).length ? "IN_REVIEW" : "APPROVED", reason: `Worksheet reviewed by ${session.data?.user.email || "authenticated reviewer"}`, edits: edit }).onConflictDoUpdate({ target: reviews.documentId, set: { status: worksheetIssues(worksheet).length ? "IN_REVIEW" : "APPROVED", edits: sql`${reviews.edits} || ${JSON.stringify(edit)}::jsonb`, reason: `Worksheet reviewed by ${session.data?.user.email || "authenticated reviewer"}`, updatedAt: new Date() } });
    return Response.json({ worksheet, issues: worksheetIssues(worksheet) });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Unable to save the worksheet." }, { status: 400 }); }
}
