import { DocumentList } from "../../components/document-list";
import { UploadCard } from "../../components/upload-card";
import { BookChat } from "../../components/book-chat";
import { SessionControls } from "../../components/session-controls";
import { listDocuments } from "../../lib/document-store";
import { listJournalPostings } from "../../lib/journal-postings";
import { cloudStatus } from "../../lib/autocount-cloud";
export const dynamic = "force-dynamic";
export default async function Home() {
  const [allDocs, postings] = await Promise.all([listDocuments(true), listJournalPostings()]);
  const docs = allDocs.filter((doc) => !doc.trashed);
  const journals = docs.flatMap((d) => d.worksheet?.journals || []);
  const status = cloudStatus();
  const kpis = [
    ["UPLOADED DOCUMENTS",String(docs.length),"Saved source files","Open a document to inspect its evidence and journals"],
    ["JOURNAL PROPOSALS",String(journals.length),"Separate transaction workpapers","Draft entries require accountant review"],
    ["REVIEWED JOURNALS",String(journals.filter(j=>j.confirmed&&j.included).length),"Saved reviewer confirmations","Review does not mean the entry is posted"],
    ["NEEDS REVIEW",String(journals.filter(j=>j.included&&!j.confirmed).length),"Included draft transactions","Resolve dates, amounts, accounts and tax"],
    ["POSTED TO AUTOCOUNT",String(postings.filter(p=>p.status==="RECONCILED").length),"Verified by reading the saved record back","No simulated company revenue or balances"],
    ["AUTOCOUNT CONNECTION",status.configured?`Book ${status.accountBookId}`:"Not connected","Live integration status",status.configured?"Sync accounts in the journal workpaper":"API secret and account-book ID are required"],
  ];
  return <div className="accounting-shell"><aside className="accounting-sidebar"><div className="accounting-logo"><span>a</span><strong>accentra<span>·</span>ai</strong></div><div className="company-name">Accounting workspace</div><nav aria-label="Accounting navigation" className="accounting-nav"><a className="active" href="/dashboard"><span>▣</span>Dashboard</a><a href="#documents"><span>▤</span>Documents &amp; journals</a><a href="/post-queue"><span>≡</span>AutoCount posting log</a><a href="/chat"><span>◇</span>Ask Accentra</a></nav><div className="accounting-sidebar-foot">Cloud Accounting<br/><small>{status.configured?"Open a workpaper to sync accounts":"AutoCount connection required"}</small></div></aside><div className="accounting-content"><header className="accounting-topbar"><strong>Accounting workspace</strong><div className="top-actions"><SessionControls/></div></header><main className="accounting-main"><div className="accounting-heading"><h1>Your transaction workpapers</h1></div><section id="documents" className="documents-panel"><div className="section-head"><div><h2>Documents &amp; journal entries</h2><p>Upload a source document to prepare transaction details, debit/credit entries and accounting treatment.</p></div></div><div className="documents-grid"><DocumentList documents={allDocs.map((doc) => ({ id: doc.id, filename: doc.filename, createdAt: doc.createdAt, pages: doc.extracted?.quality.pages ?? null, journalCount: doc.worksheet?.journals.length ?? 0, hasWorksheet: Boolean(doc.worksheet), hasError: Boolean(doc.error), trashed: Boolean(doc.trashed) }))}/><UploadCard/></div><p className="footer-note">Source-linked proposals require review. Only approved, validated entries can be submitted to AutoCount.</p></section><section className="autocount-kpis" style={{marginTop:24}}>{kpis.map(([title,value,sub,detail])=><article className="autocount-card" key={title}><div className="autocount-card-title">{title}</div><strong>{value}</strong><small>{sub}</small><p>{detail}</p></article>)}</section><section className="card section accounting-insight" id="chat"><div className="section-head"><h2>Workspace records</h2></div><BookChat/></section></main></div></div>;
}
