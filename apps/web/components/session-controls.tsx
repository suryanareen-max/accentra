"use client";

import { useState } from "react";
import { authClient } from "../lib/auth/client";

export function SessionControls() {
  const { data: session, isPending, error } = authClient.useSession();
  const [signingOut, setSigningOut] = useState(false);
  const [message, setMessage] = useState("");

  async function signOut() {
    setSigningOut(true);
    setMessage("");
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message || "Could not sign out. Try again.");
      window.location.assign("/login");
    } catch (err) {
      try {
        const response = await fetch("/api/session/sign-out", { method: "POST", credentials: "same-origin" });
        if (!response.ok) throw new Error("The local session could not be cleared.");
        window.location.assign("/login?signout=local");
      } catch {
        setMessage(err instanceof Error ? err.message : "Could not sign out. Try again.");
        setSigningOut(false);
      }
    }
  }

  if (isPending) return <div className="session-controls" role="status">Checking sign-in…</div>;
  if (!session?.user) return <div className="session-controls"><span>{error ? "Session unavailable" : "Signed out"}</span><a href="/login">Sign in</a><a href="/auth/sign-up">Create account</a></div>;

  return <div className="session-controls"><div><strong>{session.user.name || session.user.email}</strong><small>Signed in · {session.user.email}</small></div><button type="button" onClick={signOut} disabled={signingOut}>{signingOut ? "Signing out…" : "Sign out"}</button>{message && <span role="alert">{message}</span>}</div>;
}
