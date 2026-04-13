# Welth — AI-Powered Personal Finance Platform

[![CI](https://github.com/YOUR_USERNAME/welth-upgraded/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/welth-upgraded/actions/workflows/ci.yml)

A production-grade personal finance management platform built with Next.js 15, demonstrating advanced full-stack engineering patterns used at top product companies.

**Live demo:** [welth-seven-vert.vercel.app](https://welth-seven-vert.vercel.app)

---

## Architecture highlights

- **Cursor-based pagination** on the transaction feed — replaces unbounded `findMany` with O(log n) index scans using the `(userId, type, date DESC)` composite index
- **Idempotency keys** on all financial mutations — client generates a UUID per form session, server deduplicates on `findUnique({ idempotencyKey })` before inserting, preventing double-transactions on network retries
- **ACID-compliant balance updates** — every transaction create/update/delete uses `db.$transaction()` to atomically update both the transaction row and account balance, preventing balance corruption under concurrent writes
- **Tag-based cache invalidation** — dashboard and account data cached via `unstable_cache` with per-user tags; any mutation calls `revalidateTag` on exactly the affected tags for instant freshness
- **Event-driven background jobs** — Inngest processes recurring transactions via daily cron with per-user throttling (10 events/min), sends AI-generated monthly reports via Resend, and fires budget alerts every 6 hours
- **AI receipt OCR** — Gemini 2.5 Flash extracts structured JSON from receipt images; image uploaded to Supabase Storage in parallel with the AI call; `receiptUrl` persisted on the transaction row
- **Per-category budgets** — users can set individual monthly budgets per expense category alongside a global budget; progress tracked in real time against current-month spending
- **CSV export** — server-side streaming export of filtered transactions to a downloadable `.csv` file
- **Structured error hierarchy** — typed `AppError` subclasses (Unauthorized, NotFound, Validation, RateLimit) with Prisma error code mapping; all logged via structured JSON logger

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, Server Actions) |
| Database | PostgreSQL via Prisma ORM (Supabase) |
| Auth | Clerk |
| Background jobs | Inngest |
| AI | Google Gemini 2.5 Flash |
| File storage | Supabase Storage |
| Email | Resend + React Email |
| Security | ArcJet (bot detection, rate limiting, shield) |
| Error monitoring | Sentry |
| Testing | Vitest (unit) + Playwright-ready (E2E) |
| CI/CD | GitHub Actions |
| Deployment | Vercel |

---

## Resume bullet points

- Architected a fintech platform with ACID-compliant balance updates using Prisma database transactions, preventing balance corruption under concurrent writes
- Implemented cursor-based pagination replacing unbounded full-table scans, reducing dashboard query complexity from O(n) to O(log n) via composite Postgres indexes
- Built an idempotency key system on all financial mutations — UUID generated client-side, deduplicated server-side — preventing double-transactions on network retries (pattern used by Stripe, Razorpay)
- Designed event-driven background job system with Inngest: per-user throttling, daily recurring transaction processing, AI-generated monthly financial reports, 6-hourly budget alerts
- Integrated Google Gemini 2.5 Flash for receipt OCR with parallel image upload to Supabase Storage; structured JSON output validated before DB write; receipt URL persisted on transaction row
- Implemented tag-based cache invalidation with Next.js `unstable_cache`; cached data served in <10ms while guaranteeing freshness within seconds of any mutation
- Built per-category budget tracking system with real-time monthly spend aggregation using Prisma `groupBy`; supports upsert semantics with `@@unique([userId, category])` constraint
- Secured all routes via ArcJet middleware chain (bot detection + shield + token-bucket rate limiting); typed error hierarchy maps Prisma constraint violations to HTTP-equivalent status codes
- Achieved 43 passing unit tests using Vitest with full mock isolation; CI/CD pipeline via GitHub Actions runs tests + build on every pull request against a disposable Postgres service container

---

## Local setup

```bash
# 1. Clone and install
git clone https://github.com/YOUR_USERNAME/welth-upgraded
cd welth-upgraded
npm install --legacy-peer-deps

# 2. Copy env file and fill in your keys
cp .env.example .env

# 3. Apply database migrations
npx prisma migrate deploy

# 4. Generate Prisma client
npx prisma generate

# 5. Start dev server
npm run dev

# 6. (Optional) Run Inngest dev server in a second terminal
npx inngest-cli@latest dev
```

## Environment variables

See `.env.example` for all required variables. Key services:
- **Supabase** — database + receipt image storage
- **Clerk** — authentication
- **Gemini** — AI receipt scanning
- **Resend** — transactional email
- **ArcJet** — security
- **Inngest** — background jobs
- **Sentry** — error monitoring (optional in dev)

## Running tests

```bash
# Unit tests (no DB required)
npm test

# Integration tests (requires TEST_DATABASE_URL in .env.test)
npm run test:integration

# Coverage report
npm run test:coverage
```
