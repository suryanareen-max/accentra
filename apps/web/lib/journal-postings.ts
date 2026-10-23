import { createHash } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { getDb } from "./db";
import { documents, postings } from "./db/schema";
import type { JournalDraft } from "./contracts";
import { fetchCloudAccounts, sendCloudJournal, verifyCloudJournal } from "./autocount-cloud";
import { makeJournalPayload } from "./autocount-payload";

export async function listJournalPostings(documentId?: string) {
  const query = getDb().select().from(postings);
  return documentId ? query.where(eq(postings.documentId, documentId)).orderBy(desc(postings.createdAt)) : query.orderBy(desc(postings.createdAt));
}

export async function verifyJournalPosting(id: string) {
  const db = getDb();
  const [posting] = await db.select().from(postings).where(eq(postings.id, id)).limit(1);
  if (!posting) throw new Error("Posting record not found.");
  if (posting.status === "RECONCILED") return { posting, reconciled: true };
  if (posting.status !== "NEEDS_VERIFICATION" && posting.status !== "MISMATCH") throw new Error("Only an uncertain or mismatched posting can be verified here.");

  const savedPayload = posting.payload as { request?: ReturnType<typeof makeJournalPayload> };
  const request = savedPayload.request;
  const docNo = posting.externalReference || request?.master?.docNo;
  if (!request?.master || !Array.isArray(request.details) || !docNo) throw new Error("The saved AutoCount request has no document number to verify.");

  const result = await verifyCloudJournal(request, docNo);
  if (!result.reconciled) return { posting, reconciled: false };
  const [updated] = await db.update(postings).set({
    status: "RECONCILED",
    externalReference: result.docNo,
    lastError: null,
    payload: { ...savedPayload, response: result.response, locationUrl: result.location, verifiedAt: new Date().toISOString() },
    updatedAt: new Date(),
  }).where(eq(postings.id, id)).returning();
  return { posting: updated, reconciled: true };
}

export async function postJournal(documentId: string, j: JournalDraft) {
  const db = getDb();
  const accounts = await fetchCloudAccounts();
  const missing = j.lines.filter((l) => !accounts.some((a) => a.code === l.accountCode));
  if (missing.length) throw new Error(`Accounts not found as postable leaf accounts in your AutoCount book: ${missing.map((l) => l.accountCode).join(", ")}. Sync and correct the mapping first.`);
  if (j.currency !== "MYR" || j.lines.some((l) => accounts.find((a) => a.code === l.accountCode)?.currency !== "MYR")) throw new Error("Foreign-currency journals require account conversion-rate setup before direct posting. Export and review the currency treatment first.");
  const request = makeJournalPayload(j, documentId);
  const [document] = await db.select({ tenantId: documents.tenantId }).from(documents).where(eq(documents.id, documentId)).limit(1);
  if (!document) throw new Error("Document not found.");
  // Claim a deterministic primary key before the network write. It survives
  // serverless restarts and blocks concurrent or ambiguous duplicate retries.
  const hash = createHash("sha256").update(`${documentId}:${j.id}`).digest("hex");
  const id = `${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20,32)}`;
  const [claim] = await db.insert(postings).values({ id, tenantId: document.tenantId, documentId, status: "POSTING", payload: { journalId: j.id, reference: j.reference, request } }).onConflictDoNothing().returning();
  if (!claim) {
    const [existing] = await db.select().from(postings).where(eq(postings.id, id));
    return { ...existing, alreadySubmitted: true };
  }
  try {
    const result = await sendCloudJournal(j, documentId);
    const status = result.reconciled ? "RECONCILED" : result.verificationError ? "NEEDS_VERIFICATION" : "MISMATCH";
    const [saved] = await db.update(postings).set({ status, externalReference: result.docNo, lastError: result.verificationError || (result.reconciled ? null : "AutoCount returned a journal that did not match the saved workpaper."), payload: { journalId: j.id, reference: j.reference, request: result.payload, response: result.response, locationUrl: result.location }, updatedAt: new Date() }).where(eq(postings.id, id)).returning();
    return saved;
  } catch (error) {
    // A timeout may occur after AutoCount saved the record. Preserve the claim
    // and require a read-back check; never issue a blind second POST.
    const [saved] = await db.update(postings).set({ status: "NEEDS_VERIFICATION", lastError: error instanceof Error ? error.message : "Posting result unknown", updatedAt: new Date() }).where(eq(postings.id, id)).returning();
    return saved;
  }
}
