export async function readUploadResponse(response: Response, stage: string) {
  if (response.status === 401 || response.redirected || response.url.includes("/login")) {
    throw new Error("Your session expired. Sign in again, then retry the upload.");
  }
  const contentType = response.headers.get("content-type") ?? "";
  const requestId = response.headers.get("x-vercel-id");
  const reference = requestId ? ` Reference: ${requestId}.` : "";
  if (!contentType.includes("application/json")) {
    throw new Error(`${stage} failed (HTTP ${response.status}).${response.status === 413 ? " The file exceeds the server upload limit." : " The server did not return JSON."}${reference}`);
  }
  const payload = await response.json();
  if (!response.ok) throw new Error(`${stage}: ${payload.error ?? payload.document?.error ?? `HTTP ${response.status}`}${reference}`);
  return payload;
}
