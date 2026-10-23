"use client";
import { prepareDocument } from "../lib/prepare-document";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AccountingWorksheet, JournalDraft, JournalLine } from "../lib/contracts";
import { blankJournal, journalDate, journalIssues, journalTotals, todayKualaLumpur, worksheetIssues } from "../lib/accounting-worksheet";
import { readUploadResponse } from "../lib/upload-response";
import type { CloudAccount } from "../lib/autocount-cloud";

type Connection = { configured: boolean; missing: string[]; accountBookId: string; accounts: CloudAccount[]; error?: string };
type Submission = { id: string; status: string; externalReference: string | null; lastError: string | null; journalId?: string };

function mapAccounts(worksheet: AccountingWorksheet, accounts: CloudAccount[]) {
  let changes = 0;
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const mapped = worksheet.journals.map((journal) => {
    const lines = journal.lines.map((line) => {
      const existing = accounts.find((account) => account.code.toLowerCase() === line.accountCode.toLowerCase());
      if (existing) {
        if (line.accountName === existing.name) return line;
        changes++;
        return { ...line, accountName: existing.name };
      }
      const target = normalize(line.accountName);
      const aliases = /receivable|debtor/.test(target) ? ["trade receivables", "accounts receivable", "trade debtors", "debtors control", "sundry debtors"]
        : /revenue|sales/.test(target) ? ["sales revenue", "sales", "service revenue", "service income", "revenue"]
        : /payable|creditor|supplier/.test(target) ? ["trade creditors", "accounts payable", "trade payables", "creditors control", "sundry creditors"]
        : /cash|bank/.test(target) ? ["cash at bank", "bank", "cash in hand", "cash"]
        : /expense|utilities|supplies|professional|inventory|asset/.test(target) ? target.split(" ").filter((word) => word.length > 3) : [];
      const candidates = accounts.map((account) => {
        const name = normalize(account.name);
        let score = name === target && target ? 100 : 0;
        for (const alias of aliases) {
          const normalizedAlias = normalize(alias);
          if (name === normalizedAlias) score = Math.max(score, 90);
          else if (name.includes(normalizedAlias) || normalizedAlias.includes(name)) score = Math.max(score, 65);
        }
        if (target.split(" ").filter((word) => word.length > 2 && name.includes(word)).length >= 2) score = Math.max(score, 55);
        return { account, score };
      }).filter((candidate) => candidate.score >= 65).sort((a, b) => b.score - a.score);
      const best = candidates[0];
      if (!best || (candidates[1] && candidates[1].score === best.score)) {
        if (line.accountCode) { changes++; return { ...line, accountCode: "" }; }
        return line;
      }
      if (best.account.code === line.accountCode && best.account.name === line.accountName) return line;
      changes++;
      return { ...line, accountCode: best.account.code, accountName: best.account.name };
    });
    if (lines.every((line, index) => line === journal.lines[index])) return journal;
    return { ...journal, lines, confirmed: false, approvedAt: undefined };
  });
  return { worksheet: changes ? { ...worksheet, journals: mapped } : worksheet, changes };
}

