import Link from "next/link";

export default function Login() {
  return (
    <main className="login-page">
      <section className="login-story">
        <Link href="/" className="brand login-brand">accentra<span>·</span>ai</Link>
        <div className="login-story-content"><span className="hero-kicker"><span className="live-dot" /> YOUR WORKSPACE, IN GOOD SHAPE</span><h1>Good books.<br /><em>Clear head.</em></h1><p>Bring the busywork into focus, and keep every important decision in your hands.</p><div className="login-decoration"><div className="login-orbit login-orbit-a" /><div className="login-orbit login-orbit-b" /><div className="login-glass glass-back" /><div className="login-glass glass-mid" /><div className="login-glass glass-front"><span>a.</span></div><div className="login-sparkle">✳</div></div></div>
        <div className="login-story-foot"><span>THOUGHTFUL ACCOUNTING AUTOMATION</span><span>01 — 03</span></div>
      </section>
      <section className="login-form-side"><div className="login-form-wrap"><Link href="/" className="back-home">← <span>Back to home</span></Link><div className="form-heading"><span className="form-eyebrow">WELCOME BACK</span><h2>Good to see you.</h2><p>Sign in to pick up where you left off.</p></div><form className="auth-form" action="/dashboard"><label htmlFor="email">Work email</label><input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" required /><div className="password-label"><label htmlFor="password">Password</label><a href="#forgot-password">Forgot password?</a></div><input id="password" name="password" type="password" autoComplete="current-password" placeholder="Enter your password" required /><button className="button sign-in-button" type="submit">Sign in <span>↗</span></button></form><div className="login-divider"><span>NEW TO ACCENTRA?</span></div><Link className="create-account" href="mailto:hello@accentra.ai?subject=Accentra%20access">Talk to us about access <span>↗</span></Link><p className="login-legal">By signing in, you agree to our <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a>.</p></div><footer className="login-footer"><span>© 2026 Accentra AI</span><a href="mailto:hello@accentra.ai">Need help?</a></footer></section>
    </main>
  );
}
