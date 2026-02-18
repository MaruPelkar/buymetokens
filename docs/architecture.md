# BuyMeTokens — Architecture & Implementation Plan

## What We're Building

BuyMeACoffee for AI tokens. Supporters pay real money via Stripe; the platform provisions real OpenRouter API keys with spending limits for developers. No proxy, no token counting — OpenRouter enforces all budgets.

**The complete value loop**: Donor pays $10 → Stripe processes → Platform takes 5% ($0.50) → Developer's balance increases by $8.91 → OpenRouter key spending limit increased by $8.91 → Developer makes AI calls directly to OpenRouter → OpenRouter deducts from key limit → When limit reached, OpenRouter returns 402.

---

## Two User Roles

**Developer (Recipient)**: Signs up via GitHub, sets up profile + donation settings, receives a provisioned OpenRouter API key with a spending limit matching their balance. Uses the key directly with OpenRouter's API (compatible with OpenAI SDK, Anthropic SDK, and any OpenAI-compatible client).

**Supporter (Donor)**: No account required. Discovers developer via badge/URL/search, pays via Stripe, receives email receipt. Optional: set up monthly recurring donation.

---

## Architecture: Provisioned OpenRouter Keys

### Why This Model

The platform does NOT proxy API calls. Instead, it uses OpenRouter's [Management API](https://openrouter.ai/docs/guides/overview/auth/provisioning-api-keys) to create real OpenRouter API keys per developer, with USD spending limits that the platform controls programmatically.

