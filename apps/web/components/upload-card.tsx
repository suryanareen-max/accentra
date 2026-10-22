"use client";

import { useRef, useState } from "react";

const accepted = ".pdf,.jpg,.jpeg,.png,.heic,.xlsx,.xls,.csv";
export function UploadCard() {
  const input = useRef<HTMLInputElement>(null); const [status, setStatus] = useState("idle"); const [message, setMessage] = useState(""); const [reviewUrl, setReviewUrl] = useState<string | null>(null);
  async function upload(file: File) {
    setStatus("uploading"); setMessage(`Uploading ${file.name}…`); setReviewUrl(null);
    try {
      const presign = await fetch("/api/documents/presign", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ filename: file.name, size: file.size, contentType: file.type || "application/octet-stream" }) });
      const payload = await presign.json(); if (!presign.ok) throw new Error(payload.error ?? "Could not prepare the upload.");
      const form = new FormData(); form.set("file", file);
      const uploadResponse = await fetch(payload.uploadUrl, { method: "POST", body: form });
      const uploadResult = await uploadResponse.json().catch(() => null);
      if (!uploadResponse.ok) throw new Error(uploadResult?.error ?? "Upload failed. Please try again.");
      setStatus("extracting"); setMessage("Reading the document and preparing fields for review…");
      const extraction = await fetch(payload.extractUrl, { method: "POST" }); const result = await extraction.json();
      if (!extraction.ok) throw new Error(result.document?.error ?? "Extraction failed.");
      const classified = await fetch(`/api/documents/${result.document.id}/classify`, { method: "POST" });
      const classifiedResult = await classified.json();
      if (!classified.ok) throw new Error(classifiedResult.error ?? "Classification failed.");
      setStatus("done"); setReviewUrl(`/review/${result.document.id}`); setMessage(`Ready for review · ${classifiedResult.document.extracted?.doc_family ?? "document"} · review findings prepared`);
    } catch (error) {
      setStatus("error"); setMessage(error instanceof Error ? error.message : "Upload failed. Please try again.");
    }
  }
  return <div className="card section upload"><div className="upload-icon">↑</div><h3>Bring in a document</h3><p>Drop a PDF, image, or spreadsheet here. Accentra will read it and show you what it found.</p><button className="button" onClick={() => input.current?.click()} disabled={status === "uploading" || status === "extracting"}>{status === "uploading" ? "Uploading…" : status === "extracting" ? "Reading…" : "Upload document"}</button><input ref={input} hidden multiple type="file" accept={accepted} onChange={(event) => { const files = [...(event.target.files ?? [])]; event.target.value = ""; if (files.length) void (async () => { for (const file of files) await upload(file); })(); }} />{message && <p className={`upload-message ${status}`}>{message}</p>}{reviewUrl && <a className="link" href={reviewUrl}>Open review →</a>}</div>;
}
