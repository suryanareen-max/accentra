# Accentra AI

> Upload a financial document. AI reads it, classifies the entries, validates them, a human approves, and it posts to AutoCount Cloud. Then ask the books anything — grounded in MFRS and IFRS.

**Status:** Phase 0 foundation scaffold · plan v1.0 (20 Oct 2026)

---

## What it does

```
Upload / scan  →  Agent 1: Document Reader  →  Agent 2: Accounting Classifier
              →  Agent 3: Validation       →  Human review & approval
              →  Send to AutoCount (API)   →  Reconciliation → Advisory chat
```

- **Ingests** audit documents, financial statements, annual reports, invoices, receipts, payment vouchers and transaction proofs — as image, PDF or Excel.
- **Extracts** every financial field with a confidence score and a citation back to the exact page and coordinates.
- **Classifies** each entry against the client's live AutoCount chart of accounts, tax codes and party master.
- **Validates** against 15 deterministic blocking rules (Dr = Cr, SST arithmetic, duplicates, open period, account existence) plus an advisory LLM critic.
- **Never posts without a human.** Review and approval is a hard gate; the "Send to AutoCount" button is explicit.
- **Advises** the accountant and auditor through a chatbot that answers only from queries against the books, with clause-level MFRS / IFRS / ISA citations.

## The one architectural rule

Accentra is **not** a general ledger. AutoCount remains the system of record. Accentra owns ingestion, extraction, classification, validation, review, posting and analysis. This keeps the blast radius of an AI error small.

## Read the plan

**[→ ACCENTRA-AI-PLAN.md](./ACCENTRA-AI-PLAN.md)** — full build plan (24 sections + 4 appendices).

