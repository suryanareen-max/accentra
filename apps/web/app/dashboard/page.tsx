import { UploadCard } from "../../components/upload-card";
import { BookChat } from "../../components/book-chat";

const queue = [
  { name: "INV-2026-1048.pdf", vendor: "Tenaga Supplies Sdn Bhd", meta: "Uploaded 8 min ago · 2 pages", amount: "RM 4,200.00", status: "Needs review", tone: "amber" },
  { name: "Maybank-statement-Sep.xlsx", vendor: "Maybank · September 2026", meta: "Uploaded 24 min ago · 1 sheet", amount: "RM 18,430.25", status: "Processing", tone: "green" },
  { name: "PV-00391.jpg", vendor: "Kencana Office Systems", meta: "Uploaded yesterday · 1 page", amount: "RM 860.00", status: "Ready to post", tone: "green" },
];

const kpis = [
  ["SALES", "RM 24,810", "Last 30 days", "↑ 12% vs September"],
  ["INVOICES", "12 invoices", "7 unpaid · 5 paid", "RM 18,430 outstanding"],
  ["QUOTATIONS", "7 quotations", "3 pending · 4 closed", "RM 31,200 total deal"],
  ["PROFIT AND LOSS", "RM 8,420", "Net income this month", "Income RM 24,810 · Expenses RM 16,390"],
  ["COST AND EXPENSES", "RM 16,390", "Last 30 days", "Utilities up 8.4%"],
  ["BANK ACCOUNTS", "RM 48,620.00", "Cash at bank", "Cash in hand RM 2,400.00"],
];

export default function Home() {
  return <div className="accounting-shell">
    <aside className="accounting-sidebar">
      <div className="accounting-logo"><span>a</span><strong>accentra<span>·</span>ai</strong></div>
      <div className="company-name">Horizon &amp; Co.</div>
      <nav aria-label="Accounting navigation" className="accounting-nav">
        {[["▣", "Dashboard", true], ["▤", "Sales"], ["♛", "Purchase"], ["▣", "Accounting"], ["◇", "Stock"], ["%", "Tax"], ["⚒", "Tools"]].map(([icon, label, active]) => <a className={active ? "active" : ""} href={label === "Dashboard" ? "/dashboard" : `#${String(label).toLowerCase()}`} key={String(label)}><span>{icon}</span>{label}<b>›</b></a>)}
      </nav>
      <div className="accounting-sidebar-foot">Cloud Accounting<br /><small>Last sync a few seconds ago</small></div>
    </aside>
    <div className="accounting-content">
      <header className="accounting-topbar"><button className="menu-button" aria-label="Open menu">☰</button><strong>Horizon &amp; Co.</strong><div className="top-search">⌕ &nbsp; Search...</div><div className="top-actions">?　♧　▦　⚙　 <span>Aina Raj</span><i>AR</i></div></header>
      <main className="accounting-main">
        <div className="accounting-heading"><div className="company-placeholder">▧</div><h1>Horizon &amp; Co.</h1></div>
        <section className="autocount-kpis">{kpis.map(([title, value, sub, detail]) => <article className="autocount-card" key={title}><div className="autocount-card-title">{title}<span>⌄</span></div><strong>{value}</strong><small>{sub}</small><p>{detail}</p></article>)}</section>
        <section className="documents-panel"><div className="section-head"><div><h2>Transaction documents</h2><p>Upload invoices, receipts, bank statements, and vouchers to record them in your book.</p></div><a href="#inbox" className="link">View all →</a></div><div className="documents-grid"><div className="queue">{queue.map((item) => <div className="queue-row" key={item.name}><div><div className="doc-title">{item.name}</div><div className="doc-meta">{item.vendor} · {item.meta}</div></div><span className={`pill ${item.tone}`}>{item.status}</span><span className="amount">{item.amount}</span></div>)}</div><UploadCard /></div><p className="footer-note">AI suggestions are advisory. Nothing posts until a reviewer approves it.</p></section>
        <section className="card section accounting-insight" id="chat"><div className="section-head"><h2>Book insights</h2><a className="link" href="#chat">Ask the books →</a></div><BookChat /></section>
      </main>
    </div>
  </div>;
}

