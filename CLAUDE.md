# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Development Commands

```bash
npm run dev       # Start Next.js dev server at http://localhost:3000
npm run build     # Production build
npm run lint      # ESLint via next lint
npx tsc --noEmit  # Type-check without emitting (no test runner configured yet)
```

### Docker (recommended for development)

```bash
cp .env.example .env.docker
# Fill in .env.docker with all required values
docker compose --env-file .env.docker up        # First boot: DB init + npm ci (~90s)
docker compose --env-file .env.docker up        # Subsequent boots: <10s, hot reload

docker compose down                             # Stop (data persists)
docker compose down -v                          # Stop + wipe DB (fresh schema on next boot)
docker compose exec db psql -U postgres -d buymetokens  # DB shell
docker compose logs -f app                      # App logs
```

### Native dev (no Docker)

```bash
cp .env.example .env.local
psql $DATABASE_URL < src/lib/db/schema.sql
psql $DATABASE_URL < src/lib/db/migrations/001_core_loop.sql
npm install && npm run dev
```

### Environment

Copy `.env.example` to `.env.docker` (Docker) or `.env.local` (native) and populate all values before running. The `@/` path alias resolves to `src/` (configured in `tsconfig.json`).

See `DOCKER.md` for the complete Docker guide. See `docs/architecture.md` for full system design.

---

## What This Is

BuyMeACoffee for AI tokens. Supporters pay USD via Stripe; the platform provisions a real OpenRouter API key per developer with a USD spending limit. No proxy — developers talk to OpenRouter directly. Platform fee: 5%.

**Two roles**:
- **Developer (Recipient)**: Signs up via GitHub, completes onboarding, receives a provisioned OpenRouter key, uses it directly in their code.
- **Supporter (Donor)**: No account required. Visits `/{slug}`, pays via Stripe.

---

## Tech Stack

- **Framework**: Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Database**: PostgreSQL 16, pool in `src/lib/db/client.ts`
- **Auth**: GitHub OAuth + iron-session (30-day encrypted cookies)
- **Payments**: Stripe (PaymentIntents + Webhooks). Single merchant — no Stripe Connect.
- **AI token delivery**: OpenRouter Provisioned Keys via Management API. No proxy.
- **Validation**: Zod schemas in `src/types/schemas.ts`
- **Infra**: Vercel (production), Docker Compose (local dev)

---

## Core Architecture: Provisioned OpenRouter Keys

The platform does NOT proxy API calls. It uses OpenRouter's Management API to create real per-developer keys with USD spending limits.

```
Donation arrives ($10):
  → Stripe webhook fires
  → Platform credits balance: $8.91 (after Stripe fee ~$0.59 + 5% platform fee)
  → PATCH https://openrouter.ai/api/v1/keys/{hash} { limit: new_balance }
  → OpenRouter key spending cap is raised

Developer uses key directly:
  OPENAI_BASE_URL = https://openrouter.ai/api/v1
  OPENAI_API_KEY  = sk-or-v1-abc123   ← real OpenRouter key, shown once at creation
  → OpenRouter handles auth, streaming, billing, rate limits, budget enforcement
  → When limit reached → OpenRouter returns 402

Hourly sync (Vercel Cron → /api/cron/usage-sync):
  → GET https://openrouter.ai/api/v1/keys/{hash}
  → Read limit_remaining + usage → UPDATE balances + provisioned_keys tables
```

**Why not proxy**: Proxying has the platform front real money on every API call (unsecured credit risk). With provisioned keys, OpenRouter enforces spending limits. Zero financial risk for the platform.

---

## Project Status

| Phase | Description | Status |
|-------|-------------|--------|
| Foundation | GitHub OAuth, session, DB pool, middleware | ✅ Complete |
| 1 | Core loop: donate → balance → OpenRouter key limit | ✅ Complete |
| 2 | GitHub repo sync + `/explore` discovery | Planned |
| 3 | Badge generator + click tracking | Planned |
| 4 | Recurring donations (Stripe subscriptions) | Planned |
| 5 | Email notifications (Resend) | Planned |
| 6 | Admin panel | Planned |

### Phase 1 — What Was Built

**DB**: `001_core_loop.sql` — adds `provisioned_keys` and `donation_supporters` tables, drops legacy `openrouter_keys`, adds `role`, `platform_fee`, `total_supporters` columns.

**Service libs**:
- `src/lib/stripe/client.ts` + `webhooks.ts` — PaymentIntent creation, webhook signature validation, full post-payment DB transaction + OpenRouter key limit update
- `src/lib/openrouter/client.ts` + `keys.ts` — Management API: create, update limit, disable, get status

**API routes** (all validated with Zod):
`/api/payments/intent`, `/api/webhooks/stripe`, `/api/profile`, `/api/profile/update`, `/api/profile/slug-check`, `/api/balance`, `/api/transactions`, `/api/api-keys`, `/api/api-keys/[keyId]`, `/api/public/profile/[slug]`, `/api/cron/usage-sync`, `/api/cron/reconcile`

**Pages**: Landing page, public profile (`/[slug]`), donate widget (multi-step Stripe), dashboard overview, onboarding wizard, profile editor, balance page, transactions, API keys, supporters.

