"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "../lib/auth/client";
import { readUploadResponse } from "../lib/upload-response";

const accepted = ".pdf,.jpg,.jpeg,.png,.heic,.xlsx,.xls,.csv,.docx";
export function UploadCard() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const input = useRef<HTMLInputElement>(null); const [status, setStatus] = useState("idle"); const [message, setMessage] = useState(""); const [reviewUrl, setReviewUrl] = useState<string | null>(null);
  async function upload(file: File) {
    if (!session?.user) { setStatus("error"); setMessage("Sign in before uploading a document."); return; }
    setStatus("uploading"); setMessage(`Uploading ${file.name}…`); setReviewUrl(null);
    try {
      const presign = await fetch("/api/documents/presign", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ filename: file.name, size: file.size, contentType: file.type || "application/octet-stream" }) });
      const payload = await readUploadResponse(presign, "Preparing upload");
      const form = new FormData(); form.set("file", file);
      const uploadResponse = await fetch(payload.uploadUrl, { method: "POST", body: form });
      await readUploadResponse(uploadResponse, "Saving document");
      setStatus("extracting"); setMessage("Reading the document and preparing fields for review…");
      const extraction = await fetch(payload.extractUrl, { method: "POST" }); const result = await readUploadResponse(extraction, "Reading document");
      const classified = await fetch(`/api/documents/${result.document.id}/classify`, { method: "POST" });
      const classifiedResult = await readUploadResponse(classified, "Classifying document");
      const url = `/review/${result.document.id}`;
      setStatus("done"); setReviewUrl(url); setMessage(`${classifiedResult.document.worksheet?.journals.length ?? 0} journal proposal(s) prepared. Open the accountant workpaper to review dates, amounts and accounts.`);
      return url;
    } catch (error) {
      setStatus("error"); setMessage(error instanceof Error ? error.message : "Upload failed. Please try again.");
    }
  }
  async function handleFiles(files: File[]) {
    if (status === "uploading" || status === "extracting") return;
    let last: string | undefined;
    for (const file of files) last = await upload(file);
    router.refresh();
    if (files.length === 1 && last) router.push(last);
  }
  return <div className="card section upload" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void handleFiles([...event.dataTransfer.files]); }}><div className="upload-icon">↑</div><h3>Bring in a document</h3><p>Drop a PDF, image, or spreadsheet here. Accentra will read it and show you what it found.</p><button className="button" onClick={() => input.current?.click()} disabled={isPending || !session?.user || status === "uploading" || status === "extracting"}>{status === "uploading" ? "Uploading…" : status === "extracting" ? "Reading…" : "Upload document"}</button><input ref={input} hidden multiple type="file" accept={accepted} onChange={(event) => { const files = [...(event.target.files ?? [])]; event.target.value = ""; if (files.length) void handleFiles(files); }} />{!isPending && !session?.user && <p><a href="/login">Sign in</a> to upload documents.</p>}{message && <p className={`upload-message ${status}`}>{message}</p>}{reviewUrl && <a className="link" href={reviewUrl}>Open review →</a>}</div>;
}
