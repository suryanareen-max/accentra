import { makeJournalPayload, matchesPostedJournal } from "./autocount-payload";
import type { JournalDraft } from "./contracts";

export type CloudAccount = { code: string; name: string; currency: string; specialType: string };

export function cloudStatus() {
  const missing = ["AUTCOUNT_API_KEY", "AUTCOUNT_KEY_ID", "AUTCOUNT_ACCOUNT_BOOK_ID"].filter((key) => !process.env[key]);
  return { configured: !missing.length, missing, accountBookId: process.env.AUTCOUNT_ACCOUNT_BOOK_ID || "", mode: "live" as const };
}

function connection() {
  const status = cloudStatus();
  if (!status.configured) throw new Error(`AutoCount is not connected. Add ${status.missing.join(", ")} in Vercel. No accounting entry has been sent.`);
  // Keep compatibility with the earlier documented AUTCOUNT_API_URL name.
  // Both values may contain an account-book path; the configured book ID is
  // always appended below so the request cannot silently target another book.
  const root = (process.env.AUTCOUNT_API_BASE_URL || process.env.AUTCOUNT_API_URL || "https://accounting-api.autocountcloud.com").trim().replace(/\/$/, "").replace(/\/\d+$/, "");
  return { base: `${root}/${encodeURIComponent(status.accountBookId)}`, headers: { "API-Key": process.env.AUTCOUNT_API_KEY!, "Key-ID": process.env.AUTCOUNT_KEY_ID!, "content-type": "application/json" } };
}

export async function fetchCloudAccounts(): Promise<CloudAccount[]> {
  const { base, headers } = connection();
  const result: CloudAccount[] = [];
  for (let page = 1; page <= 100; page++) {
    const response = await fetch(`${base}/account/listing?page=${page}&leafOnly=true&field=accType&field=specialAccType&field=currencyCode`, { method: "POST", headers, body: "{}", cache: "no-store", signal: AbortSignal.timeout(20000) });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.message || `AutoCount account sync returned HTTP ${response.status}.`);
    if (!Array.isArray(body?.data)) throw new Error("AutoCount account listing returned an unexpected response.");
    for (const a of body.data) result.push({ code: String(a.AccNo || a.accNo || ""), name: String(a.Description || a.description || ""), currency: String(a.CurrencyCode || a.currencyCode || "MYR"), specialType: String(a.SpecialAccType || a.specialAccType || "") });
    if (body.data.length < 100 || result.length >= Number(body.totalCount || Infinity)) return result;
  }
  throw new Error("The account listing exceeds the sync limit. Refine the account book before posting.");
}

export async function sendCloudJournal(j: JournalDraft, documentId: string) {
  const { base, headers } = connection();
  const payload = makeJournalPayload(j, documentId);
  payload.master.journalType = process.env.AUTCOUNT_JOURNAL_TYPE || "GENERAL";
  const response = await fetch(`${base}/journalEntry`, { method: "POST", headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(30000) });
  // AutoCount's documented 201 response has no JSON body. Its Location header
  // identifies the real saved record; never fabricate an AutoCount document ID.
  if (response.status !== 201) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || `AutoCount journal creation returned HTTP ${response.status}. Check the source reference before retrying.`);
  }
  const location = response.headers.get("location");
  const docNo = location ? new URL(location, `${base}/`).searchParams.get("docNo") || payload.master.docNo : payload.master.docNo;
  const locationUrl = `${base}/journalEntry?docNo=${encodeURIComponent(docNo)}`;
  try {
    const verified = await verifyCloudJournal(payload, docNo);
    return { ...verified, payload };
  } catch (error) {
    // The create already returned 201. Preserve its AutoCount reference and
    // let the user safely re-run read-only verification without resubmitting.
    return { docNo, location: locationUrl, payload, response: null, reconciled: false, verificationError: error instanceof Error ? error.message : "AutoCount saved the journal, but read-back failed." };
  }
}

export async function verifyCloudJournal(expected: ReturnType<typeof makeJournalPayload>, docNo: string) {
  const { base, headers } = connection();
  const response = await fetch(`${base}/journalEntry?docNo=${encodeURIComponent(docNo)}`, { headers, cache: "no-store", signal: AbortSignal.timeout(20000) });
  const actual = await response.json().catch(() => null);
  if (!response.ok) throw new Error(actual?.message || `AutoCount read-back returned HTTP ${response.status}.`);
  return { docNo, location: `${base}/journalEntry?docNo=${encodeURIComponent(docNo)}`, response: actual, reconciled: Boolean(actual && matchesPostedJournal(expected, actual)) };
}
