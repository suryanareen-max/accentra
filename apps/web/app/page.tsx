import Link from "next/link";

const features = [
  { number: "01", title: "From document to data", copy: "Invoices, statements and receipts become structured entries, with every figure linked back to its source." },
  { number: "02", title: "A second set of eyes", copy: "Clear validation catches duplicates, mismatches and missing details before they reach your books." },
  { number: "03", title: "People stay in control", copy: "Your team reviews every suggestion. Nothing is posted until someone approves it." },
];

export default function Home() {
  return (
    <main className="marketing">
      <header className="marketing-nav">
        <Link href="/" className="brand marketing-brand">accentra<span>·</span>ai</Link>
        <nav aria-label="Main navigation"><a href="#how-it-works">How it works</a><a href="#built-for">Built for finance</a></nav>
        <div className="nav-actions"><Link className="nav-login" href="/login">Log in</Link><Link className="button nav-cta" href="/login">Get started <span>↗</span></Link></div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="hero-kicker"><span className="live-dot" /> THE CLEARER WAY TO CLOSE</div>
          <h1>Make room for<br />the <em>work that matters.</em></h1>
          <p className="hero-lede">Turn financial documents into books you can trust. Accentra reads, checks and organises the busywork, while your team stays in control.</p>
          <div className="hero-actions"><Link className="button hero-button" href="/login">Get started <span>↗</span></Link><a className="text-link" href="#how-it-works">See how it works <span>↓</span></a></div>
          <div className="hero-proof"><div className="proof-avatars"><span>AL</span><span>MK</span><span>SN</span></div><div><strong>Made for the people behind the numbers</strong><small>Accountants · Finance teams · Growing businesses</small></div></div>
        </div>
        <div className="hero-art" aria-label="Accentra bookkeeping workspace preview">
          <div className="art-glow" />
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="art-caption"><span className="caption-mark">a.</span><span>Good books.<br /><strong>Clear head.</strong></span></div>
          <div className="preview-window">
            <div className="preview-top"><div className="preview-brand"><span className="mini-mark">a.</span> accentra</div><div className="preview-dots"><i /><i /><i /></div></div>
            <div className="preview-body"><div className="preview-greeting"><span>WEDNESDAY, 21 OCTOBER</span><strong>Your books, in good shape.</strong></div>
              <div className="preview-metrics"><div><span>Ready for review</span><strong>12 <small>items</small></strong></div><div><span>Posted this month</span><strong>184 <small>entries</small></strong></div></div>
              <div className="preview-list-head"><span>RECENT DOCUMENTS</span><span>STATUS</span></div>
              <div className="preview-row"><span className="file-icon">↗</span><span className="preview-file"><strong>Tenaga Supplies</strong><small>Invoice · RM 4,200.00</small></span><span className="review-tag"><i /> Review</span></div>
              <div className="preview-row"><span className="file-icon file-green">↗</span><span className="preview-file"><strong>Maybank · September</strong><small>Statement · 1 sheet</small></span><span className="ready-tag"><i /> Ready</span></div>
              <div className="preview-row"><span className="file-icon file-violet">↗</span><span className="preview-file"><strong>Kencana Office Systems</strong><small>Payment voucher · RM 860</small></span><span className="ready-tag"><i /> Ready</span></div>
              <div className="preview-foot"><span className="shield">✓</span> Every entry is checked. Every post is yours.</div>
            </div>
          </div>
          <div className="floating-note"><span className="note-check">✓</span><span><strong>Human-approved</strong><small>Always in your hands</small></span></div>
          <div className="art-stamp">BUILT FOR<br /><strong>BETTER BOOKS</strong><span>✳</span></div>
        </div>
        <div className="hero-bottom"><span>LESS PAPERWORK, MORE PERSPECTIVE</span><span className="bottom-rule" /><span>01 — 03</span></div>
      </section>

      <section className="trust-strip" id="built-for"><span>BUILT FOR THE DETAILS THAT MATTER</span><div><b>Accounting firms</b><i /> <b>In-house finance</b><i /> <b>Growing businesses</b></div></section>
      <section className="features-section" id="how-it-works"><div className="features-intro"><div className="hero-kicker">A BETTER WAY THROUGH THE WORK</div><h2>Let the routine<br />run <em>smoother.</em></h2><p>Accentra brings the document trail and the accounting workflow together, so your team can spend less time chasing details.</p></div><div className="feature-list">{features.map((item) => <article className="feature-item" key={item.number}><span>{item.number}</span><div><h3>{item.title}</h3><p>{item.copy}</p></div><b>↗</b></article>)}</div></section>
      <section className="closing-cta"><div><span className="hero-kicker">YOUR BOOKS, WITH A LITTLE MORE CLARITY</span><h2>Ready for a better<br /><em>kind of busy?</em></h2></div><Link className="button hero-button" href="/login">Get started with Accentra <span>↗</span></Link></section>
      <footer className="marketing-footer"><Link href="/" className="brand marketing-brand">accentra<span>·</span>ai</Link><span>Thoughtful accounting automation, with people in control.</span><Link href="/login">Log in ↗</Link></footer>
    </main>
  );
}