**What the platform does**:
- Stripe payment processing (money in)
- Key provisioning via `POST /api/v1/keys` (create key with limit)
- Limit management via `PATCH /api/v1/keys/{hash}` (increase limit on donation)
- Usage sync via `GET /api/v1/keys/{hash}` (read usage for dashboard)
- Balance reconciliation (our records vs OpenRouter's `limit_remaining`)

**What the platform does NOT do**:
- No proxying or streaming
- No cost calculation or token counting
- No balance locks or concurrency handling
- No master account treasury risk
- No connection pool pressure from long-running requests

### Why Not a Proxy

The proxy model has the platform **fronting real money** on every API call — essentially operating as an unsecured credit provider. Risks include:

| Risk | Proxy Model | Provisioned Keys |
|------|-------------|-----------------|
| Developer overspends balance | Platform eats the cost | OpenRouter rejects the request (402) |
| Compromised key drains account | Platform's master account exposed | Only that key's limit is exposed |
| Pricing table stale/wrong | Platform under-charges systematically | OpenRouter charges actual price |
| Stream fails midway | Unknown cost, estimation guesswork | OpenRouter handles it |
| Master account runs dry | ALL developers blocked | Impossible — no master account |
| Concurrent requests race condition | Needs DB row locks, pool exhaustion | OpenRouter handles natively |

### Request Flow

```
Developer's codebase:
  OPENAI_BASE_URL = https://openrouter.ai/api/v1
  OPENAI_API_KEY  = sk-or-v1-abc123   ← Real OpenRouter key (provisioned by platform)

POST https://openrouter.ai/api/v1/chat/completions
  → OpenRouter authenticates the key
  → OpenRouter checks key's spending limit
  → If limit_remaining < estimated cost → 402 Payment Required
  → OpenRouter routes to the actual provider (OpenAI, Anthropic, etc.)
  → Streams response back to developer
  → Deducts actual cost from key's limit_remaining
  → Developer never hits BuyMeTokens servers for API calls
```

### Key Lifecycle

```
1. Developer signs up → Onboarding complete
   POST https://openrouter.ai/api/v1/keys
   { "name": "bmt-{user_id}", "limit": 0.00 }
   → Show the key to developer ONCE (plaintext not stored by platform)
   → Store key hash in provisioned_keys table

2. Donor donates $10 → Webhook fires → Balance credited $8.91
   PATCH https://openrouter.ai/api/v1/keys/{hash}
   { "limit": current_limit + 8.91 }
   → OpenRouter increases the key's spending cap

3. Developer uses key → OpenRouter deducts from limit
   (Platform is not involved in any API call)

4. Hourly usage sync cron:
   GET https://openrouter.ai/api/v1/keys/{hash}
   → Read usage, limit_remaining
   → Update our balances.available_balance = response.limit_remaining
   → Reconcile any drift

5. Developer can revoke key from dashboard:
   PATCH https://openrouter.ai/api/v1/keys/{hash}
   { "disabled": true }
   → Key stops working immediately
   → Balance preserved — new key can be created with same limit
```

### What the Developer Sees

Dashboard shows:
- **Available balance**: $X.XX (synced from OpenRouter's `limit_remaining`, updated hourly)
- **Total funded**: lifetime donations received
- **API Key**: `sk-or-v1-abc123` (shown once at creation, then masked as `sk-or-...c123`)
- **Base URL**: `https://openrouter.ai/api/v1` (with copy button)
- **Usage**: last sync timestamp

Setup instructions in dashboard:
```python
# Python (OpenAI SDK)
from openai import OpenAI
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key="sk-or-v1-abc123",  # your provisioned key
)
response = client.chat.completions.create(
    model="openai/gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

### OpenRouter Management API Reference

All calls require `Authorization: Bearer $OPENROUTER_MANAGEMENT_KEY`. This is a management key, **not** a regular API key — get it from https://openrouter.ai/settings/keys.

| Operation | Method | Endpoint | When |
|-----------|--------|----------|------|
| Create key | `POST` | `/api/v1/keys` | Developer completes onboarding |
| Update limit | `PATCH` | `/api/v1/keys/{hash}` | Donation webhook commits |
| Read usage | `GET` | `/api/v1/keys/{hash}` | Hourly sync cron |
| Disable key | `PATCH` | `/api/v1/keys/{hash}` | Developer revokes from dashboard |
| Delete key | `DELETE` | `/api/v1/keys/{hash}` | Account deletion |

Key creation request:
```json
POST https://openrouter.ai/api/v1/keys
Authorization: Bearer $OPENROUTER_MANAGEMENT_KEY
{ "name": "bmt-{user_id}-default", "limit": 0.00 }
```

Response (key plaintext returned **once only**):
```json
{
  "key": "sk-or-v1-abc123...",
  "data": {
    "hash": "abc123def456...",
    "limit": 0.00,
    "limit_remaining": 0.00,
    "usage": 0.00,
    "disabled": false,
    "created_at": "..."
  }
}
```

Limit update on donation:
```json
PATCH https://openrouter.ai/api/v1/keys/{hash}
Authorization: Bearer $OPENROUTER_MANAGEMENT_KEY
{ "limit": 8.91 }
```

Sources: [Create Key](https://openrouter.ai/docs/api/api-reference/api-keys/create-keys) · [Update Key](https://openrouter.ai/docs/api/api-reference/api-keys/update-keys) · [Provisioning Guide](https://openrouter.ai/docs/guides/overview/auth/provisioning-api-keys)

---

## Payment Architecture

**Platform is the single Stripe merchant** — no Stripe Connect. Developers never receive cash; they receive OpenRouter spending limit increases. This means:
- One Stripe account, one webhook, simple reconciliation
- No KYC/AML obligations for developers
- Stripe Connect complexity (deferred payouts, identity verification) eliminated entirely

**Revenue model**:

| Source | Rate | Trigger | Phase |
|--------|------|---------|-------|
| Platform fee | 5% of donation | Stripe `payment_intent.succeeded` webhook | 1 |
| Featured profiles | Monthly fee | Self-serve | Future |

Example: $10 donation → Stripe fee ~$0.59 → Platform fee $0.50 → Developer receives $8.91 as OpenRouter spending limit increase.

Note: No proxy margin revenue in this model — the platform doesn't touch API calls. Revenue is purely from the donation fee. This is the same model as BuyMeACoffee (which takes 5% and never touches the coffee).

---

## User Journey Maps

### Developer Onboarding

```
GitHub OAuth → /api/auth/github/callback
  → New user? → /dashboard/onboarding (2 steps):
      Step 1 — Profile: display name, slug (defaults to GitHub username), tagline, bio
               Slug availability checked via debounced GET /api/profile/slug-check
      Step 2 — Donation Settings: minimum amount, suggested amounts, custom message
  → Submit:
      → PATCH /api/profile/update (saves profile + onboarding_completed = true)
      → POST /api/api-keys (creates OpenRouter key with $0 limit)
      → Show key to developer ONCE in "Save this key" modal
      → "I've saved my key" button enabled only after copy
  → /dashboard (overview: balance $0.00, share your profile link)

  → Returning user with onboarding_completed = true? → /dashboard directly
```

### Developer Daily Use

```
/dashboard
  → See balance ($X.XX available, synced from OpenRouter hourly)
  → See setup instructions (base URL + key reminder)
  → Share profile link to get more funding
  → /dashboard/transactions → See donation history
  → /dashboard/supporters → See who funded you
  → /dashboard/api-keys → Revoke key or view masked prefix
```

### Donor Journey

```
Discovery: GitHub badge click / direct URL / /explore search
  → /[slug] — Public profile page (SSR, revalidates every 60s)
      Shows: developer info, supporter count, donation widget
  → Choose amount (suggested chips or custom input, minimum enforced)
  → Enter name + email (optional) + message (optional), anonymous toggle
  → Stripe Elements (card input)
  → Client: POST /api/payments/intent → gets clientSecret
  → stripe.confirmCardPayment(clientSecret) → Stripe processes
  → Client shows success: "You funded $X in AI tokens for [developer]!"

  → (Background) Stripe fires payment_intent.succeeded:
      POST /api/webhooks/stripe
      1. Validate Stripe signature (stripe.webhooks.constructEvent — raw body required)
      2. INSERT INTO webhook_events (event_id UNIQUE) — if duplicate, return 200 immediately
      3. Fetch charge.balance_transaction → actual Stripe fee
      4. Calculate: platform_fee = amount × 0.05; net = amount - stripe_fee - platform_fee
      5. BEGIN transaction:
         a. INSERT INTO transactions (type='donation_received', status='completed')
         b. UPDATE balances SET available_balance += net, lifetime_received += net
         c. UPSERT donation_supporters (increment total_donated_usd, donation_count)
         d. UPDATE profiles SET total_received_usd += net, total_supporters = (subquery COUNT)
         COMMIT.
      6. PATCH OpenRouter key: { limit: new_available_balance }
      7. Return 200

  → If Stripe payment fails:
      → Stripe Elements shows error inline — no webhook fires, no balance change
```

### Webhook Failure Recovery

```
If webhook handler crashes mid-processing:
  → Stripe retries (up to ~16 times over 3 days)
  → Idempotency check (webhook_events.event_id UNIQUE) prevents double-processing
  → If balance credited but OpenRouter PATCH failed:
      → Hourly cron detects drift: balances.available_balance > key's limit_remaining
      → Auto-corrects by PATCHing the key limit to match balance
```

### Key Revocation Flow

```
Developer clicks "Revoke" in /dashboard/api-keys:
  → DELETE /api/api-keys/{keyId}
  → PATCH OpenRouter key: { disabled: true }  (best-effort; logs if fails)
  → UPDATE provisioned_keys SET is_active = false, revoked_at = NOW()
  → Key immediately stops working at OpenRouter
  → Balance preserved in DB (new key can be created with same limit)

Developer creates replacement key:
  → POST /api/api-keys
  → POST OpenRouter /api/v1/keys { limit: current_balance }
  → Show new key ONCE
  → Store new key hash
```

### Zero Balance State

```
Developer's OpenRouter key limit reaches $0:
  → OpenRouter rejects API requests with 402
  → Hourly sync updates balance to $0.00
  → Dashboard shows "Out of credits" prompt with share link
  → Public profile page still works — donors can still donate
  → On next donation → key limit auto-increases via webhook
```

---

## Database Schema

Base schema: `src/lib/db/schema.sql`
Phase 1 migration: `src/lib/db/migrations/001_core_loop.sql`

### Existing Tables (base schema)

```
users                 — Accounts, GitHub OAuth data, role
profiles              — Public showcase pages, slug, donation settings
balances              — USD balance per developer
transactions          — Donation ledger (immutable)
github_repos          — Cached repo data from GitHub (Phase 2)
github_contributions  — Contribution graph data (Phase 2)
api_usage_logs        — Usage data synced from OpenRouter
notifications         — In-app notifications (Phase 5)
webhook_events        — Idempotency tracking for Stripe/GitHub webhooks
```

Note: `openrouter_keys` exists in base schema — dropped in `001_core_loop.sql` (replaced by `provisioned_keys`).

### Phase 1 Key Tables

**`users`** — Primary identity, created on GitHub OAuth callback
```sql
id UUID PK, github_id, github_username, email, display_name, avatar_url,
role VARCHAR(20) DEFAULT 'user',
onboarding_completed BOOLEAN DEFAULT false,
access_token TEXT  -- GitHub OAuth token
```

**`profiles`** — Public page data, one row per user
```sql
user_id UUID FK, slug VARCHAR(50) UNIQUE,
tagline, bio, donation_message,
minimum_donation DECIMAL(10,2) DEFAULT 1.00,
suggested_amounts JSONB DEFAULT '[3,5,10,25]',
is_public BOOLEAN DEFAULT true,
total_supporters INTEGER DEFAULT 0,
total_received_usd DECIMAL(10,2) DEFAULT 0.00
```

**`balances`** — One row per user, source of truth for available balance
```sql
user_id UUID FK UNIQUE,
available_balance DECIMAL(10,2) DEFAULT 0.00,
pending_balance DECIMAL(10,2) DEFAULT 0.00,
lifetime_received DECIMAL(10,2) DEFAULT 0.00,
currency VARCHAR(3) DEFAULT 'usd'
```

**`transactions`** — Immutable ledger
```sql
id UUID PK, user_id UUID FK,
type VARCHAR(50),             -- 'donation_received'
amount DECIMAL(10,2),         -- gross (e.g. $10.00)
net_amount DECIMAL(10,2),     -- after all fees (e.g. $8.91)
platform_fee DECIMAL(10,2),   -- platform's cut (e.g. $0.50)
stripe_fee DECIMAL(10,2),     -- actual Stripe fee from balance_transaction
currency VARCHAR(3), status VARCHAR(20),
donor_email, donor_name, message, is_anonymous BOOLEAN,
stripe_payment_intent_id VARCHAR(255) UNIQUE
```

**`provisioned_keys`** — One active OpenRouter key per developer
```sql
CREATE TABLE provisioned_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  key_name VARCHAR(255) NOT NULL DEFAULT 'Default',
  openrouter_key_hash VARCHAR(255) UNIQUE NOT NULL,  -- hash from OpenRouter's response
  key_prefix VARCHAR(30) NOT NULL,                   -- e.g. 'sk-or-...c123' for display
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMP,
  synced_limit_remaining DECIMAL(10,4) DEFAULT 0.00,
  synced_usage DECIMAL(10,4) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP
);
CREATE UNIQUE INDEX idx_provisioned_keys_hash ON provisioned_keys(openrouter_key_hash);
CREATE INDEX idx_provisioned_keys_user ON provisioned_keys(user_id, is_active);
```

**`donation_supporters`** — Aggregated donor→developer stats, UPSERT on each donation
```sql
CREATE TABLE donation_supporters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  donor_email VARCHAR(255) NOT NULL,
  donor_name VARCHAR(255),
  total_donated_usd DECIMAL(10,2) DEFAULT 0.00,
  donation_count INTEGER DEFAULT 1,
  is_anonymous BOOLEAN DEFAULT false,
  last_donated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(recipient_user_id, donor_email)
);
CREATE INDEX idx_supporters_recipient ON donation_supporters(recipient_user_id, total_donated_usd DESC);
```

**`webhook_events`** — Stripe deduplication, UNIQUE on `event_id`
```sql
event_id VARCHAR(255) UNIQUE, provider VARCHAR(50), event_type VARCHAR(100),
payload JSONB, status VARCHAR(20), processed_at TIMESTAMP
```

### Phase 3 Schema (`003_attribution.sql`)

```sql
CREATE TABLE profile_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  ref_source VARCHAR(100),     -- 'badge', 'direct', 'explore'
  ref_repo VARCHAR(255),        -- 'owner/repo' for badge clicks
  visitor_country VARCHAR(2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_profile_views_profile ON profile_views(profile_id, created_at DESC);
```

### Phase 4 Schema (`004_recurring.sql`)

```sql
CREATE TABLE stripe_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  donor_email VARCHAR(255) NOT NULL,
  stripe_subscription_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_customer_id VARCHAR(255) NOT NULL,
  amount_usd DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) NOT NULL,
  current_period_end TIMESTAMP,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_subscriptions_recipient ON stripe_subscriptions(recipient_user_id);
