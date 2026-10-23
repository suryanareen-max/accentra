import { getDocument, listDocuments } from "../../../lib/document-store";
import { analyseWithDeepSeek, DeepSeekError, isGreeting, type ConversationTurn } from "../../../lib/deepseek";
import { auth } from "../../../lib/auth/server";
import { claimConversation, finishConversation, getConversation } from "../../../lib/conversation-store";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  let claimed: { id: string; ownerId: string; requestId: string } | undefined;
  try {
    const body = await request.json().catch(() => null);
    if (typeof body?.message !== "string" || !body.message.trim() || body.message.length > 4000) return Response.json({ error: "Enter a question of up to 4,000 characters." }, { status: 400 });
    let documentId = typeof body.documentId === "string" ? body.documentId : undefined;
    let annotation = "";
    let search = body.search !== false;
    let mode = body.mode === "document" ? "document" : body.mode === "standards" ? "standards" : "books";
    let history: ConversationTurn[] = Array.isArray(body.history) ? body.history.slice(-8).filter((turn: ConversationTurn) => (turn?.role === "user" || turn?.role === "assistant") && typeof turn.content === "string").map((turn: ConversationTurn) => ({ role: turn.role, content: turn.content.slice(0, 6000) })) : [];
    let savedConversation;
    let ownerId = "";
    if (body.conversationId !== undefined) {
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (typeof body.conversationId !== "string" || !uuid.test(body.conversationId) || typeof body.requestId !== "string" || !uuid.test(body.requestId)) return Response.json({ error: "Invalid conversation request." }, { status: 400 });
      const session = await auth.getSession(); if (!session.data?.user) return Response.json({ error: "Sign in to continue this conversation." }, { status: 401 });
      ownerId = session.data.user.id;
      savedConversation = await getConversation(body.conversationId,ownerId);
      if (!savedConversation) return Response.json({ error: "Conversation not found." }, { status: 404 });
      const cached = savedConversation.messages.find((message) => message.role === "assistant" && message.requestId === body.requestId)?.result;
      if (cached) return Response.json({ ...cached, conversationId: savedConversation.id });
      if (savedConversation.messages.length >= 100) return Response.json({ error: "This conversation is full. Start a new chat to continue; this history is saved." }, { status: 400 });
      documentId = savedConversation.documentId ?? undefined; annotation = savedConversation.annotation; search = savedConversation.search; mode = documentId ? "document" : "books";
      history = savedConversation.messages.filter((message) => message.role === "user" || message.role === "assistant").slice(-8).map((message) => ({ role: message.role as "user" | "assistant", content: message.text.slice(0,6000) }));
    }
    const document = mode === "document" && documentId ? await getDocument(documentId) : undefined;
    if (mode === "document" && !document) return Response.json({ error: "This document was removed or is unavailable. Restore it or detach it from this chat." }, { status: 404 });
    if (document?.extracted?.ocr?.pendingPages.length) return Response.json({ error: "Finish OCR before analysis. Use Read / OCR to continue the remaining pages." }, { status: 422 });
    if (document && !document.extracted?.source_text?.trim()) return Response.json({ error: "No readable text is available yet. Use Read / OCR before analysis. If OCR finds no legible text, upload a clearer scan." }, { status: 422 });
    if (savedConversation) {
      const claim = await claimConversation(savedConversation.id,ownerId,body.requestId,body.message.trim(),annotation,documentId ?? null,document ? `${document.filename} — ${body.message.trim()}` : body.message.trim());
      if (!claim) return Response.json({ error: "A response is already being prepared. Refresh this conversation shortly; your question is saved." }, { status: 409 });
      claimed = { id: savedConversation.id, ownerId, requestId: body.requestId };
    }
    const result = await analyseWithDeepSeek({ message: body.message.trim(), document, documents: mode === "books" && !isGreeting(body.message) ? await listDocuments() : [], history, search, annotation });
    if (claimed) {
      const saved = await finishConversation(claimed.id,claimed.ownerId,claimed.requestId,{ role: "assistant", text: result.answer, result });
      if (!saved) return Response.json({ error: "The response could not be saved because this conversation changed. Refresh the saved conversation." }, { status: 409 });
    }
    return Response.json({ ...result, mode, documentId: document?.id, conversationId: savedConversation?.id }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof DeepSeekError ? error.message : "Analysis could not be completed. Please retry.";
    if (claimed) await finishConversation(claimed.id,claimed.ownerId,claimed.requestId,{ role: "system", text: message }).catch(() => undefined);
    if (error instanceof DeepSeekError) return Response.json({ error: message, code: error.code }, { status: error.status });
    console.error("Accounting analysis failed", error instanceof Error ? error.name : "UnknownError");
    return Response.json({ error: message }, { status: 500 });
  }
}
