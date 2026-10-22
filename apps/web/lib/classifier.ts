import type { Account, ClassifiedTransaction, ExtractedDocument } from "./contracts";
import { buildWorksheet } from "./accounting-worksheet";
export type MappingMemory = { vendorKey: string; docFamily: string; accNo: string; hits: number; confidence: number };
export function classifyDocument(doc: ExtractedDocument, accounts: Account[], _memories: MappingMemory[] = []): ClassifiedTransaction {
  const journal = buildWorksheet(doc).journals[0];
  return {
    transaction_type: journal ? "JOURNAL" : "UNSUPPORTED",
    autocount_target: { method: "journalEntry", document_type: "JE" },
    entries: (journal?.lines || []).map((l, i) => ({ line_no: i + 1, acc_no: l.accountCode, acc_name: accounts.find((a) => a.accNo === l.accountCode)?.accName || l.accountName, dr: l.debit, cr: l.credit, description: l.description, tax_code: l.taxCode || null, department: l.department || null })),
    party: { type: "NONE", code: null, name: journal?.party || "", is_new: false },
    period: { doc_date: journal?.date || null, currency: journal?.currency || "", currency_rate: journal?.currencyRate || 1 },
    rationale: journal?.treatment || "No reliable transaction was identified. Review source evidence before preparing entries.",
    evidence: journal ? [{ claim: journal.description, field: "source_text", page: journal.evidence.page }] : [],
    confidence: 0.5, alternatives: [],
  };
}
