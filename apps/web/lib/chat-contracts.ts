import type { AnalysisResult } from "./deepseek";
export type SavedChatMessage = { id: string; role: "user" | "assistant" | "system"; text: string; createdAt: string; requestId: string; result?: AnalysisResult; annotation?: string; documentId?: string | null };
export type SavedConversation = { id: string; title: string; documentId: string | null; annotation: string; search: boolean; messages: SavedChatMessage[]; pendingRequestId: string | null; pendingSince: string | null; updatedAt: string; createdAt: string };
export type ConversationSummary = Pick<SavedConversation, "id" | "title" | "updatedAt" | "documentId">;
