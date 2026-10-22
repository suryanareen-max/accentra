import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: text("plan").notNull().default("free"),
  createdAt: createdAt(),
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("reviewer"),
  passwordHash: text("password_hash"),
  mfaSecret: text("mfa_secret"),
  active: boolean("active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (table) => [index("users_tenant_id_idx").on(table.tenantId), index("users_email_idx").on(table.email)]);

export const accountBooks = pgTable("account_books", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  autocountAccountBookId: text("autocount_account_book_id").notNull(),
  name: text("name").notNull(),
  currency: text("currency").notNull().default("MYR"),
  keyStatus: text("key_status").notNull().default("not_configured"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (table) => [index("account_books_tenant_id_idx").on(table.tenantId)]);

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  accountBookId: uuid("account_book_id").references(() => accountBooks.id, { onDelete: "set null" }),
  storageKey: text("storage_key").notNull(),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  bytes: integer("bytes").notNull(),
  sha256: text("sha256"),
  pages: integer("pages"),
  source: text("source").notNull().default("UPLOAD"),
  status: text("status").notNull().default("UPLOADED"),
  extractedData: jsonb("extracted_data"),
  uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
}, (table) => [index("documents_tenant_id_idx").on(table.tenantId), index("documents_status_idx").on(table.status)]);

export const reviews = pgTable("reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }).unique(),
  status: text("status").notNull().default("IN_REVIEW"),
  edits: jsonb("edits").notNull().default([]),
  reason: text("reason"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: createdAt(),
}, (table) => [index("reviews_tenant_id_idx").on(table.tenantId)]);

export const postings = pgTable("postings", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
  status: text("status").notNull().default("QUEUED"),
  payload: jsonb("payload").notNull(),
  externalReference: text("external_reference"),
  lastError: text("last_error"),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("postings_tenant_id_idx").on(table.tenantId), index("postings_status_idx").on(table.status)]);

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
  reason: text("reason"),
  previousHash: text("previous_hash").notNull(),
  hash: text("hash").notNull(),
  createdAt: createdAt(),
}, (table) => [index("audit_events_tenant_id_idx").on(table.tenantId), index("audit_events_entity_idx").on(table.entity, table.entityId)]);

export const schema = { tenants, users, accountBooks, documents, reviews, postings, auditEvents };
