import type { AnalysisResult, ConversationTurn } from "./deepseek";
export class ChatRequestError extends Error {
  constructor(message: string, public signInRequired = false) { super(message); }
}
type ChatInput = { message: string; mode: "books" | "document" | "standards"; documentId?: string; history?: ConversationTurn[]; search: boolean };
// Chat analysis is read-only. Retry an interrupted connection once; never retry a posting/upload here.
export async function requestChat(input: ChatInput, onRetry?: () => void): Promise<AnalysisResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 65000);
    try {
      const response = await fetch("/api/chat", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(input), signal: controller.signal });
      if (response.status === 401 || response.redirected) throw new ChatRequestError("Your session expired. Sign in again, then resend your question. Your question has been kept.", true);
      const reference = response.headers.get("x-vercel-id");
      if (!response.headers.get("content-type")?.includes("application/json")) throw new ChatRequestError(`The chat server returned an unexpected response (HTTP ${response.status}). Please retry.${reference ? ` Reference: ${reference}.` : ""}`);
      const result = await response.json();
      if (!response.ok) throw new ChatRequestError(typeof result.error === "string" ? result.error : `Analysis failed (HTTP ${response.status}). Please retry.`);
      if (typeof result.answer !== "string" || !result.answer.trim()) throw new ChatRequestError("The chat server returned no answer. Please retry your question.");
      return result as AnalysisResult;
    } catch (error) {
      if (error instanceof ChatRequestError) throw error;
      if (controller.signal.aborted) throw new ChatRequestError("The analysis took too long. Your question has been kept; retry with a specific document or transaction.");
      if (attempt === 0) { onRetry?.(); continue; }
      throw new ChatRequestError("Connection interrupted. Check your internet connection and retry. Your question and attached document have been kept.");
    } finally { clearTimeout(timer); }
  }
  throw new ChatRequestError("Analysis could not be completed. Please retry.");
}
