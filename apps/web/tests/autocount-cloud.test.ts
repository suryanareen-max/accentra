import assert from "node:assert/strict";
import { test } from "node:test";
import { cloudStatus, fetchCloudAccounts, sendCloudJournal } from "../lib/autocount-cloud";
import { blankJournal } from "../lib/accounting-worksheet";

test("a missing API secret or account book cannot be treated as a connected mock adapter", () => {
  const saved = { key: process.env.AUTCOUNT_API_KEY, id: process.env.AUTCOUNT_KEY_ID, book: process.env.AUTCOUNT_ACCOUNT_BOOK_ID };
  delete process.env.AUTCOUNT_API_KEY; delete process.env.AUTCOUNT_KEY_ID; delete process.env.AUTCOUNT_ACCOUNT_BOOK_ID;
  try { assert.equal(cloudStatus().configured, false); assert.deepEqual(cloudStatus().missing, ["AUTCOUNT_API_KEY", "AUTCOUNT_KEY_ID", "AUTCOUNT_ACCOUNT_BOOK_ID"]); }
  finally { for (const [name, value] of [["AUTCOUNT_API_KEY", saved.key], ["AUTCOUNT_KEY_ID", saved.id], ["AUTCOUNT_ACCOUNT_BOOK_ID", saved.book]]) { if (value === undefined) delete process.env[name!]; else process.env[name!] = value; } }
});

test("AutoCount uses the configured destination book and mandatory headers, with a real read-back after empty 201", async () => {
  const originalFetch = global.fetch;
  const names = ["AUTCOUNT_API_KEY", "AUTCOUNT_KEY_ID", "AUTCOUNT_ACCOUNT_BOOK_ID", "AUTCOUNT_API_BASE_URL"];
  const originalEnv = names.map((n) => process.env[n]);
  process.env.AUTCOUNT_API_KEY = "unit-test-secret"; process.env.AUTCOUNT_KEY_ID = "unit-test-key-id"; process.env.AUTCOUNT_ACCOUNT_BOOK_ID = "42"; process.env.AUTCOUNT_API_BASE_URL = "https://accounting-api.autocountcloud.com/1";
  const calls: string[] = [];
  let savedPayload: Record<string, unknown> | undefined;
  global.fetch = (async (url: string | URL | Request, options?: RequestInit) => {
    const target = String(url); calls.push(target);
    const headers = options?.headers as Record<string, string>;
    assert.equal(headers["API-Key"], "unit-test-secret"); assert.equal(headers["Key-ID"], "unit-test-key-id");
    assert.ok(target.startsWith("https://accounting-api.autocountcloud.com/42/"));
    if (target.includes("account/listing")) return Response.json({ data: [{ AccNo: "910-0000", Description: "Stationery", CurrencyCode: "MYR", SpecialAccType: "SN" }], totalCount: 1 });
    if (options?.method === "POST") { savedPayload = JSON.parse(String(options.body)); return new Response(null, { status: 201, headers: { location: "https://accounting-api.autocountcloud.com/42/journalEntry?docNo=JV-REAL-900" } }); }
    return Response.json(savedPayload);
  }) as typeof fetch;
  try {
    const accounts = await fetchCloudAccounts(); assert.equal(accounts[0].code, "910-0000");
    const j = blankJournal("unit-test"); Object.assign(j, { reference: "SOURCE-900", date: "2026-01-15", amount: 100, description: "Stationery purchase", treatment: "Expense consumed office supplies in the relevant period.", taxTreatment: "no_tax_in_source", confirmed: true });
    j.lines = [{ accountCode: "910-0000", accountName: "Stationery", description: "Paper", debit: 100, credit: 0, taxCode: "", department: "" }, { accountCode: "320-0000", accountName: "Cash", description: "Payment", debit: 0, credit: 100, taxCode: "", department: "" }];
    const result = await sendCloudJournal(j, "12345678-1234-1234-1234-123456789012");
    assert.equal(result.docNo, "JV-REAL-900"); assert.equal(result.reconciled, true);
    assert.ok(calls.at(-1)?.includes("docNo=JV-REAL-900"));
    assert.ok(savedPayload?.master); assert.ok(savedPayload?.details);
  } finally {
    global.fetch = originalFetch;
    names.forEach((n, i) => { if (originalEnv[i] === undefined) delete process.env[n]; else process.env[n] = originalEnv[i]; });
  }
});

test("the documented AUTCOUNT_API_URL alias targets the configured account book", async () => {
  const originalFetch = global.fetch;
  const names = ["AUTCOUNT_API_KEY", "AUTCOUNT_KEY_ID", "AUTCOUNT_ACCOUNT_BOOK_ID", "AUTCOUNT_API_BASE_URL", "AUTCOUNT_API_URL"];
  const originalEnv = names.map((n) => process.env[n]);
  process.env.AUTCOUNT_API_KEY = "unit-test-secret";
  process.env.AUTCOUNT_KEY_ID = "unit-test-key-id";
  process.env.AUTCOUNT_ACCOUNT_BOOK_ID = "74400";
  delete process.env.AUTCOUNT_API_BASE_URL;
  process.env.AUTCOUNT_API_URL = "https://accounting-api.autocountcloud.com/1";
  let requestedUrl = "";
  global.fetch = (async (url: string | URL | Request) => {
    requestedUrl = String(url);
    return Response.json({ data: [], totalCount: 0 });
  }) as typeof fetch;
  try {
    await fetchCloudAccounts();
    assert.ok(requestedUrl.startsWith("https://accounting-api.autocountcloud.com/74400/"));
  } finally {
    global.fetch = originalFetch;
    names.forEach((n, i) => { if (originalEnv[i] === undefined) delete process.env[n]; else process.env[n] = originalEnv[i]; });
  }
});
