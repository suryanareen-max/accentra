"use client";

import { useState } from "react";

export function DocumentAnalysisChat({ documentId }: { documentId: string }) {
  const [message, setMessage] = useState("Analyse this document and explain the proposed IFRS/MFRS treatment.");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask() {
    if (!message.trim()) return;
    setBusy(true);
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message, mode: "document", documentId }) });
      const result = await response.json();
      setAnswer(response.ok ? result.answer : result.error ?? "Analysis failed.");
    } catch { setAnswer("The analysis service could not be reached. Try again."); }
    finally { setBusy(false); }
  }

  return <section className="card section document-chat"><div className="section-head"><div><h2>Accounting analyst</h2><p className="doc-meta">Ask Accentra to analyse evidence, evaluate the classification, and explain proposed IFRS/MFRS treatment.</p></div><span className="pill green">Human review required</span></div><div className="document-chat-input"><textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={2} aria-label="Ask about this document" /><button className="button" onClick={() => void ask()} disabled={busy}>{busy ? "Analysing…" : "Analyse"}</button></div>{answer && <div className="chat-answer">{answer}</div>}<p className="footer-note">Standards guidance is advisory. Accentra will only send an approved, validated entry to AutoCount.</p></section>;
}
