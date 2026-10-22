import { getDocument, listDocuments } from "../../../lib/document-store";
import { adapterStatus } from "../../../lib/autocount";
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { message?: string; mode?: "books" | "standards" | "document"; documentId?: string } | null; const message = body?.message?.trim(); if (!message) return Response.json({ error: "message is required" }, { status: 400 });
  if (body?.mode === "document") {
    const document = body.documentId ? await getDocument(body.documentId) : undefined;
    if (!document?.extracted || !document.classified) return Response.json({ error: "This document must finish extraction and classification first." }, { status: 400 });
    const findings = document.validation?.findings ?? [];
    const entryText = document.classified.entries.map((entry) => `${entry.dr ? "Dr" : "Cr"} ${entry.acc_no} ${entry.acc_name} RM ${(entry.dr || entry.cr).toFixed(2)}`).join("; ");
    return Response.json({ answer: `Analysis for ${document.filename}: classified as ${document.extracted.doc_family.replaceAll("_", " ")}. Proposed entries: ${entryText || "none"}. ${findings.length ? `${findings.length} validation finding(s) require review: ${findings.slice(0, 2).map((finding) => finding.message).join("; ")}.` : "No validation findings are currently recorded."} ${/ifrs|mfrs|standard|policy|accounting/i.test(message) ? "The IFRS/MFRS treatment is advisory and must be confirmed against the applicable reporting framework, entity policy, tax treatment, and source evidence before posting." : "Ask about the classification, evidence, missing fields, or proposed entries for this document."}`, mode: "document", documentId: document.id, entries: document.classified.entries, findings, standards: ["IFRS/MFRS review is advisory", "Human approval is required before AutoCount posting"] });
  }
  const docs = await listDocuments(); const posted = docs.filter((doc) => doc.validation?.postable).length;
  if (body?.mode === "standards") return Response.json({ answer: "MFRS and IFRS guidance is advisory here. Connect the standards corpus before relying on clause-level conclusions for a client decision.", citations: [{ standard: "MFRS/IFRS corpus", reference: "Pending corpus connection", source_url: "https://www.mia.org.my" }], mode: "standards" });
  return Response.json({ answer: `The local book mirror contains ${docs.length} documents, with ${posted} currently passing deterministic validation. AutoCount adapter status: ${adapterStatus().adapter}. I can only answer from records available in the mirror.`, citations: [{ standard: "Accentra book mirror", reference: "document and validation records", source_url: "/api/documents" }], mode: "books", trace: { documentCount: docs.length, validatedCount: posted } });
}