**Infra**: `Dockerfile` (multi-stage, standalone), `docker-compose.yml` (dev), `docker/entrypoint-dev.sh`, `.dockerignore`, `DOCKER.md`, `vercel.json` (cron schedules).

---

## Database

### Schema

Base schema: `src/lib/db/schema.sql`
Migration: `src/lib/db/migrations/001_core_loop.sql`

Key tables for Phase 1:

| Table | Purpose |
|-------|---------|
| `users` | GitHub identity, `role`, `onboarding_completed` |
| `profiles` | Public page: `slug`, `tagline`, `bio`, `suggested_amounts`, `minimum_donation` |
| `balances` | One row per user: `available_balance`, `lifetime_received` |
| `transactions` | Donation records: `amount`, `net_amount`, `platform_fee`, `stripe_fee`, `status` |
| `provisioned_keys` | OpenRouter key per user: `openrouter_key_hash`, `key_prefix`, `synced_limit_remaining` |
| `donation_supporters` | Aggregated donor→recipient stats (UPSERT on webhook) |
| `webhook_events` | Stripe event deduplication (UNIQUE on `event_id`) |

### DB Helpers (`src/lib/db/client.ts`)

- `query(text, params)` — single query, logs SQL in dev. Use for reads and simple writes.
- `transaction(callback)` — wraps callback in `BEGIN/COMMIT/ROLLBACK`. Use for multi-step writes.
- `getClient()` — raw `PoolClient` for manual control.

Convention: UUID PKs via `gen_random_uuid()`, `updated_at` managed by trigger.

---

## Conventions

### API Routes
- Protected routes call `requireAuth()` from `src/lib/auth/session.ts`. It throws `Error('Unauthorized')` — catch and return 401.
- All inputs validated with Zod schemas defined in `src/types/schemas.ts`.
- Consistent error shape: `{ error: string, details?: unknown }`.
- Webhook routes validate via Stripe signature header (not session).
- **Idempotency**: webhook handler inserts into `webhook_events` with UNIQUE `event_id`. Catch PostgreSQL error code `23505` (unique violation) → return 200 immediately (already processed).

### Session
- `sessionOptions` exported from `src/lib/auth/session.ts` and imported in `middleware.ts`.
- Never duplicate the session config. One definition only.

### OpenRouter Keys
- Platform stores only the `openrouter_key_hash` returned by OpenRouter's POST response.
- Plaintext key shown to developer once at creation. Never stored or returned again.
- On donation webhook: `PATCH /api/v1/keys/{hash}` to increase limit. Do this AFTER the DB transaction commits (don't hold a DB connection open during the HTTP call).
- Hourly cron reconciles `limit_remaining` / `usage` drift between DB and OpenRouter.
- All Management API calls use `OPENROUTER_MANAGEMENT_KEY` env var.

### Components
- Client components: `'use client'` directive, no server-side data fetching.
- Server components (dashboard pages): call `requireAuth()` directly, query DB directly.
- Dashboard sidebar: `src/components/dashboard/Sidebar.tsx` (client, uses `usePathname` for active link).

### Reserved Slugs
`admin`, `api`, `explore`, `dashboard`, `badge`, `manage-subscription`, `login`, `logout`, `privacy`, `terms`, `u`, `proxy`, `cron`, `webhooks`

---

## Route Map

### Public Pages
```
/                    Landing page
/[slug]              Public profile + donate widget (SSR, revalidates every 60s)
```

### Dashboard (protected: /dashboard/*)
```
/dashboard                 Overview: balance + key info + recent transactions
/dashboard/onboarding      2-step wizard (profile fields + donation prefs) + key provisioning
/dashboard/profile         Profile editor (slug, tagline, bio, donation message)
/dashboard/balance         Balance + usage + setup code snippets
/dashboard/transactions    Paginated donation history
/dashboard/api-keys        Key display (plaintext shown once) + revoke
/dashboard/supporters      Donor list with totals
```

### API Routes
```
# Auth
GET  /api/auth/github
GET  /api/auth/github/callback
GET  /api/auth/session
POST /api/auth/logout

# Profile
GET   /api/profile
PATCH /api/profile/update
GET   /api/profile/slug-check?slug=

# Payments
POST /api/payments/intent
POST /api/webhooks/stripe

# Balance + Transactions
GET /api/balance
GET /api/transactions?page=

# API Keys (OpenRouter provisioned)
GET    /api/api-keys
POST   /api/api-keys
DELETE /api/api-keys/[keyId]

# Public (no auth)
GET /api/public/profile/[slug]

# Cron (Authorization: Bearer CRON_SECRET)
POST /api/cron/usage-sync   (hourly — syncs OpenRouter limit_remaining to balances table)
POST /api/cron/reconcile    (daily  — logs drift between DB balances and OpenRouter limits)
```

---

## Environment Variables

```bash
DATABASE_URL=postgresql://...
SESSION_SECRET=...                             # openssl rand -base64 32
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_CALLBACK_URL=http://localhost:3000/api/auth/github/callback
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PLATFORM_FEE_PERCENT=5
OPENROUTER_MANAGEMENT_KEY=sk-or-...            # Management key, not regular API key
CRON_SECRET=...                                # openssl rand -hex 32
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Docker dev: `DATABASE_URL` uses hostname `db` (the Compose service name) — `postgresql://postgres:postgres@db:5432/buymetokens`.
