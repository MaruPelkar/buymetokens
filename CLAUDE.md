# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm run dev       # Start Next.js dev server on http://localhost:3000
npm run build     # Production build
npm run lint      # ESLint via next lint
```

No test runner is configured yet.

### Database Setup

Apply the base schema, then migrations in order:
```bash
psql $DATABASE_URL < src/lib/db/schema.sql
psql $DATABASE_URL < src/lib/db/migrations/001_core_loop.sql
```

### Environment

Copy `.env.example` to `.env.local` and populate all values before running.

The `@/` path alias resolves to `src/` (configured in `tsconfig.json`).

---

## What This Is

BuyMeACoffee for AI tokens. Supporters pay USD via Stripe; the platform provisions a real OpenRouter API key per developer with a USD spending limit. No proxy — developers talk to OpenRouter directly. The platform takes a 5% fee on donations.

**Two user roles**:
- **Developer (Recipient)**: Signs up via GitHub, sets up profile, receives a provisioned OpenRouter key, uses it directly.
- **Supporter (Donor)**: No account required. Discovers developer, pays via Stripe.

---

## Tech Stack

- **Framework**: Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Database**: PostgreSQL (Neon/Supabase), pool in `src/lib/db/client.ts`
- **Auth**: GitHub OAuth + iron-session (30-day encrypted cookies)
- **Payments**: Stripe (payment intents + webhooks). Platform is the single Stripe merchant — no Stripe Connect.
- **AI token delivery**: OpenRouter Provisioned Keys via [Management API](https://openrouter.ai/docs/guides/overview/auth/provisioning-api-keys). No proxy.
- **Validation**: Zod for all API route inputs
- **GitHub integration**: Octokit REST + GraphQL for repo/contribution sync
- **Email**: Resend (Phase 5)
- **Charts**: recharts (installed, not yet used)

---

## Core Architecture: Provisioned OpenRouter Keys

The platform does NOT proxy API calls. It uses OpenRouter's Management API to create real API keys per developer with USD spending limits.

```
Donation arrives ($10):
  → Stripe webhook fires
  → Platform credits balance: $8.91 (after Stripe fee + 5% platform fee)
  → PATCH https://openrouter.ai/api/v1/keys/{hash} { limit: new_balance }
  → OpenRouter increases the key's spending cap

Developer uses key directly:
  OPENAI_BASE_URL = https://openrouter.ai/api/v1
  OPENAI_API_KEY  = sk-or-v1-abc123   ← real OpenRouter key
  → OpenRouter handles auth, streaming, billing, rate limits, budget enforcement
  → When limit reached → OpenRouter returns 402

Usage sync (hourly cron):
  → GET https://openrouter.ai/api/v1/keys/{hash}
  → Read limit_remaining → Update our balances table
