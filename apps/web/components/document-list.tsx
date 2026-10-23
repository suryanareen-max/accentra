"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { paginate } from "../lib/pagination";
import { readUploadResponse } from "../lib/upload-response";

export type WorkpaperListItem = { id: string; filename: string; createdAt: string; pages: number | null; journalCount: number; hasWorksheet: boolean; hasError: boolean; trashed: boolean };

export function DocumentList({ documents }: { documents: WorkpaperListItem[] }) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [trash, setTrash] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState("");
  const [removed, setRemoved] = useState<WorkpaperListItem | null>(null);
  const all = documents.map((doc) => ({ ...doc, trashed: overrides[doc.id] ?? doc.trashed }));
  const activeCount = all.filter((doc) => !doc.trashed).length;
  const trashCount = all.length - activeCount;
  const pagination = paginate(all.filter((doc) => doc.trashed === trash), page, pageSize);
  const filteredIds = all.filter((doc) => doc.trashed === trash).map((doc) => doc.id);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selection.includes(id));
  const selectedDocs = all.filter((doc) => selection.includes(doc.id) && doc.trashed === trash);

  async function changeTrash(document: WorkpaperListItem, remove: boolean) {
    setBusy(document.id); setError("");
    try {
      await readUploadResponse(await fetch(`/api/documents/${document.id}`, { method: remove ? "DELETE" : "PATCH", headers: { "content-type": "application/json" }, body: remove ? undefined : JSON.stringify({ action: "restore" }) }), remove ? "Removing document" : "Restoring document");
      setOverrides((current) => ({ ...current, [document.id]: remove })); setSelection((items) => items.filter((id) => id !== document.id)); setConfirmId(null); setRemoved(remove ? document : null); router.refresh();
      return true;
    } catch (error) { setError(error instanceof Error ? error.message : "Could not update this document. Please retry."); return false; }
    finally { setBusy(null); }
  }

  async function changeSelected() {
    if (!selectedDocs.length) return;
    setBulkBusy(true); setError(""); setRemoved(null);
    const succeeded: string[] = [];
    for (const doc of selectedDocs) if (await changeTrash(doc, !trash)) succeeded.push(doc.id);
    setSelection((items) => items.filter((id) => !succeeded.includes(id)));
    setBulkBusy(false);
    if (succeeded.length) setError(`${succeeded.length} document${succeeded.length === 1 ? "" : "s"} ${trash ? "restored" : "moved to Trash"}.`);
  }

  function toggleAllSelection() {
    setSelection((current) => allFilteredSelected ? current.filter((id) => !filteredIds.includes(id)) : [...new Set([...current, ...filteredIds])]);
  }

  return <div className="document-list">
    <div className="document-list-toolbar">
      <div role="group" aria-label="Document list view"><button className={`list-tab ${!trash ? "selected" : ""}`} aria-pressed={!trash} onClick={() => { setTrash(false); setPage(1); setConfirmId(null); }}>Uploads ({activeCount})</button><button className={`list-tab ${trash ? "selected" : ""}`} aria-pressed={trash} onClick={() => { setTrash(true); setPage(1); setConfirmId(null); }}>Trash ({trashCount})</button></div>
      <label>Per page <select aria-label="Documents per page" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label>
    </div>
    <div className="document-selection-toolbar"><button className="button secondary" disabled={!filteredIds.length || bulkBusy} onClick={toggleAllSelection}>{allFilteredSelected ? "Unselect all" : "Select all"}</button><span>{selectedDocs.length} selected across {trash ? "Trash" : "Uploads"}{selection.length > selectedDocs.length ? " · other view selections retained" : ""}</span><button className="button" disabled={!selectedDocs.length || bulkBusy} onClick={() => void changeSelected()}>{bulkBusy ? "Updating…" : trash ? "Restore selected" : "Move selected to Trash"}</button></div>
    {error && <p className="analysis-warning" role={error.includes("moved to Trash") || error.includes("restored") ? "status" : "alert"}>{error}</p>}
    {removed && <div className="document-undo" role="status">Moved “{removed.filename}” to Trash. <button className="link" disabled={busy !== null || bulkBusy} onClick={() => void changeTrash(removed, false)}>Undo</button></div>}
    {trash && <p className="doc-meta">Documents here can be restored. Source files, review history and AutoCount postings are retained.</p>}
    <div className="queue">{pagination.items.length === 0 ? <p>{trash ? "Trash is empty." : "No documents yet. Upload your first invoice, voucher or transaction schedule."}</p> : pagination.items.map((doc) => <div className="document-list-row" key={doc.id}>
      <div className="queue-row"><label className="document-select"><input type="checkbox" aria-label={`Select ${doc.filename}`} checked={selection.includes(doc.id)} disabled={bulkBusy} onChange={() => setSelection((current) => current.includes(doc.id) ? current.filter((id) => id !== doc.id) : [...current, doc.id])} /></label><div className="document-list-name">{trash ? <strong>{doc.filename}</strong> : <a className="doc-title link" href={`/review/${doc.id}`}>{doc.filename}</a>}<div className="doc-meta">{new Date(doc.createdAt).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" })} · {doc.pages || "?"} page(s)</div></div>
      {!trash && <><span className={`pill ${doc.hasError ? "red" : "amber"}`}>{doc.hasError ? "Needs attention" : doc.hasWorksheet ? "Workpaper ready" : "Re-read for journals"}</span><a className="link document-journal-link" href={`/review/${doc.id}`}>{doc.journalCount} journals →</a></>}
      {trash ? <button className="button secondary" disabled={busy !== null || bulkBusy} onClick={() => void changeTrash(doc, false)}>{busy === doc.id ? "Restoring…" : "Restore"}</button> : <button className="document-delete" aria-label={`Delete ${doc.filename}`} title="Move document to Trash" disabled={busy !== null || bulkBusy} onClick={() => setConfirmId(confirmId === doc.id ? null : doc.id)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" /></svg></button>}</div>
      {confirmId === doc.id && <div className="document-delete-confirm" role="group" aria-label={`Confirm removal of ${doc.filename}`}><span>Move this workpaper to Trash? You can restore it later. AutoCount postings will remain.</span><button className="button" disabled={busy !== null || bulkBusy} onClick={() => void changeTrash(doc, true)}>{busy === doc.id ? "Removing…" : "Move to Trash"}</button><button className="button secondary" disabled={busy !== null || bulkBusy} onClick={() => setConfirmId(null)}>Cancel</button></div>}
    </div>)}</div>
    <nav className="document-pagination" aria-label="Document pagination"><span aria-live="polite">{pagination.from}–{pagination.to} of {pagination.total} documents · Page {pagination.page} of {pagination.pages}</span><div><button className="button secondary" aria-label="Previous document page" disabled={pagination.page === 1} onClick={() => { setPage(pagination.page - 1); setConfirmId(null); }}>Previous</button>{Array.from({ length: pagination.pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pagination.pages || Math.abs(n - pagination.page) <= 1).map((n) => <button className={`list-page ${n === pagination.page ? "selected" : ""}`} aria-label={`Document page ${n}`} aria-current={n === pagination.page ? "page" : undefined} key={n} onClick={() => { setPage(n); setConfirmId(null); }}>{n}</button>)}<button className="button secondary" aria-label="Next document page" disabled={pagination.page === pagination.pages} onClick={() => { setPage(pagination.page + 1); setConfirmId(null); }}>Next</button></div></nav>
  </div>;
}
