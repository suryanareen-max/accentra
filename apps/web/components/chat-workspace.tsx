"use client";
import { useEffect, useRef, useState } from "react";
import type { DocumentRecord } from "../lib/contracts";
import type { ConversationSummary, SavedConversation } from "../lib/chat-contracts";
import { AnalysisAnswer } from "./analysis-answer";
import { requestChat, ChatRequestError } from "../lib/chat-request";
import { readUploadResponse } from "../lib/upload-response";
import { prepareDocument } from "../lib/prepare-document";
async function jsonRequest(url: string, options?: RequestInit) { return readUploadResponse(await fetch(url, { cache: "no-store", ...options }), "Conversation"); }
export function ChatWorkspace({ compact = false }: { compact?: boolean }) {
  const input = useRef<HTMLInputElement>(null); const mounted = useRef(true);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]); const [conversation, setConversation] = useState<SavedConversation | null>(null);
  const [document, setDocument] = useState<DocumentRecord | null>(null); const [annotation, setAnnotation] = useState(""); const [search, setSearch] = useState(true);
  const [question, setQuestion] = useState(""); const [busy, setBusy] = useState(false); const [progress, setProgress] = useState(""); const [error, setError] = useState(""); const [signInRequired, setSignInRequired] = useState(false);
  const [loading, setLoading] = useState(true); const [showHistory, setShowHistory] = useState(!compact); const [historyFilter, setHistoryFilter] = useState(""); const [optimistic, setOptimistic] = useState("");
  const pending = Boolean(conversation?.pendingRequestId && conversation.pendingSince && Date.now() - new Date(conversation.pendingSince).getTime() < 120000);
  const disabled = busy || loading || pending;
  const notesDirty = Boolean(conversation && (annotation !== conversation.annotation || search !== conversation.search));
  function remember(value: SavedConversation) {
    setConversation(value);
    setConversations((current) => [{ id:value.id,title:value.title,documentId:value.documentId,updatedAt:value.updatedAt },...current.filter((item) => item.id !== value.id)].slice(0,100));
  }
  async function refreshHistory() { const result = await jsonRequest("/api/conversations"); setConversations(result.conversations); return result.conversations as ConversationSummary[]; }
  async function loadConversation(id: string, replaceInputs = true) {
    const result = await jsonRequest(`/api/conversations/${id}`); const saved = result.conversation as SavedConversation;
    if (!mounted.current) return saved;
    remember(saved);
    if (replaceInputs) {
      setAnnotation(saved.annotation); setSearch(saved.search); setQuestion(""); setOptimistic("");
      if (saved.documentId) {
        try { const payload = await jsonRequest(`/api/documents/${saved.documentId}`); setDocument(payload.document); }
        catch { setDocument(null); setError("This chat's document is in Trash or unavailable. Restore it or detach it to continue."); }
      } else setDocument(null);
    }
    return saved;
  }
  useEffect(() => {
    mounted.current = true;
    void (async () => {
      try {
        const items = await refreshHistory();
        const selected = !compact ? new URLSearchParams(window.location.search).get("conversation") : null;
        if (selected || items[0]) await loadConversation(selected || items[0].id);
      } catch (error) { if (mounted.current) setError(error instanceof Error ? error.message : "Could not load chat history."); }
      finally { if (mounted.current) setLoading(false); }
    })();
    return () => { mounted.current = false; };
  }, []); // Each mounted workspace loads its signed-in user's history once.
  useEffect(() => {
    if (!conversation?.pendingRequestId || !pending) return;
    const timer = setInterval(() => { void loadConversation(conversation.id, false).catch(() => undefined); }, 3000);
    return () => clearInterval(timer);
  }, [conversation?.id, conversation?.pendingRequestId, pending]);
  useEffect(() => {
    if (!compact && conversation?.id) {
      const url = new URL(window.location.href); url.searchParams.set("conversation",conversation.id); window.history.replaceState(null,"",url);
    }
  }, [compact,conversation?.id]);
  async function ensureConversation() {
    if (conversation) return conversation;
    const result = await jsonRequest("/api/conversations", { method: "POST" }); const saved = result.conversation as SavedConversation; remember(saved); return saved;
  }
  async function saveContext(value?: SavedConversation, documentId?: string | null) {
    const current = value || await ensureConversation();
    const result = await jsonRequest(`/api/conversations/${current.id}`, { method: "PATCH", headers: { "content-type":"application/json" }, body: JSON.stringify({ annotation, search, documentId: documentId === undefined ? current.documentId : documentId }) });
    remember(result.conversation); return result.conversation as SavedConversation;
  }
  function showError(error: unknown) { setError(error instanceof Error ? error.message : "The request failed. Please retry."); setSignInRequired(error instanceof ChatRequestError && error.signInRequired); }
  async function chooseConversation(id?: string) {
    if (disabled) return; setBusy(true); setError("");
    try {
      if (notesDirty) await saveContext();
      if (id) await loadConversation(id);
      else { const result = await jsonRequest("/api/conversations", { method:"POST" }); remember(result.conversation); setDocument(null); setAnnotation(""); setQuestion(""); setSearch(true); setOptimistic(""); }
      if (compact) setShowHistory(false);
    } catch (error) { showError(error); } finally { setBusy(false); }
  }
  async function upload(file: File) {
    if (disabled) return; setBusy(true); setError(""); setProgress(`Uploading ${file.name}…`);
    try {
      const current = await ensureConversation();
      const presign = await readUploadResponse(await fetch("/api/documents/presign", { method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({filename:file.name,size:file.size,contentType:file.type||"application/octet-stream"}) }),"Preparing upload");
      const form = new FormData(); form.set("file",file);
      const result = await readUploadResponse(await fetch(presign.uploadUrl,{method:"POST",body:form}),"Saving document");
      await saveContext(current,presign.document.id); setDocument(result.document || presign.document);
      setProgress("File attached. Preview it and add notes below. Reading/OCR and AI analysis start only when you choose them.");
    } catch (error) { showError(error); } finally { setBusy(false); }
  }
  async function ask(value = question.trim()) {
    if (!value || disabled) return; setBusy(true); setError(""); setSignInRequired(false); setProgress(""); let saved: SavedConversation | undefined;
    const requestId = crypto.randomUUID();
    try {
      saved = await saveContext();
      if (saved.documentId && (!document?.extracted || !document.worksheet || document.extracted.ocr?.pendingPages.length || (!document.extracted.source_text?.trim() && !document.extracted.ocr))) setDocument(await prepareDocument(saved.documentId,setProgress));
      setQuestion(""); setOptimistic(value); setProgress("DeepSeek is analysing…");
      await requestChat({ message:value,mode:saved.documentId?"document":"books",conversationId:saved.id,requestId,search },()=>setProgress("Connection interrupted. Reconnecting once…"));
      await loadConversation(saved.id,false); setOptimistic(""); setProgress("");
    } catch (error) {
      setQuestion(value); setOptimistic(""); showError(error); setProgress("");
      if (saved) {
        try { const latest = await loadConversation(saved.id,false); if (latest.messages.some((message)=>message.role==="assistant"&&message.requestId===requestId)) { setError(""); setQuestion(""); } } catch { /* Keep the original actionable error and typed question. */ }
      }
    } finally { setBusy(false); }
  }
  async function detach() {
    if (disabled) return; setBusy(true); setError("");
    try { await saveContext(undefined,null); setDocument(null); setProgress("Document detached. Saved messages remain in this conversation."); } catch (error) { showError(error); } finally { setBusy(false); }
  }
  const messages = conversation?.messages ?? [];
  return <div className={`saved-chat ${compact?"compact-chat":""}`}><div className="saved-chat-actions"><button className="button" disabled={disabled} onClick={()=>void chooseConversation()}>＋ New chat</button><button className="button secondary" aria-expanded={showHistory} onClick={()=>setShowHistory(!showHistory)}>Past chats</button><span className="doc-meta">{conversation ? "Saved in your account" : "Start a conversation"}</span></div><div className="saved-chat-layout">{showHistory && <aside className="conversation-history" aria-label="Past conversations"><h2>Past conversations</h2><input aria-label="Search conversations" placeholder="Search conversations…" value={historyFilter} onChange={(event)=>setHistoryFilter(event.target.value)} /><div className="conversation-links">{conversations.filter((item)=>item.title.toLowerCase().includes(historyFilter.toLowerCase())).map((item)=><button key={item.id} className={conversation?.id===item.id?"active":""} disabled={disabled} onClick={()=>void chooseConversation(item.id)}><strong>{item.title}</strong><small>{new Date(item.updatedAt).toLocaleString("en-MY",{timeZone:"Asia/Kuala_Lumpur"})}</small></button>)}{!conversations.length&&<p className="doc-meta">Your conversations will appear here.</p>}</div></aside>}<div className="chat-workspace card">{conversation?.documentId && <div className="annotation-panel"><div className="analysis-attachment"><strong>{document?.filename||"Attached document"}</strong><div><a href={`/review/${conversation.documentId}`} target="_blank" rel="noopener noreferrer">Open workpaper ↗</a> <button className="button secondary" disabled={disabled} onClick={()=>void detach()}>Remove file</button></div></div><details className="attachment-preview"><summary>Preview original file</summary>{document?.contentType.startsWith("image/") ? <img src={`/api/documents/${conversation.documentId}/file`} alt={`Original uploaded file: ${document.filename}`} /> : document?.contentType==="application/pdf" ? <iframe title="Original uploaded PDF" src={`/api/documents/${conversation.documentId}/file`} /> : <p>Office documents can be opened in their original application.</p>}<a href={`/api/documents/${conversation.documentId}/file`} target="_blank" rel="noopener noreferrer">Open original in a new tab ↗</a></details><label className="annotation-label">Extra instructions (optional)<textarea aria-label="Extra instructions for analysing the document" value={annotation} maxLength={6000} rows={3} disabled={disabled} onChange={(event)=>setAnnotation(event.target.value)} placeholder="For example: exclude the void invoice or check the negative quantity." /></label><div className="annotation-actions"><button className="button" disabled={disabled} onClick={()=>void ask("Analyse the attached document using my extra instructions. Identify dates, amounts and balanced debit/credit proposals; explain IFRS/MFRS treatment and what must be checked before AutoCount posting.")}>{busy?"Analyzing…":"Analyze document"}</button><span className="doc-meta">{notesDirty?"Your instructions will be saved when you analyze":document?.extracted?.ocr?`OCR ${document.extracted.ocr.status} · ${document.extracted.ocr.processedPages.length} page(s) read`:document?.extracted?"Text is ready": "Analyzing will read the document and run OCR if needed"}</span></div>{document?.extracted?.source_text&&<details className="recognized-text"><summary>View extracted text</summary><pre>{document.extracted.source_text}</pre></details>}{document?.extracted?.ocr?.warnings.map((warning)=><p key={warning} className="doc-meta ocr-notice">{warning}</p>)}</div>}<div className="chat-thread" aria-live="polite">{!messages.length && !optimistic && <div className="chat-message assistant"><div className="chat-role">DeepSeek · Accentra</div><div className="chat-bubble">{loading?"Loading your saved conversations…":"Attach a document and choose Analyze document, or ask a question about your books. Your chats are saved in your account."}</div></div>}{messages.map((message)=><div className={`chat-message ${message.role}`} key={message.id}><div className="chat-role">{message.role==="user"?"You":message.role==="assistant"?"DeepSeek · Accentra":"System"}</div><div className="chat-bubble">{message.result?<AnalysisAnswer result={message.result}/>:message.text}{message.role==="user"&&message.annotation&&<details><summary>Extra instructions used</summary><p>{message.annotation}</p></details>}</div></div>)}{optimistic&&!messages.some((message)=>message.role==="user"&&message.text===optimistic)&&<div className="chat-message user"><div className="chat-role">You</div><div className="chat-bubble">{optimistic}</div></div>}</div>{(progress||pending)&&<p className="chat-progress" role="status">{progress||"A response is being prepared. This conversation refreshes automatically."}</p>}{error&&<div role="alert" className="analysis-warning">{error} {signInRequired&&<a href="/login" target="_blank" rel="noopener noreferrer">Sign in, then return to this chat</a>}</div>}<label className="analysis-search"><input type="checkbox" checked={search} disabled={disabled} onChange={(event)=>setSearch(event.target.checked)}/> Search official IFRS/MFRS references</label><div className="chat-composer"><button className="attach-button" disabled={disabled} title="Upload a document" aria-label="Attach a document" onClick={()=>input.current?.click()}>＋</button><input hidden type="file" ref={input} accept=".pdf,.jpg,.jpeg,.png,.heic,.xlsx,.xls,.csv,.docx" onChange={(event)=>{const file=event.target.files?.[0];event.target.value="";if(file)void upload(file);}}/><textarea aria-label="Chat question" className="question-input" rows={2} maxLength={4000} value={question} disabled={disabled} onChange={(event)=>setQuestion(event.target.value)} onKeyDown={(event)=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();void ask();}}} placeholder={conversation?.documentId?"Ask about the attached document…":"Ask about your books or attach a document…"}/><button className="button" disabled={disabled||!question.trim()} onClick={()=>void ask()}>{busy?"Working…":"Send"}</button></div><div className="chat-disclaimer">OCR runs automatically when you analyze a document. Verify extracted figures against the original. Chat never approves or posts entries to AutoCount.</div></div></div></div>;
}