```

**Why not proxy**: Proxying has the platform front real money on every API call (unsecured credit risk). With provisioned keys, OpenRouter enforces spending limits. Zero financial risk for the platform.

---

## Project Status

### Foundation (Complete)
- GitHub OAuth flow, iron-session, route protection middleware
- PostgreSQL pool with transaction support
- Type definitions, blank landing page

### Phase 1 — Core Loop (Next)
Donation → Balance → OpenRouter key limit update. Full value delivery.

### Phase 2 — GitHub Integration & Discovery
### Phase 3 — Attribution & Badges
### Phase 4 — Recurring Support
### Phase 5 — Notifications & Polish
### Phase 6 — Admin Panel

See `docs/architecture.md` for full phase details, exit criteria, and file lists.

---

## Conventions

### Database
- `src/lib/db/client.ts` exports three helpers:
  - `query(text, params)` — single query, logs in dev. Use for reads and simple writes.
  - `transaction(callback)` — wraps callback in `BEGIN/COMMIT/ROLLBACK`, releases client. Use for multi-step writes.
  - `getClient()` — raw `PoolClient` for manual control.
- UUID PKs via `gen_random_uuid()`, `updated_at` via trigger.
- Never put API keys in the database — only hashes or env var names.
- One migration file per phase: `001_core_loop.sql`, `002_github_discovery.sql`, etc.

### API Routes
- Protected routes call `requireAuth()` from `src/lib/auth/session.ts`.
- All routes export only `GET`, `POST`, `PATCH`, or `DELETE` (named exports).
- **All inputs validated with Zod schemas.** Define schemas in `src/types/schemas.ts`.
- Return consistent error shape: `{ error: string, details?: unknown }`.
- Webhook routes skip CSRF; validate via Stripe signature header.
- **Webhook handlers must be idempotent.** Check `webhook_events.event_id` for duplicates before processing. Stripe can deliver the same event multiple times.

### New Library Modules
- Pattern: `src/lib/[service]/client.ts` (SDK init) + `src/lib/[service]/[feature].ts`
- Follow the pattern in `src/lib/auth/github.ts`.

### Session
- Session options are defined in `src/lib/auth/session.ts` and exported as `sessionOptions`.
- Both `session.ts` and `middleware.ts` must use the same exported config. Never duplicate session config.

### OpenRouter Key Management
- Keys provisioned via `POST /api/v1/keys` with a `limit` in USD.
- Platform stores only the `hash` from OpenRouter's response (in `provisioned_keys` table).
- Key plaintext (`sk-or-v1-...`) shown to developer once at creation, never stored by the platform.
- On donation: `PATCH /api/v1/keys/{hash}` to increase limit.
- On revocation: `PATCH /api/v1/keys/{hash}` with `{ "disabled": true }`.
- Hourly cron syncs `limit_remaining` and `usage` from OpenRouter to our DB.
- All Management API calls use `OPENROUTER_MANAGEMENT_KEY` env var.
- If the OpenRouter PATCH fails during webhook processing, roll back the DB transaction and return 500 (Stripe will retry).

### Reserved Slugs (cannot be profile URLs)
`admin`, `api`, `explore`, `dashboard`, `badge`, `manage-subscription`, `login`, `logout`, `privacy`, `terms`, `u`, `proxy`, `cron`, `webhooks`

---

## Route Map

### Public Pages
```
/                    Landing page
/[slug]              Public profile + donate widget (SSR)
/u/[username]        GitHub username alias → redirect to /[slug]
/explore             Discovery + search (Phase 2)
```

### Dashboard (protected: /dashboard/*)
```
/dashboard                 Overview: balance + key info + activity
/dashboard/onboarding      2-step wizard + key provisioning
/dashboard/profile         Profile editor
/dashboard/balance         Balance + usage (synced from OpenRouter)
/dashboard/transactions    Donation history
/dashboard/api-keys        Key display + revoke + regenerate
/dashboard/supporters      Supporter list
```

### API Routes
```
# Auth (existing)
GET  /api/auth/github
GET  /api/auth/github/callback
GET  /api/auth/session
POST /api/auth/logout

# Profile
GET   /api/profile
PATCH /api/profile/update
GET   /api/profile/slug-check

# Payments + Webhooks
POST /api/payments/intent
POST /api/webhooks/stripe

# Balance + Transactions
GET /api/balance
GET /api/transactions

# API Keys (OpenRouter provisioned)
GET    /api/api-keys
POST   /api/api-keys
DELETE /api/api-keys

# Public Profile
GET /api/public/profile/[slug]

# Cron
POST /api/cron/usage-sync       (hourly)
POST /api/cron/reconcile         (daily)
```

Routes added in later phases are documented in `docs/architecture.md`.

---

## Environment Variables

Required for Phase 1:

```bash
# Existing
DATABASE_URL=postgresql://...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
SESSION_SECRET=...                       # 32+ char random string
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Phase 1
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
OPENROUTER_MANAGEMENT_KEY=sk-or-...      # Management API key (NOT regular API key)
PLATFORM_FEE_PERCENT=5
CRON_SECRET=...
```
