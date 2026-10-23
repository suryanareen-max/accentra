import { auth } from "../../../lib/auth/server";
import { createConversation, listConversations } from "../../../lib/conversation-store";
export const dynamic = "force-dynamic";
export async function GET() {
  const session = await auth.getSession(); if (!session.data?.user) return Response.json({ error: "Sign in to view conversations." }, { status: 401 });
  try { return Response.json({ conversations: await listConversations(session.data.user.id) }, { headers: { "Cache-Control": "private, no-store" } }); } catch { return Response.json({ error: "Conversation history is unavailable. Please retry." }, { status: 503 }); }
}
export async function POST() {
  const session = await auth.getSession(); if (!session.data?.user) return Response.json({ error: "Sign in to create a conversation." }, { status: 401 });
  try { return Response.json({ conversation: await createConversation(session.data.user.id) }, { status: 201 }); } catch { return Response.json({ error: "Could not save a new conversation. Please retry." }, { status: 503 }); }
}