CREATE INDEX idx_subscriptions_stripe ON stripe_subscriptions(stripe_subscription_id);
```

---

## Webhook Idempotency Pattern

Stripe can deliver the same event multiple times. The handler is idempotent via PostgreSQL's UNIQUE constraint on `webhook_events.event_id`:

```ts
// In the DB transaction:
await client.query(
  `INSERT INTO webhook_events (event_id, ...) VALUES ($1, ...)`,
  [paymentIntent.id, ...]
);
// If event_id already exists → PostgreSQL throws code '23505' (unique violation)
// Catch at the outer level → return 200 immediately (already processed)
```

The webhook route must use `request.text()` (not `request.json()`) for raw body — required for Stripe signature verification.

Implementation: `src/lib/stripe/webhooks.ts`

---

## Session Architecture

iron-session stores an encrypted cookie (`buymetokens_session`) containing `{ userId, email, username }`. The cookie is HttpOnly, SameSite: lax, 30-day max-age.

`requireAuth()` in `src/lib/auth/session.ts`:
- Called at the top of every protected API route and server component
- Throws `Error('Unauthorized')` if no valid session → caught and returned as 401
- Returns `{ userId, email, username }`

`middleware.ts` protects `/dashboard/*` and `/admin/*` at the edge (no DB call needed — session is in the cookie). Both `session.ts` and `middleware.ts` import the same `sessionOptions` export — never duplicated.

---

## Implementation Phases

### Phase 1 — Core Loop ✅ Complete

**Exit criteria**: Donor visits `/[slug]`, pays $10. Developer's OpenRouter key limit increases by ~$8.91. Developer makes an AI API call directly to OpenRouter. It works.

**Files built** (see `CLAUDE.md` for full list):
- DB migration: `001_core_loop.sql`
- Service libs: `src/lib/stripe/`, `src/lib/openrouter/`
- API routes: payments, webhooks, profile, balance, transactions, api-keys, public profile, crons
- Pages: landing, public profile with donate widget, full dashboard (onboarding, profile, balance, transactions, API keys, supporters)
- Infra: `Dockerfile`, `docker-compose.yml`, `DOCKER.md`, `vercel.json`

---

### Phase 2 — GitHub Integration & Discovery

**Exit criteria**: Developer profile shows real GitHub repos and contribution data. Supporters can browse `/explore` and search by language or topic.

Key work:
- GitHub repo sync via Octokit REST (on login + every 6h via cron)
- GitHub contribution graph via GraphQL
- AI bio generation (GPT-4o-mini based on repos + README content)
- `/explore` discovery page with full-text search (PostgreSQL tsvector)
- Dashboard repo management (feature/unfeature repos)

Migration: `002_github_discovery.sql`
- `profiles`: add `search_vector TSVECTOR` + `GIN` index + trigger (auto-update from tagline + bio + display_name)
- `profiles`: add `ai_generated_bio_source JSONB`

New routes: `POST /api/github/sync`, `GET /api/github/repos`, `GET /api/github/contributions`, `POST /api/profile/bio-generate`, `GET /api/search`, `POST /api/cron/github-sync` (every 6h)

New pages: `/explore`, `/dashboard/repos`

---

### Phase 3 — Attribution & Badges

**Exit criteria**: Developer adds a badge to a repo README. Dashboard shows click analytics by source and repo.

Key work:
- `GET /badge/[slug].svg` — dynamic SVG (shields.io style, `#6366f1`)
- `GET /badge/[slug]/click` — click tracking + 302 redirect
- Dashboard badge generator (Markdown/HTML snippets, per-repo variants)
- Profile view and badge click analytics (recharts)

Badge spec:
```
┌────────────────────────────────────────────────┐
│  buymetokens  │  fund with AI tokens           │
└────────────────────────────────────────────────┘
Left: #555 (gray)   Right: #6366f1 (indigo-500)
```

Embed code:
```markdown
[![BuyMeTokens](https://buymetokens.dev/badge/yourslug.svg)](https://buymetokens.dev/badge/yourslug/click?ref=badge&repo=owner/repo)
```

New routes: `GET /badge/[slug].svg`, `GET /badge/[slug]/click`, `GET /api/analytics/badge-clicks`, `GET /api/analytics/profile-views`

New page: `/dashboard/badges`

---

### Phase 4 — Recurring Support

**Exit criteria**: Donor sets up $10/month. Developer auto-credited monthly. Donor cancels without an account via tokenized link.

Key work:
- Stripe Subscriptions (monthly billing cycle)
- Recurring toggle in donate widget
- `invoice.paid` webhook → credit balance + update key limit
- `customer.subscription.deleted` webhook → update status
- `/manage-subscription?token=[jwt]` — no-login cancel/manage page (JWT signed with `SESSION_SECRET`, contains `{ subscriptionId, donorEmail }`)

New route: `POST /api/payments/subscription`
Extend webhook: handle `invoice.paid`, `customer.subscription.deleted`

---

### Phase 5 — Email Notifications

**Exit criteria**: Developer receives email on first donation. Donor receives a receipt.

Key work:
- Add `resend` package, `RESEND_API_KEY` env var
- Transactional emails: donation received (developer), receipt (donor), low balance alert
- Low balance alert cron (hourly: developers with `limit_remaining < $1` who opted in)
- Dark mode (`dark:` Tailwind classes), mobile responsive polish
- OpenGraph meta tags for profile pages

Migration: `005_notifications.sql` — add `users.email_notifications BOOLEAN DEFAULT true`

New routes: `GET /api/notifications`, `POST /api/notifications/read`, `POST /api/cron/low-balance-alerts`

New pages: `/dashboard/notifications`, `/dashboard/settings`

---

### Phase 6 — Admin Panel

**Exit criteria**: Operators can manage users, monitor key provisioning, and handle support without DB access.

Key work:
- `users.role = 'admin'` checked server-side in admin API routes (middleware already blocks route access)
- User management: view, deactivate, adjust balance/key limit
- Key health: list all provisioned keys, their limits, usage
- Transaction search across all users

New routes: `GET /api/admin/users`, `GET /api/admin/keys`, `GET /api/admin/transactions`, `POST /api/cron/stripe-reconcile`

New pages: `/admin/`, `/admin/users`, `/admin/keys`, `/admin/transactions`

---

## Infrastructure

### Vercel (Production)
- App deployed on Vercel — no Docker needed in production
- `vercel.json` defines two Cron jobs:
  - `/api/cron/usage-sync` — hourly (`0 * * * *`)
  - `/api/cron/reconcile` — daily at 2am UTC (`0 2 * * *`)
- All cron endpoints verify `Authorization: Bearer $CRON_SECRET`
- `NEXT_PUBLIC_*` vars set in Vercel dashboard (baked into client bundle at build time)

### Docker (Local Development)
- `docker-compose.yml`: `db` (postgres:16-alpine) + `app` (node:20-alpine)
- PostgreSQL auto-initialises from `docker-entrypoint-initdb.d/` on first boot:
  - `01_schema.sql` → `src/lib/db/schema.sql`
  - `02_migration.sql` → `src/lib/db/migrations/001_core_loop.sql`
- Source bind-mounted → hot reload works
- Anonymous `node_modules` volume → Linux binaries, no macOS/Linux conflict
- `docker/entrypoint-dev.sh` runs `npm ci` on first boot (stamp file), then `exec npm run dev`
- See `DOCKER.md` for full usage guide

### Production Docker (Self-Hosted Alternative to Vercel)
- `Dockerfile`: 3-stage build (`deps` → `builder` → `runner`)
- `NEXT_OUTPUT=standalone` activated in builder stage → self-contained server bundle
- `runner` stage: non-root user, no `node_modules`, ~100MB image
- `HOSTNAME=0.0.0.0` required — standalone server binds `127.0.0.1` by default
- `NEXT_PUBLIC_*` vars must be passed as `--build-arg` at image build time (baked into JS)

---

## Security & Reliability

### Key Security
- Platform never stores the OpenRouter key plaintext. Only the `hash` (from OpenRouter's response) is stored.
- The key is shown to the developer once at creation (same as how OpenRouter's own dashboard works).
- Keys disabled instantly via OpenRouter Management API on revocation.
- OpenRouter enforces per-key spending limits — platform cannot overspend.

### Webhook Security
- All Stripe webhooks validated via `stripe.webhooks.constructEvent()` with `STRIPE_WEBHOOK_SECRET`.
- **Idempotency**: Every webhook handler checks `webhook_events.event_id` (UNIQUE constraint) before processing. If the event exists, return 200 without reprocessing.
- Webhook route must use `request.text()` (not `request.json()`) for raw body — required for signature verification.
- Stripe retries failed webhooks for up to 3 days. Combined with idempotency, this makes the system self-healing.

### Balance ↔ Key Limit Consistency
- **On donation**: DB transaction commits first, then OpenRouter PATCH. If PATCH fails, log and continue (cron will reconcile).
- **Hourly sync**: Cron reads `limit_remaining` from OpenRouter and updates `balances.available_balance`. This corrects any drift.
- **Daily reconciliation**: Compares `SUM(balances.available_balance)` against sum of all active keys' `limit_remaining`. Logs discrepancies for admin review.
- **Edge case — donation while developer is actively using API**: The PATCH to increase the limit is atomic on OpenRouter's side. If a request is in-flight, OpenRouter handles the concurrency.

### Rate Limiting
- OpenRouter enforces its own rate limits per key — no platform code needed in the API call path.
- Platform rate limits only needed on platform's own API routes (profile updates, payment intents, etc.).
- Phase 5 adds Redis-backed rate limiting for public-facing routes.

### Failure Modes

| Failure | Impact | Recovery |
|---------|--------|----------|
| OpenRouter Management API down | Can't create keys or update limits on donation | Hourly cron retries limit sync; new key creation fails gracefully with error |
| Stripe webhook delivery fails | Developer not credited | Stripe retries for 3 days; idempotency prevents double-credit |
| Usage sync cron fails | Dashboard shows stale balance | Next hourly run catches up; no functional impact (OpenRouter still enforces limits) |
| OpenRouter key compromised | Attacker uses developer's credits | Developer revokes from dashboard; limited to that key's remaining balance |
| Platform DB down | Dashboard inaccessible | AI API calls still work (OpenRouter handles them independently) |

### Security Summary

| Concern | Mitigation |
|---------|-----------|
| Key plaintext exposure | Never stored — shown once, platform retains only hash |
| Stripe webhook spoofing | `stripe.webhooks.constructEvent` signature verification |
| CSRF | iron-session cookie is SameSite: lax; state-changing routes are POST/PATCH/DELETE |
| SQL injection | All queries parameterised via `pg` driver |
| Session fixation | Session created fresh after GitHub OAuth callback |
| Slug hijacking | Reserved slug list validated in both slug-check and profile update |
| Cron abuse | `Authorization: Bearer CRON_SECRET` required on all cron endpoints |
| Admin escalation | `role` checked server-side in API routes; middleware only blocks route access |

---

## Complete Route Map (All Phases)

### Public Pages
```
/                          Landing page                              Phase 1 ✅
/[slug]                    Public profile + donate widget (SSR)      Phase 1 ✅
/u/[github_username]       Alias → redirect to /[slug]              Phase 1
/explore                   Discovery + search                        Phase 2
/badge/[slug].svg          Dynamic SVG badge                         Phase 3
/badge/[slug]/click        Click tracking + redirect                 Phase 3
/manage-subscription       Donor subscription management             Phase 4
/privacy                   Privacy policy                            Phase 5
/terms                     Terms of service                          Phase 5
```

### Dashboard (protected: /dashboard/*)
```
/dashboard                 Overview: balance + key info + activity   Phase 1 ✅
/dashboard/onboarding      2-step wizard + key provisioning          Phase 1 ✅
/dashboard/profile         Profile editor                            Phase 1 ✅
/dashboard/balance         Balance + usage (synced from OpenRouter)  Phase 1 ✅
/dashboard/transactions    Donation history                          Phase 1 ✅
/dashboard/api-keys        Key display + revoke + regenerate         Phase 1 ✅
/dashboard/supporters      Supporter list                            Phase 1 ✅
/dashboard/repos           GitHub repo management                    Phase 2
/dashboard/badges          Badge generator + analytics               Phase 3
/dashboard/notifications   Notification inbox                        Phase 5
/dashboard/settings        Account settings                          Phase 5
```

### API Routes
```
# Auth                                                              Done ✅
GET  /api/auth/github
GET  /api/auth/github/callback
GET  /api/auth/session
POST /api/auth/logout

# Profile                                                           Phase 1 ✅
GET   /api/profile
PATCH /api/profile/update
GET   /api/profile/slug-check?slug=
POST  /api/profile/bio-generate                                     Phase 2

# Payments + Webhooks                                               Phase 1 ✅
POST /api/payments/intent
POST /api/webhooks/stripe
POST /api/payments/subscription                                     Phase 4

# Balance + Transactions                                            Phase 1 ✅
GET /api/balance
GET /api/transactions?page=

# API Keys (OpenRouter provisioned)                                 Phase 1 ✅
GET    /api/api-keys
POST   /api/api-keys
DELETE /api/api-keys/[keyId]

# Public Profile                                                    Phase 1 ✅
GET /api/public/profile/[slug]

# GitHub                                                            Phase 2
POST /api/github/sync
GET  /api/github/repos
GET  /api/github/contributions

# Search                                                            Phase 2
GET /api/search?q=&language=&sort=

# Analytics                                                         Phase 3
GET /api/analytics/badge-clicks
GET /api/analytics/profile-views

# Notifications                                                     Phase 5
GET  /api/notifications
POST /api/notifications/read

# Cron (Authorization: Bearer CRON_SECRET)
POST /api/cron/usage-sync            hourly                         Phase 1 ✅
POST /api/cron/reconcile             daily                          Phase 1 ✅
POST /api/cron/github-sync           every 6h                       Phase 2
POST /api/cron/low-balance-alerts    hourly                         Phase 5
POST /api/cron/stripe-reconcile      daily                          Phase 6

# Admin (role = 'admin' required)                                   Phase 6
GET  /api/admin/users
GET  /api/admin/keys
GET  /api/admin/transactions
```

---

## Environment Variables

```bash
# Core
DATABASE_URL=postgresql://...         # Docker dev: @db:5432, native: @localhost:5432
SESSION_SECRET=...                    # openssl rand -base64 32
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_CALLBACK_URL=http://localhost:3000/api/auth/github/callback
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Phase 1
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PLATFORM_FEE_PERCENT=5
OPENROUTER_MANAGEMENT_KEY=sk-or-...   # Management key, NOT a regular API key
CRON_SECRET=...                       # openssl rand -hex 32; Vercel sets automatically

# Phase 5
RESEND_API_KEY=re_...
```

---

## Resolved Decisions

| Decision | Resolution | Rationale |
|----------|------------|-----------|
| Token delivery method | Provisioned OpenRouter keys | Zero financial risk. OpenRouter enforces spending limits. No proxy needed. |
| Why not proxy? | Platform fronts real money on every call | Proxy = unsecured credit provider. Provisioned keys = OpenRouter enforces limits. |
| Which AI providers? | OpenRouter only (Phase 1) | Covers 200+ models. Developer talks to OpenRouter directly. |
| Donor account required? | No | Email only for receipts. Subscriptions via signed JWT link. |
| Stripe Connect? | No | Platform is single merchant. Developers receive API credits, not cash. |
| Balance tracking | Our DB synced from OpenRouter hourly | Source of truth is OpenRouter's `limit_remaining`. Our DB is a cache for dashboard. |
| Rate limiting | OpenRouter handles API rate limits | No proxy = no proxy rate limiting needed. Platform routes rate limited in Phase 5. |
| Cursor support? | Deferred indefinitely | No reseller API available. |
| OpenRouter PATCH timing | After DB commit, not inside transaction | Can't hold a DB connection open during an external HTTP call. Failure tolerated; cron reconciles. |
| Session config | Single export from `session.ts`, imported in `middleware.ts` | Prevents drift if options change. |
