"use client";
import { prepareDocument } from "../lib/prepare-document";

import { useEffect, useState } from "react";
import type { AccountingWorksheet, JournalDraft, JournalLine } from "../lib/contracts";
import { blankJournal, journalDate, journalIssues, journalTotals, todayKualaLumpur, worksheetIssues } from "../lib/accounting-worksheet";
import { readUploadResponse } from "../lib/upload-response";
import type { CloudAccount } from "../lib/autocount-cloud";

type Connection = { configured: boolean; missing: string[]; accountBookId: string; accounts: CloudAccount[]; error?: string };
type Submission = { id: string; status: string; externalReference: string | null; lastError: string | null; journalId?: string };

export function AccountingWorkpaper({ documentId, filename, initialWorksheet, initialSourceText, submissions: initialSubmissions }: { documentId: string; filename: string; initialWorksheet: AccountingWorksheet; initialSourceText: string; submissions: Submission[] }) {
  const normalizedInitial = { ...initialWorksheet, journals: initialWorksheet.journals.map((j) => ({ ...j, date: journalDate(j.date) || journalDate(j.rawDate) || todayKualaLumpur(), currency: "MYR", currencyRate: 1 })) };
  const needsDefaultsSaved = initialWorksheet.journals.some((j, i) => j.currency !== "MYR" || j.currencyRate !== 1 || j.date !== normalizedInitial.journals[i].date);
  const [worksheet, setWorksheet] = useState(normalizedInitial);
  const [sourceText, setSourceText] = useState(initialSourceText);
  const [connection, setConnection] = useState<Connection>({ configured: false, missing: [], accountBookId: "", accounts: [] });
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [connectionLoaded, setConnectionLoaded] = useState(false);
  const [busy, setBusy] = useState(""); const [message, setMessage] = useState(""); const [dirty, setDirty] = useState(needsDefaultsSaved);
  const issues = worksheetIssues(worksheet);
  const selected = worksheet.journals.filter((j) => j.included);

  async function sync() {
    setConnectionLoaded(false);
    try {
      const response = await fetch("/api/autocount/accounts");
      const payload = await readUploadResponse(response, "Syncing AutoCount accounts");
      setConnection({ ...payload, accounts: payload.accounts || [] });
    } catch (error) { setConnection((c) => ({ ...c, configured: false, error: error instanceof Error ? error.message : "Account sync failed" })); }
    finally { setConnectionLoaded(true); }
  }
  useEffect(() => { void sync(); }, []);

  function patchJournal(id: string, patch: Partial<JournalDraft>, clearConfirmation = true) {
    setWorksheet((w) => ({ ...w, journals: w.journals.map((j) => j.id === id ? { ...j, ...patch, ...(clearConfirmation ? { confirmed: false, approvedAt: undefined } : {}) } : j) }));
    setDirty(true); setMessage("");
  }
  function patchLine(j: JournalDraft, index: number, patch: Partial<JournalLine>) { patchJournal(j.id, { lines: j.lines.map((l, i) => i === index ? { ...l, ...patch } : l) }); }

  async function save() {
    setBusy("save"); setMessage("");
    try {
      const response = await fetch(`/api/documents/${documentId}/journal`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(worksheet) });
      const payload = await readUploadResponse(response, "Saving journal worksheet");
      setWorksheet(payload.worksheet); setDirty(false);
      setMessage(payload.issues.length ? `Worksheet saved. ${payload.issues.length} item(s) still need review.` : "Worksheet saved and validated. The reviewed journals are ready for payload export.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save."); }
    finally { setBusy(""); }
  }

  async function reanalyse() {
    setBusy("analyse"); setMessage("");
    try {
      const document = await prepareDocument(documentId, setMessage, true);
      if (!document.worksheet) throw new Error("Journal preparation did not complete. Retry the document.");
      setWorksheet(document.worksheet); setSourceText(document.extracted?.source_text || ""); setDirty(false);
      setMessage(`Prepared ${document.worksheet.journals.length} journal proposal(s). Verify OCR text, dates, amounts and account mapping against the original.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to analyse."); }
    finally { setBusy(""); }
  }

  async function send(journalId: string) {
    setBusy(journalId); setMessage("");
    try {
      const response = await fetch("/api/postings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ documentId, journalId }) });
      const result = await response.json();
      if (result.posting) setSubmissions((old) => [...old.filter((p) => p.id !== result.posting.id), { ...result.posting, journalId }]);
      setMessage(result.message || result.error || (response.ok ? "Journal submitted." : "Posting failed."));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Posting result unknown. Check AutoCount before retrying."); }
    finally { setBusy(""); }
  }

  return <div className="workpaper">
    <section className="workpaper-toolbar card section"><div><span className="eyebrow">ACCOUNTANT WORKPAPER · {filename}</span><h1>Transactions &amp; journal entries</h1><p>Source evidence → accounting treatment → balanced journal → reviewed AutoCount payload.</p></div><div className="workpaper-actions"><a className="ghost-button" href="/dashboard">← Dashboard</a><a className="ghost-button" href={`/api/documents/${documentId}/file`} target="_blank" rel="noreferrer">Open original file ↗</a><button className="ghost-button" disabled={Boolean(busy) || dirty || submissions.length > 0} onClick={() => void reanalyse()}>{busy === "analyse" ? "Reading source…" : "Re-read original document"}</button><button className="button" disabled={Boolean(busy)} onClick={() => void save()}>{busy === "save" ? "Saving…" : "Save & validate"}</button></div></section>

    {message && <div role="status" className="workpaper-message">{message}</div>}
    {!sourceText && <div className="workpaper-notice">No machine-readable source text is saved. Select <strong>Re-read original document</strong> for a digital PDF, spreadsheet or Word file. Images and scanned pages need OCR or manual transcription; use <strong>Open original file</strong> to check the evidence.</div>}
    <div className="workpaper-summary"><article><small>Transaction proposals</small><strong>{worksheet.journals.length}</strong></article><article><small>Included for review</small><strong>{selected.length}</strong></article><article><small>Review items remaining</small><strong>{issues.length}</strong></article><article><small>AutoCount connection</small><strong>{!connectionLoaded ? "Checking…" : connection.configured ? `Book ${connection.accountBookId}` : "Not connected"}</strong></article></div>

    <section className="card section"><div className="section-head"><h2>Source &amp; reporting context</h2><span className="pill amber">{worksheet.sourceKind.replaceAll("_", " ")}</span></div><ul className="workpaper-notices">{worksheet.notices.map((n, i) => <li key={i}>{n}</li>)}</ul>
      <div className="workpaper-context"><label className="workpaper-check"><input type="checkbox" checked={worksheet.businessEvidenceConfirmed} onChange={(e) => { setWorksheet((w) => ({ ...w, businessEvidenceConfirmed: e.target.checked })); setDirty(true); }} /><span>These selected entries are supported by actual company transactions, not training examples.<b className="required-mark"> *</b></span></label></div>
      <details><summary>Read extracted source text</summary><pre className="source-text">{sourceText || "Source text not saved; re-read the original document."}</pre></details>
    </section>

    <div className="workpaper-notice workpaper-required"><strong>Required before sending to AutoCount GL journal</strong><br />Complete the asterisked details: source reference, transaction date, amount, journal narration, accounting treatment, account codes and names, and balanced debit/credit lines. Confirm the entries are actual company transactions, then review and save the journal. Currency is set to MYR. Dates that were missing default to today and remain editable.</div>

    <section className="card section connection-panel"><div className="section-head"><div><h2>AutoCount account mapping</h2><p>{connection.configured ? `${connection.accounts.length} postable accounts read from account book ${connection.accountBookId}.` : "Export is available without a connection. Direct posting needs your live account book and API credentials."}</p></div><button className="ghost-button" disabled={!connectionLoaded} onClick={() => void sync()}>Sync chart of accounts</button></div>{connection.missing.length > 0 && <p className="workpaper-notice">Missing Vercel configuration: {connection.missing.join(", ")}. These are server settings; never put the API secret in a journal or browser field.</p>}{connection.error && <p role="alert">{connection.error}</p>}<p className="footer-note">Direct posting creates <strong>GL journals only</strong>. It does not create stock movements, invoice documents, tax returns or invoice knock-off allocations. Use the recommended native module where those records are required; do not post the same transaction through both routes.</p></section>
    <datalist id="cloud-accounts">{connection.accounts.map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}</datalist>

    {worksheet.journals.length > 0 && <section className="card section"><h2>Transaction register</h2><p>Each row is a separate proposed journal. Review source amounts and the debit/credit totals before opening its workpaper.</p><div className="journal-table-wrap"><table className="transaction-register"><thead><tr><th>Reference</th><th>Date</th><th>Transaction</th><th>Source amount</th><th>Total debit</th><th>Total credit</th><th>Status</th></tr></thead><tbody>{worksheet.journals.map((j) => { const t = journalTotals(j); return <tr key={j.id}><td><a href={`#journal-${j.id}`}>{j.reference || "New journal"}</a></td><td>{j.date || `${j.rawDate || "Missing date"} · confirm year`}</td><td>{j.kind.replaceAll("_", " ")}</td><td>{j.currency || "?"} {j.amount?.toFixed(2) ?? "Missing"}</td><td>{t.debit.toFixed(2)}</td><td>{t.credit.toFixed(2)}</td><td>{!j.included ? "Excluded" : journalIssues(j).length ? "Needs review" : j.confirmed ? "Reviewed" : "Confirm evidence"}</td></tr>; })}</tbody></table></div></section>}

    <div className="section-head"><h2>Journal workpapers</h2><button className="ghost-button" onClick={() => { setWorksheet((w) => ({ ...w, journals: [...w.journals, blankJournal(`manual-${Date.now()}`)] })); setDirty(true); }}>+ Add journal</button></div>
    {worksheet.journals.length === 0 && <section className="card section"><h3>No reliable financial transactions found</h3><p>Provide a dated invoice, receipt, payment voucher, bank transaction table, or an explicit debit/credit schedule. Product setup and price lists do not establish a journal entry.</p></section>}
    {worksheet.journals.map((j, index) => {
      const totals = journalTotals(j), problems = journalIssues(j);
      const submitted = submissions.find((p) => p.journalId === j.id);
      return <section id={`journal-${j.id}`} className={`card section journal-paper ${j.included ? "" : "journal-excluded"}`} key={j.id}>
        <div className="section-head"><div><span className="eyebrow">TRANSACTION {index + 1} · SOURCE PAGE {j.evidence.page} · {j.source}</span><h2>{j.reference || "New journal"}</h2><p>{j.kind.replaceAll("_", " ")} · Recommended module: {j.recommendedModule}</p></div><label className="workpaper-check"><input type="checkbox" checked={j.included} onChange={(e) => patchJournal(j.id, { included: e.target.checked }, false)} />Include</label></div>
        <fieldset disabled={Boolean(submitted) || Boolean(busy)}>
          <div className="journal-fields"><label>Source reference<b className="required-mark"> *</b><input aria-label={`Reference ${index + 1}`} value={j.reference} onChange={(e) => patchJournal(j.id, { reference: e.target.value })} /></label><label>Transaction date<b className="required-mark"> *</b><input aria-label={`Transaction date ${index + 1}`} type="date" value={j.date} onChange={(e) => patchJournal(j.id, { date: e.target.value })} /><small>Source date: {j.rawDate || "Not identified · defaults to today"}</small></label><label>Party / counterparty<input value={j.party} onChange={(e) => patchJournal(j.id, { party: e.target.value })} /></label><label>Transaction amount (MYR)<b className="required-mark"> *</b><input type="number" min="0" step="0.01" value={j.amount ?? ""} onChange={(e) => patchJournal(j.id, { amount: e.target.value === "" ? null : Number(e.target.value) })} /></label><label>Currency<input value="MYR" readOnly /></label></div>
          <label className="journal-narration">Journal narration<b className="required-mark"> *</b><input value={j.description} onChange={(e) => patchJournal(j.id, { description: e.target.value })} /></label>
          <div className="journal-table-wrap"><table className="journal-table"><thead><tr><th>Account code<b className="required-mark"> *</b></th><th>Account / line description<b className="required-mark"> *</b></th><th>Debit (MYR)<b className="required-mark"> *</b></th><th>Credit (MYR)<b className="required-mark"> *</b></th><th>Department</th><th aria-label="Actions" /></tr></thead><tbody>{j.lines.map((l, row) => <tr key={row}><td><input aria-label={`Account code ${index + 1} line ${row + 1}`} list="cloud-accounts" value={l.accountCode} placeholder="Map account" onChange={(e) => { const a = connection.accounts.find((a) => a.code === e.target.value); patchLine(j, row, { accountCode: e.target.value, ...(a ? { accountName: a.name } : {}) }); }} /></td><td><input aria-label={`Account name ${index + 1} line ${row + 1}`} value={l.accountName} placeholder="Account name" onChange={(e) => patchLine(j, row, { accountName: e.target.value })} /><input aria-label={`Line description ${index + 1} line ${row + 1}`} value={l.description} placeholder="Line narration" onChange={(e) => patchLine(j, row, { description: e.target.value })} /></td><td><input aria-label={`Debit ${index + 1} line ${row + 1}`} type="number" min="0" step="0.01" value={l.debit} onChange={(e) => patchLine(j, row, { debit: Number(e.target.value) })} /></td><td><input aria-label={`Credit ${index + 1} line ${row + 1}`} type="number" min="0" step="0.01" value={l.credit} onChange={(e) => patchLine(j, row, { credit: Number(e.target.value) })} /></td><td><input aria-label={`Department ${index + 1} line ${row + 1}`} value={l.department} placeholder="Optional department" onChange={(e) => patchLine(j, row, { department: e.target.value })} /></td><td><button className="journal-remove" aria-label={`Remove journal ${index + 1} line ${row + 1}`} onClick={() => patchJournal(j.id, { lines: j.lines.filter((_, i) => i !== row) })}>×</button></td></tr>)}</tbody><tfoot><tr><th colSpan={2}>Journal totals</th><td>{totals.debit.toFixed(2)}</td><td>{totals.credit.toFixed(2)}</td><td colSpan={2}><span className={`pill ${totals.difference === 0 && totals.debit > 0 ? "green" : "red"}`}>{totals.difference === 0 && totals.debit > 0 ? "Balanced" : `Difference ${totals.difference.toFixed(2)}`}</span></td></tr></tfoot></table></div>
          <button className="ghost-button" onClick={() => patchJournal(j.id, { lines: [...j.lines, { accountCode: "", accountName: "", description: j.description, debit: 0, credit: 0, taxCode: "", department: "" }] })}>+ Add journal line</button>
          <label className="journal-narration">Accounting treatment &amp; recognition<b className="required-mark"> *</b><textarea rows={3} value={j.treatment} onChange={(e) => patchJournal(j.id, { treatment: e.target.value })} /></label>
          <div className="journal-standards">{j.standards.map((s) => <a href={s.url} key={s.url} target="_blank" rel="noreferrer">{s.label} ↗</a>)}</div>
          <details><summary>Source evidence · page {j.evidence.page}</summary><pre className="source-text">{j.evidence.excerpt}</pre>{j.assumptions.map((s, i) => <p className="workpaper-notice" key={i}>{s}</p>)}</details>
          {problems.length > 0 && <ul className="journal-issues">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
          <label className="workpaper-check journal-confirm"><input type="checkbox" disabled={problems.length > 0 || !worksheet.businessEvidenceConfirmed} checked={j.confirmed} onChange={(e) => patchJournal(j.id, { confirmed: e.target.checked }, false)} /><span>I have reviewed the source, date, amount, debit/credit sides, accounts and treatment.<b className="required-mark"> *</b></span></label>
        </fieldset>
        <div className="journal-submit"><span className="doc-meta">{submitted ? `${submitted.status} · ${submitted.externalReference || "Result needs verification"}${submitted.lastError ? ` · ${submitted.lastError}` : ""}` : j.confirmed ? "Reviewed · save before export or posting" : "Draft · review required"}</span><button className="button" disabled={Boolean(busy) || dirty || !connection.configured || problems.length > 0 || !j.confirmed || !j.included || !worksheet.businessEvidenceConfirmed || Boolean(submitted)} onClick={() => void send(j.id)}>{busy === j.id ? "Sending…" : "Send as AutoCount GL journal"}</button></div>
      </section>;
    })}
    <section className="card section workpaper-export"><div><h2>Export &amp; handoff</h2><p>The CSV is an accountant workpaper. The validated JSON uses AutoCount's native journal input model; it is not an invoice or inventory import.</p>{dirty && <p className="workpaper-notice">Save the latest changes before downloading.</p>}</div><div className="workpaper-actions"><button className="button" disabled={Boolean(busy)} onClick={() => void save()}>Save &amp; validate</button>{!dirty && <a className="ghost-button" href={`/api/documents/${documentId}/journal/export`}>Download journal CSV</a>}{!dirty && !issues.length && <a className="ghost-button" href={`/api/documents/${documentId}/journal/export?format=json`}>Download AutoCount JSON</a>}<a className="link" href="/post-queue">Posting log →</a></div></section>
  </div>;
}