export function AccountingWorkpaper({ documentId, filename, initialWorksheet, submissions: initialSubmissions }: { documentId: string; filename: string; initialWorksheet: AccountingWorksheet; submissions: Submission[] }) {
  const normalizedInitial = { ...initialWorksheet, journals: initialWorksheet.journals.map((j) => ({ ...j, date: journalDate(j.date) || journalDate(j.rawDate) || todayKualaLumpur(), currency: "MYR", currencyRate: 1 })) };
  const needsDefaultsSaved = initialWorksheet.journals.some((j, i) => j.currency !== "MYR" || j.currencyRate !== 1 || j.date !== normalizedInitial.journals[i].date || (j.confirmed && !j.approvedAt && journalIssues(normalizedInitial.journals[i]).length === 0));
  const [worksheet, setWorksheet] = useState(normalizedInitial);
  const [connection, setConnection] = useState<Connection>({ configured: false, missing: [], accountBookId: "", accounts: [] });
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [connectionLoaded, setConnectionLoaded] = useState(false);
  const [busy, setBusy] = useState(""); const [message, setMessage] = useState(""); const [dirty, setDirty] = useState(needsDefaultsSaved);
  const attemptedValidation = useRef("");
  const issues = worksheetIssues(worksheet);
  const selected = worksheet.journals.filter((j) => j.included);
  const pendingAccountMap = connection.configured && connection.accounts.length ? mapAccounts(worksheet, connection.accounts).changes > 0 : false;
  const autoReady = connectionLoaded && !pendingAccountMap && selected.length > 0 && selected.every((j) => j.confirmed && journalIssues(j).length === 0) && issues.length === 0;

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

  useEffect(() => {
    if (!connection.configured || !connection.accounts.length) return;
    const result = mapAccounts(worksheet, connection.accounts);
    if (!result.changes) return;
    setWorksheet(result.worksheet);
    setDirty(true);
    setMessage(`Auto-matched ${result.changes} journal line${result.changes === 1 ? "" : "s"} against the synced AutoCount chart. Review the account selections, then confirm each journal again.`);
  }, [connection, worksheet]);

  function patchJournal(id: string, patch: Partial<JournalDraft>, clearConfirmation = true) {
    setWorksheet((w) => ({ ...w, journals: w.journals.map((j) => j.id === id ? { ...j, ...patch, ...(clearConfirmation ? { confirmed: false, approvedAt: undefined } : {}) } : j) }));
    setDirty(true); setMessage("");
  }
  function patchLine(j: JournalDraft, index: number, patch: Partial<JournalLine>) { patchJournal(j.id, { lines: j.lines.map((l, i) => i === index ? { ...l, ...patch } : l) }); }

  const save = useCallback(async () => {
    setBusy("save"); setMessage("");
    try {
      const response = await fetch(`/api/documents/${documentId}/journal`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(worksheet) });
      const payload = await readUploadResponse(response, "Saving journal worksheet");
      setWorksheet(payload.worksheet); setDirty(false);
      setMessage(payload.issues.length ? `Automatically saved and validated. ${payload.issues.length} item(s) still need review.` : "Automatically saved and validated. The reviewed journals are ready for AutoCount.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save."); }
    finally { setBusy(""); }
  }, [documentId, worksheet]);

  useEffect(() => {
    if (!dirty || !autoReady || busy || submissions.length > 0) return;
    const key = JSON.stringify(worksheet);
    if (attemptedValidation.current === key) return;
    attemptedValidation.current = key;
    void save();
  }, [autoReady, busy, dirty, save, submissions.length, worksheet]);

  async function reanalyse() {
    setBusy("analyse"); setMessage("");
    try {
      const document = await prepareDocument(documentId, setMessage, true);
      if (!document.worksheet) throw new Error("Journal preparation did not complete. Retry the document.");
      setWorksheet(document.worksheet); setDirty(false);
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
    <section className="workpaper-toolbar card section"><div><span className="eyebrow">ACCOUNTANT WORKPAPER · {filename}</span><h1>Transactions &amp; journal entries</h1><p>Review detected transactions, accounting treatment and balanced AutoCount journal entries.</p></div><div className="workpaper-actions"><a className="ghost-button" href="/dashboard">← Dashboard</a><a className="ghost-button" href={`/api/documents/${documentId}/file`} target="_blank" rel="noreferrer">Open original file ↗</a><button className="ghost-button" disabled={Boolean(busy) || dirty || submissions.length > 0} onClick={() => void reanalyse()}>{busy === "analyse" ? "Reading source…" : "Re-read original document"}</button></div></section>

    {message && <div role="status" className="workpaper-message">{message}</div>}
    <div className="workpaper-summary"><article><small>Transaction proposals</small><strong>{worksheet.journals.length}</strong></article><article><small>Included for review</small><strong>{selected.length}</strong></article><article><small>Review items remaining</small><strong>{issues.length}</strong></article><article><small>AutoCount connection</small><strong>{!connectionLoaded ? "Checking…" : connection.configured ? `Book ${connection.accountBookId}` : "Not connected"}</strong></article></div>

    <div className="workpaper-notice workpaper-required"><strong>Required before sending to AutoCount GL journal</strong><br />Complete every asterisked field and review each proposal. AutoCount account matches are suggested from your synced chart; verify them against the original document. Validation runs once automatically when the required details are complete and the review box is checked. Currency is MYR; an unrecognized date defaults to today and can be edited.</div>

    <section className="card section connection-panel"><div className="section-head"><div><h2>AutoCount account mapping</h2><p>{connection.configured ? `${connection.accounts.length} postable accounts read from account book ${connection.accountBookId}.` : "Export is available without a connection. Direct posting needs your live account book and API credentials."}</p></div><button className="ghost-button" disabled={!connectionLoaded} onClick={() => void sync()}>Sync chart of accounts</button></div>{connection.missing.length > 0 && <p className="workpaper-notice">Missing Vercel configuration: {connection.missing.join(", ")}. These are server settings; never put the API secret in a journal or browser field.</p>}{connection.error && <p role="alert">{connection.error}</p>}<p className="footer-note">Direct posting creates <strong>GL journals only</strong>. It does not create stock movements, invoice documents, tax returns or invoice knock-off allocations. Use the recommended native module where those records are required; do not post the same transaction through both routes.</p></section>
    <datalist id="cloud-accounts">{connection.accounts.map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}</datalist>

    {worksheet.journals.length > 0 && <section className="card section"><h2>Transaction register</h2><p>Each row is a separate proposed journal. Review source amounts and the debit/credit totals before opening its workpaper.</p><div className="journal-table-wrap"><table className="transaction-register"><thead><tr><th>Reference</th><th>Date</th><th>Transaction</th><th>Source amount</th><th>Total debit</th><th>Total credit</th><th>Status</th></tr></thead><tbody>{worksheet.journals.map((j) => { const t = journalTotals(j); return <tr key={j.id}><td><a href={`#journal-${j.id}`}>{j.reference || "New journal"}</a></td><td>{j.date || `${j.rawDate || "Missing date"} · confirm year`}</td><td>{j.kind.replaceAll("_", " ")}</td><td>{j.currency || "?"} {j.amount?.toFixed(2) ?? "Missing"}</td><td>{t.debit.toFixed(2)}</td><td>{t.credit.toFixed(2)}</td><td>{!j.included ? "Excluded" : journalIssues(j).length ? "Needs review" : j.confirmed ? "Reviewed" : "Confirm evidence"}</td></tr>; })}</tbody></table></div></section>}

    <div className="section-head"><h2>Journal workpapers</h2><button className="ghost-button" onClick={() => { setWorksheet((w) => ({ ...w, journals: [...w.journals, blankJournal(`manual-${Date.now()}`)] })); setDirty(true); }}>+ Add journal</button></div>
    {worksheet.journals.length === 0 && <section className="card section"><h3>No reliable financial transactions found</h3><p>Provide a dated invoice, receipt, payment voucher, bank transaction table, or an explicit debit/credit schedule. Product setup and price lists do not establish a journal entry.</p></section>}
    {worksheet.journals.map((j, index) => {
      const totals = journalTotals(j), problems = journalIssues(j);
      const submitted = submissions.find((p) => p.journalId === j.id);
      const sendBlocker = submitted ? "This journal already has a posting record." : !connection.configured ? "AutoCount is not connected. Sync accounts and check the connection settings above." : dirty ? autoReady ? "Automatically saving and validating this workpaper…" : "Complete the required fields and review confirmation to automatically save and validate." : !j.included ? "Select Include for this transaction." : problems.length ? `Resolve the ${problems.length} journal issue(s) listed above.` : !j.confirmed ? "Tick the review confirmation below to automatically save and validate." : "";
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
          <label className="workpaper-check journal-confirm"><input type="checkbox" checked={j.confirmed} onChange={(e) => patchJournal(j.id, { confirmed: e.target.checked }, false)} /><span>I confirm this is a company transaction and have reviewed its date, amount, accounts, debit/credit sides and treatment.<b className="required-mark"> *</b></span></label>
        </fieldset>
        <div className="journal-submit"><div className="journal-send-status"><span className="doc-meta">{submitted ? `${submitted.status} · ${submitted.externalReference || "Result needs verification"}${submitted.lastError ? ` · ${submitted.lastError}` : ""}` : dirty && autoReady ? "Saving and validating automatically…" : j.confirmed && !dirty ? "Reviewed and validated" : "Draft · complete required fields and confirm review"}</span>{sendBlocker && <small role="status">{sendBlocker}</small>}</div><button className="button" disabled={Boolean(busy) || Boolean(sendBlocker)} title={sendBlocker || "Send this reviewed journal to AutoCount"} onClick={() => void send(j.id)}>{busy === j.id ? "Sending…" : "Send as AutoCount GL journal"}</button></div>
      </section>;
    })}
    <section className="card section workpaper-export"><div><h2>Export &amp; handoff</h2><p>The CSV is an accountant workpaper. The validated JSON uses AutoCount's native journal input model; it is not an invoice or inventory import.</p>{dirty && <p className="workpaper-notice">Complete required fields and confirm review to trigger automatic save and validation.</p>}</div><div className="workpaper-actions">{!dirty && <a className="ghost-button" href={`/api/documents/${documentId}/journal/export`}>Download journal CSV</a>}{!dirty && !issues.length && <a className="ghost-button" href={`/api/documents/${documentId}/journal/export?format=json`}>Download AutoCount JSON</a>}<a className="link" href="/post-queue">Posting log →</a></div></section>
  </div>;
}
