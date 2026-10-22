"use client";
import { useRef, useState } from "react";
import type { AnalysisResult } from "../lib/deepseek";
import { AnalysisAnswer } from "./analysis-answer";
import { readUploadResponse } from "../lib/upload-response";
type Message = { role: "assistant" | "user" | "system"; text: string; result?: AnalysisResult };
type Attachment = { id: string; filename: string };
export function ChatWorkspace() {
  const input = useRef<HTMLInputElement>(null);
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", text: "I’m your DeepSeek accounting analyst. Attach a financial document or ask about the available book records. I can analyse source evidence, journal entries and IFRS/MFRS treatment." }]);
  const [question, setQuestion] = useState(""); const [busy, setBusy] = useState(false); const [uploading, setUploading] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null); const [search, setSearch] = useState(true);
  async function ask(value = question.trim(), selected = attachment, fresh = false) {
    if (!value || busy) return;
    setMessages((current) => [...current, { role: "user", text: value }]); setQuestion(""); setBusy(true);
    try {
      const history = fresh ? [] : messages.filter((message) => message.role !== "system").slice(-8).map((message) => ({ role: message.role, content: message.text }));
      const response = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: value, mode: selected ? "document" : "books", documentId: selected?.id, history, search }) });
      const result: AnalysisResult = await readUploadResponse(response, "DeepSeek analysis");
      setMessages((current) => [...current, { role: "assistant", text: result.answer, result }]);
    } catch (error) { setMessages((current) => [...current, { role: "system", text: error instanceof Error ? error.message : "Analysis failed. Please retry." }]); }
    finally { setBusy(false); }
  }
  async function upload(file: File) {
    setUploading(true); setMessages((current) => [...current, { role: "system", text: `Uploading ${file.name} and preparing its source text…` }]);
    try {
      const presign = await fetch("/api/documents/presign", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ filename: file.name, size: file.size, contentType: file.type || "application/octet-stream" }) });
      const payload = await readUploadResponse(presign, "Preparing upload");
      const form = new FormData(); form.set("file", file);
      await readUploadResponse(await fetch(payload.uploadUrl, { method: "POST", body: form }), "Saving document");
      await readUploadResponse(await fetch(payload.extractUrl, { method: "POST" }), "Reading document");
      await readUploadResponse(await fetch(`/api/documents/${payload.document.id}/classify`, { method: "POST" }), "Classifying document");
      const selected = { id: payload.document.id, filename: file.name };
      setAttachment(selected); setMessages([{ role: "system", text: `${file.name} is attached. DeepSeek is analysing its extracted text. Follow-up questions will use this document.` }]);
      await ask("Analyse the attached document: identify transactions and amounts, propose debit/credit entries, evaluate IFRS/MFRS treatment and flag missing evidence for AutoCount.", selected, true);
    } catch (error) { setMessages((current) => [...current, { role: "system", text: error instanceof Error ? error.message : "Upload failed. Please retry." }]); }
    finally { setUploading(false); }
  }
  return <div className="chat-workspace card">{attachment && <div className="analysis-attachment"><span>Attached: <a href={`/review/${attachment.id}`}>{attachment.filename} · Open workpaper</a></span><button type="button" className="button secondary" disabled={busy || uploading} onClick={() => { setAttachment(null); setMessages([{ role: "system", text: "Document detached. Questions now use the book mirror summary." }]); }}>Detach</button></div>}<div className="chat-thread">{messages.map((message, index) => <div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}><div className="chat-role">{message.role === "assistant" ? "DeepSeek · Accentra" : message.role === "user" ? "You" : "System"}</div><div className="chat-bubble">{message.result ? <AnalysisAnswer result={message.result} /> : message.text}</div></div>)}</div><label className="analysis-search"><input type="checkbox" checked={search} onChange={(event) => setSearch(event.target.checked)} disabled={busy || uploading} /> Search official IFRS/MFRS references</label><div className="chat-composer"><button className="attach-button" onClick={() => input.current?.click()} disabled={uploading || busy} title="Upload a document">＋</button><input ref={input} hidden type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.xlsx,.xls,.csv,.docx" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file); }} /><input className="question-input" value={question} maxLength={4000} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !uploading) void ask(); }} placeholder={attachment ? "Ask about the attached document…" : "Ask about your books or attach a document…"} /><button className="button" onClick={() => void ask()} disabled={busy || uploading || !question.trim()}>{busy ? "Analysing…" : uploading ? "Reading…" : "Send"}</button></div><div className="chat-disclaimer">Selected source text is sent to DeepSeek. AI suggestions require review and never post from chat. Scanned pages need OCR.</div></div>;
}
