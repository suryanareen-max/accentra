import type { JournalDraft } from "./contracts";
import { journalIssues } from "./accounting-worksheet";

export function makeJournalPayload(j: JournalDraft, documentId: string) {
  const errors = journalIssues(j);
  if (errors.length) throw new Error(errors.join(" "));
  return {
    master: {
      docNo: `ACC-${documentId.replaceAll("-", "").slice(0, 16)}-${j.id.replace(/[^A-Za-z0-9]/g, "").slice(0, 24)}`,
      docNo2: j.reference.slice(0, 25), docDate: j.date, currencyCode: j.currency,
      currencyRate: 1, journalType: "GENERAL", description: j.description.slice(0, 80),
    },
    details: j.lines.map((l) => ({ accNo: l.accountCode, toAccountRate: 1, ref: j.reference.slice(0, 20), description: (l.description || j.description).slice(0, 100), furtherDescription: l.description || j.description, dr: l.debit, cr: l.credit, taxCode: l.taxCode || null, deptNo: l.department || null, name: j.party.slice(0, 100), inclusiveTax: true })),
    autoFillOption: { taxCode: false, tariffCode: false }, saveApprove: false,
  };
}

export function matchesPostedJournal(expected: ReturnType<typeof makeJournalPayload>, actual: { master?: Record<string, unknown>; details?: Array<Record<string, unknown>> }) {
  if (String(actual.master?.docDate || "").slice(0, 10) !== expected.master.docDate || actual.master?.currencyCode !== expected.master.currencyCode) return false;
  const normalized = (lines: Array<{ accNo?: unknown; dr?: unknown; cr?: unknown }>) => lines.map((l) => `${l.accNo}|${Math.round(Number(l.dr || 0) * 100)}|${Math.round(Number(l.cr || 0) * 100)}`).sort();
  return JSON.stringify(normalized(expected.details)) === JSON.stringify(normalized(actual.details || []));
}
