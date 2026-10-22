import { createHash } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { DocumentRecord, SupportedMime } from "./contracts";
import { accountBooks, documents, tenants } from "./db/schema";
import { getDb } from "./db";
import { readDocumentFile as readStoredDocumentFile, saveDocumentFile as saveStoredDocumentFile } from "./storage";

type DocumentMetadata = Pick<DocumentRecord, "extracted" | "classified" | "validation" | "error">;

async function getDemoTenantId() {
  const db = getDb();
  const slug = "accentra-demo";
  const existing = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, slug)).limit(1);
  if (existing[0]) return existing[0].id;

  const created = await db.insert(tenants).values({ name: "Accentra Demo", slug }).onConflictDoNothing().returning({ id: tenants.id });
  if (created[0]) return created[0].id;

  const concurrentCreate = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, slug)).limit(1);
  if (concurrentCreate[0]) return concurrentCreate[0].id;
  throw new Error("Could not initialize the Accentra demo workspace.");
}

function toRecord(row: typeof documents.$inferSelect): DocumentRecord {
  const metadata = (row.extractedData ?? {}) as DocumentMetadata;
  return {
    id: row.id,
    filename: row.filename,
    contentType: row.mime as SupportedMime,
    size: row.bytes,
    contentHash: row.sha256 ?? "pending",
    state: row.status as DocumentRecord["state"],
    createdAt: row.createdAt.toISOString(),
    ...metadata,
  };
}

export async function createDocument(input: Omit<DocumentRecord, "state" | "createdAt">) {
  const db = getDb();
  const tenantId = await getDemoTenantId();
  const [row] = await db.insert(documents).values({
    id: input.id,
    tenantId,
    filename: input.filename,
    mime: input.contentType,
    bytes: input.size,
    sha256: input.contentHash,
    storageKey: input.id,
    source: "UPLOAD",
    status: "UPLOADED",
    extractedData: {
      extracted: input.extracted,
      classified: input.classified,
      validation: input.validation,
      error: input.error,
    },
  }).returning();
  return toRecord(row);
}

export async function getDocument(id: string) {
  const [row] = await getDb().select().from(documents).where(eq(documents.id, id)).limit(1);
  return row ? toRecord(row) : undefined;
}

export async function updateDocument(id: string, patch: Partial<DocumentRecord>) {
  const current = await getDocument(id);
  if (!current) return undefined;
  const next = { ...current, ...patch };
  const [row] = await getDb().update(documents).set({
    filename: next.filename,
    mime: next.contentType,
    bytes: next.size,
    sha256: next.contentHash,
    status: next.state,
    extractedData: {
      extracted: next.extracted,
      classified: next.classified,
      validation: next.validation,
      error: next.error,
    },
  }).where(eq(documents.id, id)).returning();
  return row ? toRecord(row) : undefined;
}

export async function saveDocumentFile(id: string, bytes: Uint8Array, contentType?: string) {
  return saveStoredDocumentFile(id, bytes, contentType);
}

export async function readDocumentFile(id: string) { return readStoredDocumentFile(id); }
export function contentHash(bytes: Uint8Array) { return createHash("sha256").update(bytes).digest("hex"); }

export async function listDocuments() {
  const rows = await getDb().select().from(documents).orderBy(desc(documents.createdAt));
  return rows.map(toRecord);
}

export async function listAccountBooks() {
  const db = getDb();
  const tenantId = await getDemoTenantId();
  return db.select().from(accountBooks).where(eq(accountBooks.tenantId, tenantId));
}
