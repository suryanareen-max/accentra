"use client";
import { useState } from "react";
import type { AnalysisResult, ConversationTurn } from "../lib/deepseek";
import { AnalysisAnswer } from "./analysis-answer";
import { requestChat, ChatRequestError } from "../lib/chat-request";
export function DocumentAnalysisChat({ documentId }: { documentId: string }) {
  const [message, setMessage] = useState("Analyse this document: check dates and amounts, propose balanced debit/credit entries, explain IFRS/MFRS treatment and what must be resolved before AutoCount posting.");
  const [results, setResults] = useState<Array<{ question: string; result: AnalysisResult }>>([]);
  const [history, setHistory] = useState<ConversationTurn[]>([]);
  const [signInRequired, setSignInRequired] = useState(false);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [search, setSearch] = useState(true);
  async function ask() {
    if (!message.trim() || busy) return;
    setBusy(true); setError(""); setSignInRequired(false); const question = message.trim();
    try {
      const result = await requestChat({ message: question, mode: "document", documentId, history, search });
      setResults((current) => [...current, { question, result }]);
      setHistory((current) => [...current, { role: "user", content: question } as ConversationTurn, { role: "assistant", content: result.answer } as ConversationTurn].slice(-8));
      setMessage("");
    } catch (error) { setSignInRequired(error instanceof ChatRequestError && error.signInRequired); setError(error instanceof Error ? error.message : "Analysis could not be reached. Try again."); }
    finally { setBusy(false); }
  }
  return <section className="card section document-chat"><div className="section-head"><div><h2>DeepSeek accounting analyst</h2><p className="doc-meta">Analyse this document’s extracted text and saved journals. Ask follow-up questions about amounts, entries or reporting treatment.</p></div><span className="pill green">Human review required</span></div>{results.map(({ question, result }, index) => <div className="analysis-turn" key={index}><strong>You: {question}</strong><AnalysisAnswer result={result} /></div>)}<label className="analysis-search"><input type="checkbox" checked={search} onChange={(event) => setSearch(event.target.checked)} disabled={busy} /> Search official IFRS/MFRS references with DeepSeek</label><div className="document-chat-input"><textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={3} maxLength={4000} placeholder="Ask a follow-up about this document…" aria-label="Ask about this document" /><button className="button" onClick={() => void ask()} disabled={busy || !message.trim()}>{busy ? "Analysing…" : "Analyse with DeepSeek"}</button></div>{error && <p role="alert" className="analysis-warning">{error} {signInRequired && <a href="/login" target="_blank" rel="noopener noreferrer">Sign in, then retry</a>}</p>}<p className="footer-note">The selected document’s extracted text is sent to DeepSeek for analysis. Public searches use accounting topics only. AI suggestions do not change saved journals or post to AutoCount. Scanned pages require OCR.</p></section>;
}
