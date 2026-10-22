import Link from "next/link";
import { AuthView } from "@neondatabase/auth-ui";

const headings: Record<string, { eyebrow: string; title: string; description: string }> = {
  "sign-in": {
    eyebrow: "WELCOME BACK",
    title: "Good to see you.",
    description: "Sign in to pick up where you left off.",
  },
  "sign-up": {
    eyebrow: "A CLEARER WAY TO WORK",
    title: "Make room for better work.",
    description: "Create your account and bring your books into focus.",
  },
  "forgot-password": {
    eyebrow: "LET’S GET YOU BACK IN",
    title: "A fresh start.",
    description: "We’ll help you reset your password and return to your workspace.",
  },
  "reset-password": {
    eyebrow: "YOUR ACCOUNT, SECURED",
    title: "Set a new password.",
    description: "Choose a new password to get back to your workspace.",
  },
};

export function AuthScreen({ path }: { path: string }) {
  const heading = headings[path] ?? {
    eyebrow: "YOUR ACCENTRA ACCOUNT",
    title: "Your workspace awaits.",
    description: "Everything you need to keep your work in good shape.",
  };

  return (
    <main className="login-page">
      <section className="login-story" aria-label="Welcome to Accentra">
        <Link href="/" className="brand marketing-brand login-brand">accentra<span>·</span>ai</Link>
        <div className="login-story-content">
          <span className="hero-kicker"><span className="live-dot" /> YOUR WORKSPACE, IN GOOD SHAPE</span>
          <h1>Good books.<br /><em>Clear head.</em></h1>
          <p>Bring the busywork into focus, and keep every important decision in your hands.</p>
          <div className="login-decoration" aria-hidden="true">
            <div className="login-orbit login-orbit-a" />
            <div className="login-orbit login-orbit-b" />
            <div className="login-glass glass-back" />
            <div className="login-glass glass-mid" />
            <div className="login-glass glass-front"><span>a.</span></div>
            <div className="login-sparkle">✳</div>
          </div>
        </div>
        <div className="login-story-foot"><span>THOUGHTFUL ACCOUNTING AUTOMATION</span><span>01 — 03</span></div>
      </section>
      <section className="login-form-side" aria-labelledby="auth-heading">
        <div className="login-form-wrap">
          <Link href="/" className="back-home">← <span>Back to home</span></Link>
          <div className="form-heading">
            <span className="form-eyebrow">{heading.eyebrow}</span>
            <h2 id="auth-heading">{heading.title}</h2>
            <p>{heading.description}</p>
          </div>
          <AuthView
            path={path}
            classNames={{
              base: "accentra-auth-card",
              header: "accentra-auth-header",
              content: "accentra-auth-content",
              footer: "accentra-auth-footer",
              footerLink: "accentra-auth-link",
              form: {
                input: "accentra-auth-input",
                label: "accentra-auth-label",
                primaryButton: "accentra-auth-submit",
                forgotPasswordLink: "accentra-auth-forgot",
              },
            }}
          />
        </div>
        <footer className="login-footer"><span>© 2026 Accentra AI</span><a href="mailto:hello@accentra.ai">Need help?</a></footer>
      </section>
    </main>
  );
}
