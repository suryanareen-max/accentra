import { getDocument, listDocuments } from "../../../lib/document-store";
import { adapterStatus } from "../../../lib/autocount";
import { journalIssues, journalTotals } from "../../../lib/accounting-worksheet";
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { message?: string; mode?: "books" | "standards" | "document"; documentId?: string } | null; const message = body?.message?.trim(); if (!message) return Response.json({ error: "message is required" }, { status: 400 });
  if (body?.mode === "document") {
    const document = body.documentId ? await getDocument(body.documentId) : undefined;
    if (document?.worksheet) {
      const worksheet = document.worksheet;
      const named = worksheet.journals.filter((j) => j.reference && message.toLowerCase().includes(j.reference.toLowerCase()));
      const selected = named.length ? named : worksheet.journals.slice(0, 4);
      const detail = selected.map((j) => {
        const totals = journalTotals(j); const issues = journalIssues(j);
        return `${j.reference || "New journal"} · ${j.date || `Date incomplete (${j.rawDate || "not in source"})`} · ${j.currency || "Currency unconfirmed"} ${j.amount?.toFixed(2) || "amount unconfirmed"}\n${j.lines.map((l) => `${l.debit > 0 ? "Dr" : "Cr"} ${l.accountCode || "[map account]"} ${l.accountName}: ${(l.debit || l.credit).toFixed(2)}`).join("\n")}\nDebit total ${totals.debit.toFixed(2)}; credit total ${totals.credit.toFixed(2)}; difference ${totals.difference.toFixed(2)}.\nTreatment: ${j.treatment}\nEvidence: page ${j.evidence.page}. ${issues.length ? `Needs review: ${issues.join(" ")}` : "Arithmetic checks pass; confirm business evidence and account mapping before posting."}`;
      }).join("\n\n");
      return Response.json({ answer: `${worksheet.journals.length} separate journal proposal(s) were identified in ${document.filename}. ${worksheet.sourceKind === "training_material" ? "This is training material, so the examples are not evidence of actual company transactions. " : ""}${detail || "No reliable dated transaction rows were identified. Product setup information and price lists do not establish accounting transactions."}\n\n${!named.length && worksheet.journals.length > 4 ? "The first four journals are summarised here; ask using a specific document reference or use the transaction register for the complete workpaper. " : ""}These are source-linked, rule-based proposals. Resolve missing dates, taxes and actual AutoCount accounts in the worksheet; only saved, reviewed journals can be sent.`, mode: "document", documentId: document.id, standards: selected.flatMap((j) => j.standards) });
    }
    if (!document?.extracted || !document.classified) return Response.json({ error: "This document must finish extraction and classification first." }, { status: 400 });
    const findings = document.validation?.findings ?? [];
    const entryText = document.classified.entries.map((entry) => `${entry.dr ? "Dr" : "Cr"} ${entry.acc_no} ${entry.acc_name} RM ${(entry.dr || entry.cr).toFixed(2)}`).join("; ");
    return Response.json({ answer: `Analysis for ${document.filename}: classified as ${document.extracted.doc_family.replaceAll("_", " ")}. Proposed entries: ${entryText || "none"}. ${findings.length ? `${findings.length} validation finding(s) require review: ${findings.slice(0, 2).map((finding) => finding.message).join("; ")}.` : "No validation findings are currently recorded."} ${/ifrs|mfrs|standard|policy|accounting/i.test(message) ? "The IFRS/MFRS treatment is advisory and must be confirmed against the applicable reporting framework, entity policy, tax treatment, and source evidence before posting." : "Ask about the classification, evidence, missing fields, or proposed entries for this document."}`, mode: "document", documentId: document.id, entries: document.classified.entries, findings, standards: ["IFRS/MFRS review is advisory", "Human approval is required before AutoCount posting"] });
  }
  const docs = await listDocuments(); const posted = docs.filter((doc) => doc.validation?.postable).length;
  if (body?.mode === "standards") return Response.json({ answer: "MFRS and IFRS guidance is advisory here. Connect the standards corpus before relying on clause-level conclusions for a client decision.", citations: [{ standard: "MFRS/IFRS corpus", reference: "Pending corpus connection", source_url: "https://www.mia.org.my" }], mode: "standards" });
  return Response.json({ answer: `The local book mirror contains ${docs.length} documents, with ${posted} currently passing deterministic validation. AutoCount adapter status: ${adapterStatus().adapter}. I can only answer from records available in the mirror.`, citations: [{ standard: "Accentra book mirror", reference: "document and validation records", source_url: "/api/documents" }], mode: "books", trace: { documentCount: docs.length, validatedCount: posted } });
}
