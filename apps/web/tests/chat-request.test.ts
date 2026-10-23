import test from "node:test";
import assert from "node:assert/strict";
import { requestChat, ChatRequestError } from "../lib/chat-request";
const input = { message: "hi", mode: "books" as const, search: false };
const answer = { answer: "Hello!", provider: "DeepSeek", model: "deepseek-flash", searchStatus: "disabled", warnings: [], citations: [] };
test("chat retries an interrupted read-only request once with the same question and credentials", async () => {
  const previous = global.fetch; let calls = 0; let retries = 0;
  try {
    global.fetch = (async (url, options) => { calls++; assert.equal(url, "/api/chat"); assert.equal(options?.credentials, "same-origin"); assert.deepEqual(JSON.parse(String(options?.body)), input); if (calls === 1) throw new TypeError("Failed to fetch"); return Response.json(answer); }) as typeof fetch;
    assert.deepEqual(await requestChat(input, () => retries++), answer); assert.equal(calls, 2); assert.equal(retries, 1);
  } finally { global.fetch = previous; }
});
test("chat surfaces actionable connection/session failures without retrying authentication or API errors", async () => {
  const previous = global.fetch;
  try {
    let calls = 0; global.fetch = (async () => { calls++; throw new TypeError("Failed to fetch"); }) as typeof fetch;
    await assert.rejects(requestChat(input), /Connection interrupted.*question and attached document have been kept/); assert.equal(calls, 2);
    calls = 0; global.fetch = (async () => { calls++; return Response.json({ error: "expired" }, { status: 401 }); }) as typeof fetch;
    await assert.rejects(requestChat(input), (error: unknown) => error instanceof ChatRequestError && error.signInRequired); assert.equal(calls, 1);
    global.fetch = (async () => Response.json({ error: "DeepSeek balance is insufficient" }, { status: 502 })) as typeof fetch;
    await assert.rejects(requestChat(input), /balance is insufficient/);
    global.fetch = (async () => new Response("<html>Gateway</html>", { status: 504, headers: { "content-type": "text/html", "x-vercel-id": "request-reference" } })) as typeof fetch;
    await assert.rejects(requestChat(input), /HTTP 504.*request-reference/);
    global.fetch = (async () => Response.json({ answer: "" })) as typeof fetch;
    await assert.rejects(requestChat(input), /no answer/);
  } finally { global.fetch = previous; }
});