| Section | What's in it |
|---|---|
| [§2](./ACCENTRA-AI-PLAN.md#2-scope) | Scope and explicit non-goals |
| [§4](./ACCENTRA-AI-PLAN.md#4-the-core-flow-stage-by-stage) | The seven-stage flow, stage by stage |
| [§6](./ACCENTRA-AI-PLAN.md#6-agent-contracts) | The three agents — typed I/O contracts, prompting rules, cost |
| [§7](./ACCENTRA-AI-PLAN.md#7-human-review--approval) | Review screen, approval states, audit trail |
| [§8](./ACCENTRA-AI-PLAN.md#8-autocount-integration) | **AutoCount Cloud API** — verified auth, endpoints, posting protocol, error taxonomy |
| [§9](./ACCENTRA-AI-PLAN.md#9-the-chatbot-and-advisory-layer) | Chatbot tools, standards corpus, guardrails |
| [§10](./ACCENTRA-AI-PLAN.md#10-data-model-and-the-database-question) | **Database decision** + schema |
| [§11](./ACCENTRA-AI-PLAN.md#11-tech-stack) | Stack and why |
| [§12](./ACCENTRA-AI-PLAN.md#12-design-system--3d-clarity) | "3D clarity" design system + login interface |
| [§13](./ACCENTRA-AI-PLAN.md#13-ux-for-non-accountants) | UX for non-accountants |
| [§17](./ACCENTRA-AI-PLAN.md#17-roadmap) | 18-week roadmap in six phases |
| [§20](./ACCENTRA-AI-PLAN.md#20-decisions-needed-from-you) | **6 open decisions — Q1/Q2 are blocking** |

## Stack

`Next.js 15` · `TypeScript` · `Tailwind v4 + shadcn/ui` · `Postgres (Neon) + Drizzle + pgvector` · `Inngest` · `Cloudflare R2` · `Auth.js v5` · `Vercel AI SDK` · `Vercel`

## Blocking before Phase 0

1. Which AutoCount — Cloud Accounting API (`accounting-api.autocountcloud.com`) or Accounting 2.2 on-prem (`api.autocount.cloud` + Local Connector)?
2. A sandbox account book + API key, created in Cloud Accounting → Settings → API Keys.

## Run locally

```bash
pnpm install
pnpm dev
```

The first runnable slice lives in `apps/web`: an Accentra dashboard with the review queue, upload entry point, book-health summary, and `/api/health` liveness route. It uses representative data until the database, authentication, storage, job runner, and AutoCount sandbox credentials are connected.

### Connect Neon Postgres

1. Copy the pooled connection string from your Neon project.
2. Copy the Neon Auth URL from your Neon project.
3. Create `apps/web/.env.local` with `DATABASE_URL="<your pooled connection string>"`, `NEON_AUTH_BASE_URL="<your Neon Auth URL>"`, and `NEXT_PUBLIC_NEON_AUTH_URL="<your Neon Auth URL>"`. Generate a private 32-character-or-longer `NEON_AUTH_COOKIE_SECRET` and keep the file out of Git.
4. From the repository root, run `pnpm --filter web db:migrate` to create the tables in `apps/web/lib/db/schema.ts`.
5. Start the app and open `/api/health/database`; a successful response has `{"status":"ok","database":"neon"}`.

The database client is in `apps/web/lib/db`. Update the schema there, then run `pnpm --filter web db:generate` followed by `pnpm --filter web db:migrate` to apply schema changes. Neon Auth handles sign-in and sessions through the Neon Auth URL; its server routes are protected and send unauthenticated users to `/login`.

---

*Plan authored 20 Oct 2026. Supersede by editing `ACCENTRA-AI-PLAN.md` and bumping the version in its header.*

### DeepSeek document analysis

Set `DEEPSEEK_API_KEY` as an encrypted server environment variable and `DEEPSEEK_MODEL=deepseek-flash` in Vercel (and in `apps/web/.env.local` for development), then redeploy. Never use a `NEXT_PUBLIC_` prefix for the key.

On a document review, use **Analyse with DeepSeek**. The analyst receives extracted source text with page labels, saved journal proposals, arithmetic checks and unresolved validation issues. Chat attachments are uploaded, extracted and analysed automatically; follow-up questions retain that document context. Text-based PDF, Excel, CSV and Word `.docx` files are supported by extraction. Images/scanned PDFs require OCR; missing text returns an actionable error instead of invented findings.

The default standards search calls DeepSeek's `/v1/tools/search` with generic accounting topics only. Retrieved references are restricted to IFRS, MASB and MIA HTTPS domains and shown beside the answer. Search outages are disclosed; guidance is advisory and does not imply access to the full standards corpus. Disable the search checkbox to analyse document evidence without a web lookup. Source text and the conversation are sent to DeepSeek; private names and document text are never sent as public search queries.

The analyst is read-only: it cannot save, confirm, approve or send entries. Use the accountant workpaper to review and save changes; existing validation and approval requirements still control AutoCount posting. Provider authentication, balance, timeout and rate-limit failures are reported explicitly.

### Workpaper list and chat recovery

The dashboard list has numbered pages and 10/20/50 documents per page. The delete icon moves a document to Trash, with Undo and a persistent Trash/Restore view. This does not remove source storage, review history or AutoCount postings. Trashed documents are excluded from active document APIs, source analysis, workpapers and validation until restored.

Read-only chat requests retry one interrupted network connection. Questions and selected documents remain available after a failed request. Session expiry returns a sign-in action rather than a raw fetch error. Greetings use a short DeepSeek call without querying the full document register or public standards search.

### OCR, annotations and saved conversations

Scanned PDF pages and image uploads now use DeepSeek Flash vision for AI OCR. Text-rich PDF pages retain native extraction; sparse/scanned pages are rendered server-side and transcribed in batches of at most two pages per request. Completed pages are retained if a later batch fails. OCR values must be compared with the original before approving journal entries. HEIC images that cannot be decoded must be converted to PNG/JPEG.

In Ask Accentra, attaching a file saves it without immediately starting analysis. Preview the original, add reviewer notes, and use **Save notes**, **Read / OCR**, or **Analyse document**. Reading/OCR lets you inspect the transcription first. Annotations remain separate from source evidence and are captured with each saved question. Existing reviewed workpapers are not replaced by simply reading an attachment.

The `chat_conversations` migration stores conversations in Neon under the authenticated user's ID. **New chat**, **History**, and title search let users reopen the most recent 100 conversations. Questions, answers, selected document, annotations and search settings survive refreshes. Concurrent requests are guarded and completed request IDs are cached to avoid duplicating saved answers during connection recovery. Older chats created before this feature cannot be recovered because they previously existed only in browser memory.

The dashboard shows summary cards before documents. Its former Workspace records box is replaced by a bottom-right **Ask Accentra** popup, sharing the same saved conversations as `/chat`.

Apply schema changes with `pnpm --dir apps/web db:migrate` before deploying this version.
