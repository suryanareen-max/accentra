import assert from "node:assert/strict";
import { test } from "node:test";
import { buildWorksheet, journalDate, journalIssues, journalTotals, worksheetCsv, worksheetIssues } from "../lib/accounting-worksheet";
import { extractCsv, extractText } from "../lib/reader";
import { makeJournalPayload, matchesPostedJournal } from "../lib/autocount-payload";
import { classifyDocument } from "../lib/classifier";

function invoice() { return extractText("Purchase Invoice No: PI-900001\nSupplier: Example Supply\nDate: 2026-01-15\nMYR\nOffice stationery\nSubtotal: 100.00\nTax: 8.00\nGrand Total: 108.00", "invoice.pdf"); }
function reviewed() {
  const w = buildWorksheet(invoice()); w.businessEvidenceConfirmed = true;
  const j = w.journals[0]; j.confirmed = true; j.taxTreatment = "nonrecoverable_in_cost";
  j.lines[0].accountCode = "910-0000"; j.lines[1].accountCode = "400-S001";
  return w;
}

test("printed grand total is not confused with subtotal or a tax rate", () => {
  const doc = invoice();
  assert.equal(doc.totals.total.value, 108); assert.equal(doc.totals.subtotal.value, 100); assert.equal(doc.totals.tax.value, 8);
  assert.equal(extractText("Invoice No: INV-001\nSST 8%\nTotal: 108.00", "invoice.pdf").totals.tax.value, null);
});
test("purchase proposals debit the expense or asset and credit the payable without invented account codes", () => {
  const j = buildWorksheet(invoice()).journals[0];
  assert.equal(j.lines[0].debit, 108); assert.equal(j.lines[1].credit, 108);
  assert.equal(j.lines[0].accountCode, ""); assert.equal(j.lines[0].accountName, "Office supplies");
  assert.equal(j.date, "2026-01-15"); assert.ok(j.evidence.excerpt.includes("Grand Total"));
});
test("a receipt is not automatically booked as revenue", () => {
  const doc = extractText("Receipt No: OR-900001\nDate: 2026-01-15\nRM\nTotal: 1000.00", "receipt.pdf");
  const j = buildWorksheet(doc).journals[0];
  assert.match(j.lines[1].accountName, /Receivable/); assert.ok(j.assumptions.length);
});
test("multi-transaction teaching documents keep separate proposals and leave omitted years blank", () => {
  const doc = extractText("AutoCount Cloud Accounting Course Book\nTask 1.5 Cash Book\n<<New>>\nOR-900001 05 Jan CIMB-KL 100-0000 Capital 100,000.00\n<<New>>\nOR-900002 06 Jan CASH 500-1000 Cash Sales 10,000.00", "chapter.pdf");
  const w = buildWorksheet(doc);
  assert.equal(w.journals.length, 2); assert.equal(w.sourceKind, "training_material");
  assert.equal(w.journals[0].amount, 100000); assert.equal(w.journals[1].amount, 10000);
  assert.equal(w.journals[0].date, ""); assert.match(w.journals[0].treatment, /not sales revenue/);
  assert.equal(w.businessEvidenceConfirmed, false); assert.ok(worksheetIssues(w).length);
});
test("a multi-line source journal retains each account and proposes a balanced partition", () => {
  const w = buildWorksheet(extractText("Course Book\nJV-900001 12 Jan\n905-0000 Travelling 300.00\n909-0000 Telephone 50.00\n905-0000 Meeting 150.00\n905-0000 Mileage 250.00\n310-CIMB Bank 250.00\n320-0000 Cash 1,000.00", "chapter.pdf"));
  const j = w.journals[0]; assert.equal(j.lines.length, 6); assert.equal(j.amount, 1000);
  assert.deepEqual(journalTotals(j), { debit: 1000, credit: 1000, difference: 0 });
  assert.ok(j.assumptions.some((x) => x.includes("provisional")));
});
test("invoices and credit notes retain opposite debit/credit treatment", () => {
  const text = "Course Book\n300-C001 Customer One <<New>> I-900001 15 Jan 500-0000 Sales Item A 1 5,000.00 5,000.00\n300-C001 Customer One <<New>> CN-900001 I-900001 20 Jan 510-0000 Sales Return Item A 500.00";
  const w = buildWorksheet(extractText(text, "chapter.pdf"));
  assert.equal(w.journals.length, 2);
  assert.equal(w.journals[0].lines[0].credit, 5000); assert.equal(w.journals[1].lines[0].debit, 500);
});
test("product catalogues and setup prices do not become financial transactions", () => {
  const w = buildWorksheet(extractText("Course Book Chapter 3 Product\nProduct Code 006\nProduct Name POS Basic\nFull Set RM12,000.00\nUnit Cost 1,000.00", "chapter.pdf"));
  assert.equal(w.journals.length, 0);
});
test("explicit stock adjustments use quantity times cost, with opposite sides for increases and decreases", () => {
  const doc = extractText("Course Book\nTask 3.4 Stock Adjustment\nDate: 05/01/yyyy\nStock Code Description Quantity Unit Cost\n001 Example product 1 1,000.00\n002 Other product -1 3,000.00\nTask 3.5 View Stock Reports", "chapter.pdf");
  const w = buildWorksheet(doc);
  assert.equal(w.journals.length, 2); assert.equal(w.journals[0].amount, 1000); assert.equal(w.journals[1].amount, 3000);
  assert.equal(w.journals[0].lines[0].debit, 1000); assert.equal(w.journals[1].lines[0].credit, 3000);
  assert.equal(w.journals[0].date, ""); assert.equal(journalDate(w.journals[0].rawDate, "2026"), "2026-01-05");
  assert.equal(w.businessEvidenceConfirmed, false);
});
test("quoted CSV narratives and debit/credit columns survive extraction and grouping", () => {
  const doc = extractCsv('Reference,Date,Account Code,Account Name,Description,Debit,Credit\nJV-900002,2026-01-10,910-0000,Stationery,"Paper, pens",125.00,0\nJV-900002,2026-01-10,320-0000,Cash,Payment,0,125.00');
  const w = buildWorksheet(doc);
  assert.equal(w.journals.length, 1); assert.equal(w.journals[0].lines.length, 2);
  assert.equal(w.journals[0].lines[0].description, "Paper, pens");
  assert.equal(journalTotals(w.journals[0]).difference, 0);
});
test("invalid dates are rejected and missing years require explicit input", () => {
  assert.equal(journalDate("05 Jan"), ""); assert.equal(journalDate("05 Jan", "2026"), "2026-01-05");
  assert.equal(journalDate("2026-02-30"), ""); assert.equal(journalDate("2026-01-50"), "");
  assert.equal(journalDate("15/01/2026"), "2026-01-15");
});
test("unbalanced, two-sided, missing and nonfinite amounts cannot pass validation", () => {
  const j = reviewed().journals[0]; assert.equal(journalIssues(j).length, 0);
  j.lines[1].credit = 100; assert.ok(journalIssues(j).some((x) => x.includes("differ")));
  j.lines[0].credit = 8; assert.ok(journalIssues(j).some((x) => x.includes("one positive")));
  j.lines[0].debit = NaN; assert.ok(journalIssues(j).length);
});
test("the financial year, currency, accounts, tax and reviewer are not silently assumed", () => {
  const w = reviewed(); assert.equal(worksheetIssues(w).length, 0);
  w.journals[0].taxTreatment = "unreviewed"; assert.ok(worksheetIssues(w).length);
  w.journals[0].confirmed = false; assert.ok(worksheetIssues(w).some((x) => x.includes("Review and confirm")));
  w.businessEvidenceConfirmed = false; assert.ok(worksheetIssues(w).some((x) => x.includes("actual company")));
});
test("native AutoCount payload uses master/details, real account codes, dates and balanced numeric sides", () => {
  const j = reviewed().journals[0]; const p = makeJournalPayload(j, "12345678-1234-1234-1234-123456789012");
  assert.equal(p.master.docDate, "2026-01-15"); assert.equal(p.master.currencyCode, "MYR"); assert.equal(p.master.journalType, "GENERAL");
  assert.equal(p.details[0].accNo, "910-0000"); assert.equal(p.details[0].dr, 108); assert.equal(p.details[1].cr, 108);
  assert.equal(matchesPostedJournal(p, p), true);
  assert.equal(matchesPostedJournal(p, { ...p, details: [{ ...p.details[0], dr: 999 }, p.details[1]] }), false);
  assert.equal(p.saveApprove, false);
});
test("workpaper CSV keeps each debit/credit line, evidence page and reviewed state", () => {
  const w = reviewed(); const csv = worksheetCsv(w);
  assert.match(csv, /"Debit","Credit"/); assert.match(csv, /"108.00","0.00"/); assert.match(csv, /"Source page"/);
});
test("legacy classifier does not invent the Utilities account for unknown material", () => {
  const tx = classifyDocument(extractText("Product catalogue, Unit Cost: 100.00", "catalogue.pdf"), []);
  assert.equal(tx.transaction_type, "UNSUPPORTED"); assert.deepEqual(tx.entries, []);
});
