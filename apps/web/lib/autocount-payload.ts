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
  const normalizeDate = (value: unknown) => {
    const text = String(value || "").trim();
    const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
    if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
    // AutoCount Cloud may serialize a date-only value using the server's
    // locale, for example "10/23/2026 00:00:00" (MM/DD/YYYY).
    const localized = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text);
    if (localized) return `${localized[3]}-${localized[1].padStart(2, "0")}-${localized[2].padStart(2, "0")}`;
    return "";
  };
  if (normalizeDate(actual.master?.docDate) !== normalizeDate(expected.master.docDate) || actual.master?.currencyCode !== expected.master.currencyCode) return false;
  const normalized = (lines: Array<{ accNo?: unknown; dr?: unknown; cr?: unknown }>) => lines.map((l) => `${l.accNo}|${Math.round(Number(l.dr || 0) * 100)}|${Math.round(Number(l.cr || 0) * 100)}`).sort();
  return JSON.stringify(normalized(expected.details)) === JSON.stringify(normalized(actual.details || []));
}
