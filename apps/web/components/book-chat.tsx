"use client";
import { useState } from "react";
import type { AnalysisResult } from "../lib/deepseek";
import { AnalysisAnswer } from "./analysis-answer";
import { readUploadResponse } from "../lib/upload-response";
export function BookChat() {
  const [message, setMessage] = useState(""); const [result, setResult] = useState<AnalysisResult | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function ask() {
    if (!message.trim() || busy) return; setBusy(true); setError(""); setResult(null);
    try { setResult(await readUploadResponse(await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message, mode: "books", search: true }) }), "DeepSeek analysis")); }
    catch (error) { setError(error instanceof Error ? error.message : "Analysis failed. Please retry."); }
    finally { setBusy(false); }
  }
  return <div className="chat-box"><div className="doc-meta">DeepSeek · available document records and official standards search</div><div className="chat-input"><input value={message} maxLength={4000} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void ask(); }} placeholder="Ask: which documents need review?" /><button className="button" onClick={() => void ask()} disabled={busy}>{busy ? "Analysing…" : "Ask"}</button></div>{result && <AnalysisAnswer result={result} />}{error && <p role="alert" className="analysis-warning">{error}</p>}</div>;
}
