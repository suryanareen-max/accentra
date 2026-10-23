import { getDocument, listDocuments } from "../../../lib/document-store";
import { analyseWithDeepSeek, DeepSeekError, isGreeting, type ConversationTurn } from "../../../lib/deepseek";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (typeof body?.message !== "string" || !body.message.trim() || body.message.length > 4000) return Response.json({ error: "Enter a question of up to 4,000 characters." }, { status: 400 });
    const mode = body.mode === "document" ? "document" : body.mode === "standards" ? "standards" : "books";
    const document = mode === "document" && typeof body.documentId === "string" ? await getDocument(body.documentId) : undefined;
    if (mode === "document" && !document) return Response.json({ error: "Document not found. Upload or select a document first." }, { status: 404 });
    if (document && !document.extracted?.source_text?.trim()) return Response.json({ error: "This file has no readable extracted text. Re-read it, or upload a text-based PDF, Excel, CSV or Word (.docx) file. Scanned pages need OCR before analysis." }, { status: 422 });
    const history: ConversationTurn[] = Array.isArray(body.history) ? body.history.slice(-8).filter((turn: ConversationTurn) => (turn?.role === "user" || turn?.role === "assistant") && typeof turn.content === "string").map((turn: ConversationTurn) => ({ role: turn.role, content: turn.content.slice(0, 6000) })) : [];
    const result = await analyseWithDeepSeek({ message: body.message.trim(), document, documents: mode === "books" && !isGreeting(body.message) ? await listDocuments() : [], history, search: body.search !== false });
    return Response.json({ ...result, mode, documentId: document?.id }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof DeepSeekError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
    console.error("Accounting analysis failed", error instanceof Error ? error.name : "UnknownError");
    return Response.json({ error: "Analysis could not be completed. Please retry." }, { status: 500 });
  }
}
