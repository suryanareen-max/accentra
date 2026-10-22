import { randomUUID } from "node:crypto";
import type { ClassifiedTransaction } from "./contracts";

type Posted = { docNo: string; endpoint: string; payload: unknown; location: string; idempotencyKey: string };
const posted = new Map<string, Posted>();

export async function postToAutoCount(endpoint: string, payload: ClassifiedTransaction, idempotencyKey: string) {
  const existing = [...posted.values()].find((item) => item.idempotencyKey === idempotencyKey);
  if (existing) return existing;
  const baseUrl = (process.env.AUTCOUNT_API_BASE_URL ?? "https://accounting-api.autocountcloud.com/1").replace(/\/$/, "");
  const apiKey = process.env.AUTCOUNT_API_KEY;
  const keyId = process.env.AUTCOUNT_KEY_ID;
  if (apiKey) {
<<<<<<< HEAD
    const authHeaders = keyId ? { "API-Key": apiKey, "Key-ID": keyId } : { authorization: `Bearer ${apiKey}` };
=======
    const authHeaders: Record<string, string> = keyId ? { "API-Key": apiKey, "Key-ID": keyId } : { authorization: `Bearer ${apiKey}` };
>>>>>>> d8656a8 (Configure AutoCount key ID authentication)
    const response = await fetch(`${baseUrl}/${endpoint}`, { method: "POST", headers: { ...authHeaders, "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify(payload) });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.message ?? `AutoCount returned HTTP ${response.status}`);
    const docNo = String(body?.documentNo ?? body?.docNo ?? body?.id ?? `ACC-${new Date().getFullYear()}-${String(posted.size + 1).padStart(5, "0")}`);
    const result = { docNo, endpoint, payload, idempotencyKey, location: body?.locationUrl ?? `${baseUrl}/${endpoint}/${docNo}` };
    posted.set(docNo, result); return result;
  }
  const docNo = `ACC-${new Date().getFullYear()}-${String(posted.size + 1).padStart(5, "0")}`;
  const result = { docNo, endpoint, payload, idempotencyKey, location: `mock://autocount/1/${endpoint}?docNo=${docNo}` };
  posted.set(docNo, result); return result;
}

export async function getFromAutoCount(docNo: string) { return posted.get(docNo) ?? null; }
export function adapterStatus() { return { adapter: process.env.AUTCOUNT_API_KEY && process.env.AUTCOUNT_KEY_ID ? "autocount-cloud" : "mock-autocount-cloud", accountBookId: process.env.AUTCOUNT_ACCOUNT_BOOK_ID ?? "demo-book", credentialsConfigured: Boolean(process.env.AUTCOUNT_API_KEY && process.env.AUTCOUNT_KEY_ID), postedCount: posted.size }; }
export function makeIdempotencyKey(documentId: string, contentHash: string) { return `ACC:${documentId}:${contentHash.slice(0, 16) || randomUUID()}`; }
