import type { AccountingWorksheet, ExtractedDocument, JournalDraft, JournalLine } from "./contracts";

const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const numericAmount = (s: string) => Number(s.replace(/[,\s]/g, "").replace(/^(?:RM|MYR|USD|SGD)/i, "").replace(/^\((.*)\)$/, "-$1"));
const amounts = (s: string) => [...s.matchAll(/-?\b\d[\d,]*\.\d{2}\b/g)].map((m) => numericAmount(m[0]));
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const IFRS = "https://www.ifrs.org/issued-standards/list-of-standards/";

export function todayKualaLumpur(): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function journalDate(raw: string, year = todayKualaLumpur().slice(0, 4)): string {
  let y = "", m = "", d = "";
  const iso = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  const local = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4}|yyyy)$/i);
  const named = raw.match(/^(\d{1,2})[\s-]+([A-Za-z]+)(?:,?\s+(\d{2,4}))?$/);
  const monthFirst = raw.match(/^([A-Za-z]+)\s+(\d{1,2})(?:,?\s+(\d{2,4}))?$/);
  if (iso) [, y, m, d] = iso;
  else if (local) { [, d, m, y] = local; if (/yyyy/i.test(y)) y = year; else if (y.length === 2) y = `20${y}`; }
  else if (named) { d = named[1]; m = String(months.indexOf(named[2].slice(0, 3).toLowerCase()) + 1); y = named[3] || year; }
  else if (monthFirst) { m = String(months.indexOf(monthFirst[1].slice(0, 3).toLowerCase()) + 1); d = monthFirst[2]; y = monthFirst[3] || year; }
  if (y.length === 2) y = `20${y}`;
  if (!/^\d{4}$/.test(y) || +m < 1 || +m > 12 || +d < 1) return "";
  const result = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  const parsed = new Date(`${result}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === result ? result : "";
}

export function journalTotals(j: Pick<JournalDraft, "lines">) {
  const debit = round(j.lines.reduce((s, l) => s + l.debit, 0));
  const credit = round(j.lines.reduce((s, l) => s + l.credit, 0));
  return { debit, credit, difference: round(debit - credit) };
}

export function journalIssues(j: JournalDraft): string[] {
  const issues: string[] = [];
  const totals = journalTotals(j);
  if (!j.reference.trim()) issues.push("Enter a source document reference.");
  if (!j.date || journalDate(j.date) !== j.date) issues.push("Enter a valid transaction date.");
  if (j.currency !== "MYR") issues.push("Transaction currency must be MYR.");
  if (!j.description.trim()) issues.push("Add a journal narration.");
  if (j.amount === null || !Number.isFinite(j.amount) || j.amount <= 0) issues.push("Confirm a positive source transaction amount.");
  if (j.lines.length < 2) issues.push("At least two journal lines are required.");
  if (j.lines.some((l) => !l.accountCode.trim() || !l.accountName.trim() || /confirm|classify|determine|identify|establish/i.test(l.accountName))) issues.push("Map every line to a confirmed account code and account name.");
  if (j.lines.some((l) => !Number.isFinite(l.debit) || !Number.isFinite(l.credit) || l.debit < 0 || l.credit < 0 || (l.debit > 0 && l.credit > 0) || (l.debit === 0 && l.credit === 0))) issues.push("Each line needs one positive debit or credit, with no negative amounts.");
  if (totals.difference !== 0) issues.push(`Debits and credits differ by ${totals.difference.toFixed(2)}.`);
  if (totals.debit <= 0) issues.push("The journal total must be greater than zero.");
  if (j.amount !== null && Math.abs(totals.debit - j.amount) > 0.005) issues.push("Journal debits must equal the confirmed source amount.");
  if (!j.treatment.trim()) issues.push("Document the accounting treatment and recognition basis.");
  if (j.lines.some((l) => Math.abs(l.debit - round(l.debit)) > 0.0000001 || Math.abs(l.credit - round(l.credit)) > 0.0000001)) issues.push("Debit and credit amounts must be rounded to currency cents.");
  if (/void|cancelled/i.test(j.kind)) issues.push("Voided or cancelled examples cannot be posted as new transactions.");
  return issues;
}

export function worksheetIssues(w: AccountingWorksheet) {
  const included = w.journals.filter((j) => j.included);
  const issues: string[] = [];
  if (!included.length) issues.push("Select at least one transaction.");
  for (const j of included) {
    issues.push(...journalIssues(j).map((s) => `${j.reference || j.id}: ${s}`));
    if (!j.confirmed) issues.push(`${j.reference || j.id}: Review and confirm the evidence, accounts, date, amount and treatment.`);
  }
  const refs = included.map((j) => `${j.reference}|${j.date}`);
  if (new Set(refs).size !== refs.length) issues.push("Repeated document references and dates need duplicate review.");
  return issues;
}

export function treatmentFor(kind: string, text: string) {
  if (/capital|owner|shareholder/i.test(text)) return { text: "Owner contributions increase cash/bank and equity; they are not sales revenue. Confirm the legal nature of the contribution (capital versus shareholder loan).", standards: [{ label: "Conceptual Framework: equity and income", url: "https://www.ifrs.org/issued-standards/list-of-standards/conceptual-framework/" }] };
  if (/fixed asset|furn|computer|equipment|ICT/i.test(text)) return { text: "Assess tangible items used over more than one period for capitalisation at cost. Confirm recognition criteria, entity capitalisation policy, useful life and subsequent depreciation; a payment does not by itself prove an expense.", standards: [{ label: "IAS 16 / MFRS 116: property, plant and equipment", url: `${IFRS}ias-16-property-plant-and-equipment/` }] };
  if (/sales|revenue|cash_sale|credit_note/i.test(kind + text)) return { text: "Recognise revenue when the relevant performance obligation is satisfied. Debit the customer receivable for credit sales or cash/bank for cash sales; credit revenue. A customer receipt settles receivables, and must not recognise the same revenue twice. Returns and discounts reverse or adjust the related revenue.", standards: [{ label: "IFRS 15 / MFRS 15: revenue", url: `${IFRS}ifrs-15-revenue-from-contracts-with-customers/` }] };
  if (/purchase|inventor|stock/i.test(kind + text)) return { text: "Distinguish inventory for resale from operating expenses. Assess inventory cost and the entity's periodic/perpetual policy; recognise the cost of inventory sold in the appropriate period. Non-recoverable purchase taxes form part of cost. Confirm any stock-module movement separately.", standards: [{ label: "IAS 2 / MFRS 102: inventories", url: `${IFRS}ias-2-inventories/` }] };
  if (/advance|prepay|deposit/i.test(text)) return { text: "Assess whether the payment creates a prepayment, deposit or other asset before recognising an expense. Confirm the service period and release the balance as the benefit is received. Do not expense an advance solely because cash was paid.", standards: [{ label: "Conceptual Framework: assets and expenses", url: "https://www.ifrs.org/issued-standards/list-of-standards/conceptual-framework/" }] };
  if (/salar(?:y|ies)|wage|payroll/i.test(text)) return { text: "Recognise short-term employee benefit expense as employees render services, with a payable until settled. Confirm the payroll period and statutory deductions separately.", standards: [{ label: "IAS 19 / MFRS 119: employee benefits", url: `${IFRS}ias-19-employee-benefits/` }] };
  if (/receipt|payment_in/i.test(kind)) return { text: "Establish the source of the receipt. Collection of an existing customer balance debits cash/bank and credits the receivable, without recognising revenue again. A customer deposit may be a liability; an owner's contribution may be equity or a loan. Confirm allocation to the original document.", standards: [{ label: "IFRS 9 / MFRS 9: financial assets and receivables", url: `${IFRS}ifrs-9-financial-instruments/` }] };
  return { text: "Identify the economic substance and relevant period. An expense payment normally debits the expense (or an existing payable) and credits cash/bank; a cash transfer debits the receiving account and credits the paying account. Confirm whether an asset, prepayment, payable or receivable is involved.", standards: [{ label: "Conceptual Framework: recognition and measurement", url: "https://www.ifrs.org/issued-standards/list-of-standards/conceptual-framework/" }] };
}

function line(code: string, name: string, amount: number, debit: boolean, description: string): JournalLine {
  return { accountCode: code, accountName: name, description, debit: debit ? amount : 0, credit: debit ? 0 : amount, taxCode: "", department: "" };
}

export function blankJournal(id = "manual-1"): JournalDraft {
  return { id, reference: "", date: todayKualaLumpur(), rawDate: "", currency: "MYR", currencyRate: 1, party: "", description: "", kind: "JOURNAL", recommendedModule: "General ledger journal", amount: null, taxAmount: null, taxTreatment: "unreviewed", lines: [line("", "", 0, true, ""), line("", "", 0, false, "")], treatment: "", standards: [], evidence: { page: 1, excerpt: "" }, assumptions: [], included: true, confirmed: false, source: "manual" };
}

function cashAccount(text: string) {
  if (/CIMB|MB-ONLINE|MBB|PBB/.test(text)) return { code: /CIMB/.test(text) ? "310-CIMB" : /PBB/.test(text) ? "310-PBB1" : "310-MBB1", name: /CIMB/.test(text) ? "CIMB-KL" : /PBB/.test(text) ? "PBB-PJ" : "MBB-KL" };
  return { code: "", name: /\bCASH\b/.test(text) ? "Cash in hand" : "Cash / bank - confirm payment account" };
}

function sourceAccountDetails(body: string) {
  const matches = [...body.matchAll(/\b(\d{3}-[A-Z0-9]{3,8})\b/g)];
  return matches.flatMap((m, i) => {
    const section = body.slice(m.index! + m[0].length, matches[i + 1]?.index ?? body.length);
    const values = amounts(section);
    if (!values.length) return [];
    const firstAmount = section.search(/\b\d[\d,]*\.\d{2}\b/);
    return [{ code: m[0], name: clean(section.slice(0, firstAmount)).replace(/Ref:\s*\d+/gi, "").slice(0, 130) || m[0], amount: values.at(-1)! }];
  });
}

function tableJournals(doc: ExtractedDocument): JournalDraft[] {
  const pages = doc.source_pages?.length ? doc.source_pages : [{ page: 1, text: doc.source_text || "" }];
  const result: JournalDraft[] = [];
  const datePattern = "\\d{1,2}[/-]\\d{1,2}[/-](?:\\d{2,4}|yyyy)|\\d{1,2}\\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:[a-z]*)(?:,?\\s+\\d{2,4})?|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:[a-z]*)\\s+\\d{1,2},?\\s+\\d{2,4}|\\d{4}-\\d{2}-\\d{2}";
  for (const page of pages) {
    const rows = [...page.text.matchAll(new RegExp(`\\b((?:PI|PV|OR|JV|CN|PR|I)-\\d{4,})(?:\\s+(?:I|PI)-\\d{4,})?\\s+(${datePattern})\\b`, "gi"))];
    for (let i = 0; i < rows.length; i++) {
      const m = rows[i], reference = m[1];
      const end = rows[i + 1]?.index ?? page.text.length;
      let body = page.text.slice(m.index!, end).split(/<<New>>|Task\s+\d||-- \d+ of/)[0];
      const sourceAccounts = sourceAccountDetails(body);
      const values = amounts(body);
      if (!values.length) continue;
      const prefixRegion = page.text.slice(Math.max(rows[i - 1]?.index ?? 0, m.index! - 180), m.index!);
      const previousValue = [...prefixRegion.matchAll(/-?\b\d[\d,]*\.\d{2}\b/g)].at(-1);
      const before = prefixRegion.slice(previousValue ? previousValue.index! + previousValue[0].length : 0).replaceAll("<<New>>", "");
      const partyCode = [...before.matchAll(/\b([34]00-[A-Z]\d+)\b/g)].at(-1)?.[1] || "";
      const j = blankJournal(`source-${page.page}-${result.length + 1}`);
      j.source = "extracted"; j.reference = reference; j.rawDate = clean(m[2]); j.date = journalDate(j.rawDate) || todayKualaLumpur();
      j.currency = "MYR";
      j.evidence = { page: page.page, excerpt: clean(before + " " + body).slice(0, 1800) };
      j.party = partyCode; j.description = `${reference} - ${sourceAccounts.map((a) => a.name).join("; ") || "transaction from source"}`;
      const prefix = reference.split("-")[0].toUpperCase();
      j.kind = ({ I: "SALES_INVOICE", PI: "PURCHASE_INVOICE", OR: "RECEIPT", PV: "PAYMENT_OUT", JV: "JOURNAL", CN: "SALES_CREDIT_NOTE", PR: "PURCHASE_RETURN" } as Record<string, string>)[prefix];
      j.recommendedModule = ({ I: "Sales invoice", PI: "Purchase invoice", OR: "Cash book receipt / customer allocation", PV: "Cash book payment / supplier allocation", CN: "Sales credit note / invoice allocation", PR: "Purchase return / supplier allocation", JV: "General ledger journal" } as Record<string, string>)[prefix];
      const total = values.at(-1)!;
      const bank = cashAccount(body);
      if (bank.code && !(doc.source_text || "").includes(bank.code)) bank.code = "";
      if (prefix === "JV" && sourceAccounts.length >= 2) {
        // The text stream loses the horizontal debit/credit columns. Propose a
        // balanced partition, and require the accountant to confirm the sides.
        const cents = sourceAccounts.map((a) => Math.round(a.amount * 100));
        const half = cents.reduce((a, b) => a + b, 0) / 2;
        let debitIndices: number[] | undefined;
        const search = (idx: number, sum: number, indices: number[]): void => {
          if (debitIndices || sum > half || idx > 18) return;
          if (sum === half) { debitIndices = indices; return; }
          if (idx >= cents.length) return;
          search(idx + 1, sum + cents[idx], [...indices, idx]); search(idx + 1, sum, indices);
        };
        search(1, cents[0], [0]);
        j.lines = sourceAccounts.map((a, idx) => line(a.code, a.name, a.amount, debitIndices?.includes(idx) ?? idx === 0, j.description));
        j.amount = round(half / 100); j.assumptions.push("Debit/credit sides are provisional because PDF text extraction loses table columns. Compare every side with the original journal table.");
      } else if (["PV", "OR"].includes(prefix) && sourceAccounts.length) {
        const details = sourceAccounts.filter((a) => !/^310-/.test(a.code));
        j.lines = details.map((a) => line(a.code, a.name, a.amount, prefix === "PV", j.description));
        j.amount = round(details.reduce((s, a) => s + a.amount, 0));
        j.lines.push(line(bank.code, bank.name, j.amount, prefix === "OR", j.description));
      } else if (["I", "PI", "CN", "PR"].includes(prefix)) {
        const a = sourceAccounts[0];
        const mainDebit = ["PI", "CN"].includes(prefix);
        j.amount = total;
        j.lines = [line(a?.code || "", a?.name || (mainDebit ? "Purchases / sales return" : "Sales / purchase return"), total, mainDebit, j.description), line(partyCode, /^(I|CN)$/.test(prefix) ? "Customer receivable" : "Supplier payable", total, !mainDebit, j.description)];
      } else {
        j.amount = total;
        j.lines = [line(bank.code, bank.name, total, prefix === "OR", j.description), line(partyCode, prefix === "OR" ? "Customer receivable - confirm" : "Supplier payable - confirm", total, prefix !== "OR", j.description)];
      }
      if (/void[^\n]{0,80}/i.test(page.text.slice(m.index! + m[0].length, end)) || (new RegExp(`voucher\\s+${reference}\\s+was.*?void`, "is")).test(page.text)) { j.kind = "VOIDED_EXAMPLE"; j.included = false; }
      if (!j.rawDate) j.assumptions.push("No source date was identified. The transaction date defaults to today and should be checked before posting.");
      const treatment = treatmentFor(j.kind, j.description + " " + j.evidence.excerpt);
      j.treatment = treatment.text; j.standards = treatment.standards;
      result.push(j);
    }
  }
  return result;
}

function structuredJournals(doc: ExtractedDocument): JournalDraft[] {
  const result: JournalDraft[] = [];
  const groups = new Map<string, JournalDraft>();
  for (const [index, source] of (doc.source_rows || []).entries()) {
    const row = Object.fromEntries(Object.entries(source).map(([k, v]) => [k.toLowerCase().replace(/[^a-z]/g, ""), String(v).trim()]));
    const date = row.date || row.docdate || row.transactiondate || "";
    const ref = row.reference || row.docno || row.invoiceno || row.documentno || `ROW-${index + 1}`;
    const description = row.description || row.narration || row.details || "Imported transaction";
    const code = row.accountcode || row.accno || row.account || "";
    const debitRaw = row.debit || row.dr || "", creditRaw = row.credit || row.cr || "";
    const value = row.amount || row.total || row.netamount || "";
    if (!debitRaw && !creditRaw && !value) continue;
    let j = groups.get(`${ref}|${date}`);
    if (!j) {
      j = blankJournal(`row-${index + 1}`); j.source = "extracted"; j.reference = ref; j.rawDate = date; j.date = journalDate(date) || todayKualaLumpur();
      j.description = description; j.currency = "MYR"; j.party = row.supplier || row.customer || row.payee || "";
      j.evidence = { page: 1, excerpt: JSON.stringify(source) }; j.lines = []; groups.set(`${ref}|${date}`, j); result.push(j);
    }
    if (debitRaw || creditRaw) {
      j.lines.push({ ...line(code, row.accountname || description, 0, true, description), debit: numericAmount(debitRaw || "0"), credit: numericAmount(creditRaw || "0"), taxCode: row.taxcode || "", department: row.department || "" });
    } else {
      const amount = numericAmount(value);
      j.amount = Math.abs(amount); j.kind = row.type || "BANK_TRANSACTION";
      j.lines = [line(code, row.accountname || "Bank account - confirm", Math.abs(amount), amount > 0, description), line(row.contraaccount || "", row.contraaccountname || "Counter account - identify transaction nature", Math.abs(amount), amount <= 0, description)];
      j.assumptions.push("Confirm the bank statement sign convention and counter account. A receipt may settle a receivable rather than create revenue.");
    }
  }
  for (const j of result) {
    if (j.amount === null) j.amount = journalTotals(j).debit;
    const treatment = treatmentFor(j.kind, j.description); j.treatment = treatment.text; j.standards = treatment.standards;
  }
  return result;
}

function singleJournal(doc: ExtractedDocument): JournalDraft[] {
  if (doc.doc_family === "UNKNOWN" || doc.doc_family === "BANK_STATEMENT") return [];
  const j = blankJournal("document-1");
  j.source = "extracted"; j.reference = doc.document.number.value || ""; j.rawDate = doc.document.date.value || ""; j.date = journalDate(j.rawDate) || todayKualaLumpur();
  j.currency = "MYR"; j.amount = doc.totals.total.value; j.taxAmount = doc.totals.tax.value;
  j.kind = doc.doc_family; j.party = doc.supplier.name.value || doc.customer.name.value || "";
  j.description = `${j.kind.replaceAll("_", " ")} ${j.reference} ${j.party}`.trim();
  j.evidence = { page: doc.totals.total.page, excerpt: (doc.source_text || "").slice(0, 3000) };
  const text = doc.source_text || "";
  const asset = /computer|equipment|furniture|fixed asset/i.test(text);
  const name = asset ? "Property, plant and equipment - confirm recognition" : /electricity|water|utilities/i.test(text) ? "Utilities" : /stationery|paper|office supplies/i.test(text) ? "Office supplies" : /professional|legal|audit fee/i.test(text) ? "Professional fees" : "Expense / inventory / asset - classify from evidence";
  const amount = j.amount ?? 0;
  if (j.kind === "SALES_INVOICE") j.lines = [line("", "Customer receivable", amount, true, j.description), line("", "Sales revenue", amount, false, j.description)];
  else if (j.kind === "PAYMENT_VOUCHER") j.lines = [line("", name, amount, true, j.description), line("", "Cash / bank", amount, false, j.description)];
  else if (j.kind === "RECEIPT") {
    j.lines = [line("", "Cash / bank", amount, true, j.description), line("", "Receivable / revenue / liability - establish receipt purpose", amount, false, j.description)];
    j.assumptions.push("A receipt does not establish whether this is a sale, customer collection, capital contribution or deposit. Confirm the purpose.");
  } else j.lines = [line("", name, amount, true, j.description), line("", "Supplier payable", amount, false, j.description)];
  j.recommendedModule = j.kind === "SALES_INVOICE" ? "Sales invoice" : j.kind === "PURCHASE_INVOICE" ? "Purchase invoice" : "Cash book receipt / payment";
  if (!j.rawDate) j.assumptions.push("No source date was identified. The transaction date defaults to today and should be checked before posting.");
  const treatment = treatmentFor(j.kind, text); j.treatment = treatment.text; j.standards = treatment.standards;
  return [j];
}

function stockAdjustmentJournals(doc: ExtractedDocument): JournalDraft[] {
  const result: JournalDraft[] = [];
  const pages = doc.source_pages?.length ? doc.source_pages : [{ page: 1, text: doc.source_text || "" }];
  for (const page of pages) {
    const section = page.text.match(/(?:Task\s+[\d.]+\s+)?Stock Adjustment\s*\n([\s\S]*?)(?=Task\s+[\d.]+|$)/i)?.[1];
    if (!section || !/quantity[\s\S]*unit cost/i.test(section)) continue;
    const rawDate = section.match(/Date\s*:\s*(\d{1,2}\/\d{1,2}\/(?:\d{4}|yyyy))/i)?.[1] || "";
    const rows = [...section.matchAll(/^\s*([A-Z0-9]{2,20})\s+(.+?)\s+(-?\d+(?:\.\d+)?)\s+([\d,]+\.\d{2})\s*$/gm)];
    for (const row of rows) {
      const quantity = Number(row[3]), unitCost = numericAmount(row[4]), amount = round(Math.abs(quantity * unitCost));
      if (!quantity || !Number.isFinite(amount) || amount <= 0) continue;
      const j = blankJournal(`stock-${page.page}-${result.length + 1}`);
      j.source = "extracted"; j.reference = `STOCK-${row[1]}`; j.rawDate = rawDate; j.date = journalDate(rawDate) || todayKualaLumpur(); j.currency = "MYR";
      j.kind = "STOCK_ADJUSTMENT"; j.recommendedModule = "Stock adjustment - confirm inventory system";
      j.description = `Stock adjustment ${row[1]} ${row[2]}: ${quantity} × ${unitCost.toFixed(2)}`; j.amount = amount;
      j.lines = [line("", "Inventory - confirm stock valuation account", amount, quantity > 0, j.description), line("", "Inventory adjustment / variance - determine cause", amount, quantity < 0, j.description)];
      j.evidence = { page: page.page, excerpt: `${section.slice(0, 500)}\nSource row: ${row[0]}\nCalculated value: ${quantity} × ${unitCost.toFixed(2)} = ${(quantity * unitCost).toFixed(2)}` };
      j.assumptions = ["This is a proposed value effect of an explicit quantity adjustment, not a product selling price. Confirm quantity, valuation basis and cause of the variance.", "Confirm the periodic/perpetual inventory policy. A stock-module adjustment may already generate the GL effect; do not post the same movement twice."];
      if (!j.rawDate) j.assumptions.push("No source date was identified. The transaction date defaults to today and should be checked before posting.");
      const treatment = treatmentFor(j.kind, "inventory stock adjustment"); j.treatment = treatment.text; j.standards = treatment.standards;
      result.push(j);
    }
  }
  return result;
}

export function buildWorksheet(doc: ExtractedDocument): AccountingWorksheet {
  const training = /course book|learning objectives|task\s+\d+\.\d+|chapter\s+\d+/i.test(doc.source_text || "");
  const table = tableJournals(doc);
  const rows = table.length ? table : [...structuredJournals(doc), ...stockAdjustmentJournals(doc)];
  const journals = rows.length ? rows : training ? [] : singleJournal(doc);
  const notices = ["All proposed transactions use MYR. Source amounts are carried into MYR without exchange conversion. Missing or incomplete source dates default to today's date in Malaysia time; edit the transaction date if needed.", "Account codes must be matched to your company's actual AutoCount chart; suggested names are not synced accounts.", "Before sending a GL journal, complete every asterisked field, confirm the source represents a real company transaction, balance the debit and credit entries, and review the proposal."];
  if (training) notices.unshift("Training/course material detected. Examples are shown for analysis, not as evidence of actual company transactions.");
  if (!journals.length) notices.push("No reliable transaction rows were identified. Read the source text below, supply a clearer transaction document, or enter a journal manually. Product prices and setup instructions are not transaction totals.");
  if (!journals.length && doc.quality.is_scanned) notices.push("The document may be an image or scanned pages. Image OCR is not configured: compare the original file and transcribe verified transactions, or provide a machine-readable source.");
  return { version: 1, sourceKind: training ? "training_material" : journals.length ? "business_document" : "unstructured", businessEvidenceConfirmed: false, financialYear: "", journals, notices, generatedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

export function worksheetCsv(w: AccountingWorksheet): string {
  const cell = (x: unknown) => { const value = typeof x === "string" && /^[=+@-]/.test(x) ? `'${x}` : String(x ?? ""); return `"${value.replaceAll('"', '""')}"`; };
  const header = ["Reference", "Transaction date", "Currency", "Party", "Narration", "Account code", "Account name", "Debit", "Credit", "Department", "Source page", "Treatment", "Reviewed"];
  const rows = w.journals.filter((j) => j.included).flatMap((j) => j.lines.map((l) => [j.reference, j.date, "MYR", j.party, l.description || j.description, l.accountCode, l.accountName, l.debit.toFixed(2), l.credit.toFixed(2), l.department, j.evidence.page, j.treatment, j.confirmed ? "Yes" : "No"]));
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}
