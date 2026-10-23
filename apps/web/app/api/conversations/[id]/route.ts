import { auth } from "../../../../lib/auth/server";
import { editConversation, getConversation } from "../../../../lib/conversation-store";
import { getDocument } from "../../../../lib/document-store";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function GET(_request: Request, { params }: { params: Promise<{id:string}> }) {
  const session = await auth.getSession(); if (!session.data?.user) return Response.json({ error: "Sign in to view this conversation." }, { status: 401 });
  const id = (await params).id; if (!uuid.test(id)) return Response.json({ error: "Invalid conversation ID." }, { status: 400 });
  try { const conversation = await getConversation(id,session.data.user.id); return conversation ? Response.json({ conversation }, { headers: { "Cache-Control": "private, no-store" } }) : Response.json({ error: "Conversation not found." }, { status: 404 }); } catch { return Response.json({ error: "Could not load this conversation. Please retry." }, { status: 503 }); }
}
export async function PATCH(request: Request, { params }: { params: Promise<{id:string}> }) {
  const session = await auth.getSession(); if (!session.data?.user) return Response.json({ error: "Sign in to save this conversation." }, { status: 401 });
  const id = (await params).id; if (!uuid.test(id)) return Response.json({ error: "Invalid conversation ID." }, { status: 400 });
  const body = await request.json().catch(() => null);
  if (!body || (body.annotation !== undefined && (typeof body.annotation !== "string" || body.annotation.length > 6000)) || (body.search !== undefined && typeof body.search !== "boolean") || (body.documentId !== undefined && body.documentId !== null && (typeof body.documentId !== "string" || !uuid.test(body.documentId)))) return Response.json({ error: "Invalid conversation settings. Notes may contain up to 6,000 characters." }, { status: 400 });
  try {
    if (body.documentId && !await getDocument(body.documentId)) return Response.json({ error: "This document was removed or is unavailable. Restore it or attach another file." }, { status: 404 });
    const patch: {annotation?:string;search?:boolean;documentId?:string|null} = {};
    if (body.annotation !== undefined) patch.annotation = body.annotation;
    if (body.search !== undefined) patch.search = body.search;
    if (body.documentId !== undefined) patch.documentId = body.documentId;
    const conversation = await editConversation(id,session.data.user.id,patch);
    return conversation ? Response.json({ conversation }) : Response.json({ error: "Conversation is unavailable or a response is still being prepared. Refresh and retry." }, { status: 409 });
  } catch { return Response.json({ error: "Could not save conversation settings. Please retry." }, { status: 503 }); }
}
