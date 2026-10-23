import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import { chatConversations } from "./db/schema";
import type { SavedConversation, SavedChatMessage } from "./chat-contracts";
function record(row: typeof chatConversations.$inferSelect): SavedConversation { return { id: row.id, title: row.title, documentId: row.documentId, annotation: row.annotation, search: row.search, messages: row.messages as SavedChatMessage[], pendingRequestId: row.pendingRequestId, pendingSince: row.pendingSince?.toISOString() ?? null, updatedAt: row.updatedAt.toISOString(), createdAt: row.createdAt.toISOString() }; }
export async function listConversations(ownerId: string) {
  return getDb().select({ id: chatConversations.id, title: chatConversations.title, documentId: chatConversations.documentId, updatedAt: chatConversations.updatedAt }).from(chatConversations).where(eq(chatConversations.ownerId, ownerId)).orderBy(desc(chatConversations.updatedAt)).limit(100);
}
export async function getConversation(id: string, ownerId: string) {
  const [row] = await getDb().select().from(chatConversations).where(and(eq(chatConversations.id,id),eq(chatConversations.ownerId,ownerId))).limit(1); return row ? record(row) : undefined;
}
export async function createConversation(ownerId: string) {
  const [row] = await getDb().insert(chatConversations).values({ ownerId }).returning(); return record(row);
}
export async function editConversation(id: string, ownerId: string, patch: { documentId?: string | null; annotation?: string; search?: boolean }) {
  const [row] = await getDb().update(chatConversations).set({ ...patch, pendingRequestId: null, pendingSince: null, updatedAt: new Date() }).where(and(eq(chatConversations.id,id),eq(chatConversations.ownerId,ownerId),or(isNull(chatConversations.pendingRequestId),lt(chatConversations.pendingSince,new Date(Date.now()-120000))))).returning(); return row ? record(row) : undefined;
}
export async function claimConversation(id: string, ownerId: string, requestId: string, question: string, annotation: string, documentId: string | null, initialTitle = question) {
  const message: SavedChatMessage = { id: randomUUID(), role: "user", text: question, requestId, annotation, documentId, createdAt: new Date().toISOString() };
  const [row] = await getDb().update(chatConversations).set({ pendingRequestId: requestId, pendingSince: new Date(), updatedAt: new Date(), title: sql`case when ${chatConversations.title} = 'New chat' then ${initialTitle.slice(0,90)} else ${chatConversations.title} end`, messages: sql`${chatConversations.messages} || ${JSON.stringify([message])}::jsonb` }).where(and(eq(chatConversations.id,id),eq(chatConversations.ownerId,ownerId),or(isNull(chatConversations.pendingRequestId),lt(chatConversations.pendingSince,new Date(Date.now()-120000))))).returning();
  return row ? record(row) : undefined;
}
export async function finishConversation(id: string, ownerId: string, requestId: string, message: Omit<SavedChatMessage,"id"|"createdAt"|"requestId">) {
  const saved: SavedChatMessage = { ...message, id: randomUUID(), requestId, createdAt: new Date().toISOString() };
  const [row] = await getDb().update(chatConversations).set({ messages: sql`${chatConversations.messages} || ${JSON.stringify([saved])}::jsonb`, pendingRequestId: null, pendingSince: null, updatedAt: new Date() }).where(and(eq(chatConversations.id,id),eq(chatConversations.ownerId,ownerId),eq(chatConversations.pendingRequestId,requestId))).returning();
  return row ? record(row) : undefined;
}
