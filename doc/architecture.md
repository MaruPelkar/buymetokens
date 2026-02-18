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
   → Store key hash in proxy_api_keys table
   → Show the key to developer ONCE (we don't store the plaintext either)

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
```

### What the Developer Sees

Dashboard shows:
- **Available balance**: $X.XX (synced from OpenRouter's `limit_remaining`)
- **Total funded**: lifetime donations received
- **API Key**: `sk-or-v1-abc123` (shown once at creation, then masked as `sk-or-...c123`)
- **Base URL**: `https://openrouter.ai/api/v1` (with copy button)
- **Usage**: last sync timestamp + link to OpenRouter dashboard for detailed analytics

Setup instructions in dashboard:
```python
# Python (OpenAI SDK)
from openai import OpenAI
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key="sk-or-v1-abc123",  # Your BuyMeTokens key
)

# Works with any OpenRouter-supported model
response = client.chat.completions.create(
    model="openai/gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

### OpenRouter Management API Reference

All calls require a Management API key (stored as `OPENROUTER_MANAGEMENT_KEY` env var — this is NOT the same as a regular API key).

| Operation | Method | Endpoint | When |
|-----------|--------|----------|------|
| Create key | `POST` | `/api/v1/keys` | Developer completes onboarding |
| Update limit | `PATCH` | `/api/v1/keys/{hash}` | Donation received |
| Read usage | `GET` | `/api/v1/keys/{hash}` | Hourly sync cron |
| Disable key | `PATCH` | `/api/v1/keys/{hash}` | Developer revokes from dashboard |
| Delete key | `DELETE` | `/api/v1/keys/{hash}` | Account deletion |

Key creation request:
```json
POST https://openrouter.ai/api/v1/keys
Authorization: Bearer $OPENROUTER_MANAGEMENT_KEY
{
  "name": "bmt-{user_id}-{key_name}",
  "limit": 0.00,
  "limit_reset": null
}
```

Response:
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
{
  "limit": 8.91
}
```

Sources:
- [Create Key](https://openrouter.ai/docs/api/api-reference/api-keys/create-keys)
- [Update Key](https://openrouter.ai/docs/api/api-reference/api-keys/update-keys)
- [Provisioning Guide](https://openrouter.ai/docs/guides/overview/auth/provisioning-api-keys)

---

## Existing Foundation (Already Built)

- **Auth**: GitHub OAuth complete (`/api/auth/github/*`), iron-session, `requireAuth()` helper
- **DB**: PostgreSQL pool with `query()`, `transaction()`, `getClient()` helpers
- **Schema**: 10 tables in `src/lib/db/schema.sql` — `users`, `profiles`, `balances`, `transactions`, `github_repos`, `github_contributions`, `openrouter_keys`, `api_usage_logs`, `notifications`, `webhook_events`
- **Types**: `User`, `Profile`, `Balance`, `Transaction`, `ApiUsageLog`, `Notification`, `SessionData`
- **Middleware**: Route protection for `/dashboard/*` and `/admin/*`
- **Frontend**: Placeholder landing page only
- **Installed but unused**: `stripe`, `@stripe/stripe-js`, `openai`, `@octokit/rest`, `recharts`, `react-hook-form`, `zod`

### Cleanup Already Done

1. ~~Session config duplication~~ — Fixed: `middleware.ts` imports `sessionOptions` from `session.ts`.
2. ~~Dead column `users.stripe_account_id`~~ — Removed from schema and types.
3. **Superseded table**: `openrouter_keys` exists in base schema. Drop in `001_core_loop.sql` migration.

---

## Revenue Model

| Source | Rate | Trigger | Phase |
|--------|------|---------|-------|
| Platform fee | 5% of donation | Stripe `payment_intent.succeeded` webhook | 1 |
| Featured profiles | Monthly fee | Self-serve | Future |

**Example**: Donor pays $10.00 → Stripe fee ~$0.59 → Platform fee $0.50 → Developer receives $8.91 as OpenRouter spending limit increase.

Note: No proxy margin revenue in this model — the platform doesn't touch API calls. Revenue is purely from the donation fee. This is the same model as BuyMeACoffee (which takes 5% and never touches the coffee).

---

## User Journey Maps

### Developer Onboarding (Phase 1)
```
GitHub OAuth → /api/auth/github/callback
  → New user? → /dashboard/onboarding (2 steps):
      1. Profile: display name, tagline, bio, slug (defaults to GitHub username)
      2. Donation Settings: minimum amount, suggested amounts, custom message
  → Onboarding complete:
      → POST /api/v1/keys (create OpenRouter key with $0 limit)
      → Show key to developer ONCE with copy button
      → Store key hash in DB
      → Mark onboarding_completed = true
  → /dashboard (overview: balance $0.00, share your profile link)

  → Returning user? → /dashboard
```

Onboarding grows per phase:
- Phase 2 adds: featured repos selection (auto-synced from GitHub)
- Phase 3 adds: badge setup (copy Markdown/HTML for README)

### Developer Daily Use
```
/dashboard
  → See balance ($X.XX available, synced from OpenRouter hourly)
  → See setup instructions (base URL + key reminder)
  → /dashboard/transactions → See donation history
  → /dashboard/supporters → See who funded you
  → Share profile link to get more funding
```

### Donor Journey
```
Discovery: GitHub badge click / direct URL / /explore search
  → /[slug] — Public profile page (SSR)
      Shows: developer info, repos, supporter count, donation widget
  → Choose amount ($5 / $10 / $25 / custom, minimum from profile settings)
  → Enter name + email (optional: anonymous)
  → Stripe Elements (card / Apple Pay / Google Pay)
  → Client creates PaymentIntent via POST /api/payments/intent
  → Stripe processes payment
  → Client shows success state: "You funded $X in AI tokens for [developer]!"

  → (Background) Stripe webhook fires → POST /api/webhooks/stripe:
      1. Validate signature (stripe.webhooks.constructEvent with raw body)
      2. Check idempotency: INSERT INTO webhook_events (event_id) — if duplicate, return 200
      3. Extract: amount, stripe_fee from PaymentIntent
      4. Calculate: platform_fee = amount × 0.05; net = amount - stripe_fee - platform_fee
      5. BEGIN transaction:
         a. INSERT INTO transactions (type='donation_received', amount=net, ...)
         b. UPDATE balances SET available_balance += net, lifetime_received += net
         c. UPSERT donation_supporters (increment total_donated_usd, donation_count)
         d. UPDATE profiles SET total_supporters = (SELECT COUNT...), total_received_usd += net
         e. PATCH OpenRouter key: { limit: new_available_balance }
         f. INSERT INTO notifications (type='donation_received', ...)
      6. COMMIT
      7. Return 200

  → If Stripe payment fails:
      → Client shows error in payment form (Stripe Elements handles this)
      → No webhook fires, no balance change
```

### Webhook Failure Recovery
```
If our webhook handler crashes mid-processing:
  → Stripe retries the webhook (up to ~16 times over 3 days)
  → Idempotency check (webhook_events.event_id UNIQUE) prevents double-processing
  → If event was partially processed (e.g., balance credited but key not updated):
      → Hourly reconciliation cron detects drift between balance and OpenRouter key limit
      → Auto-corrects by PATCHing the key limit to match balance
```

### Key Revocation Flow
```
Developer clicks "Revoke Key" in /dashboard/api-keys:
  → PATCH OpenRouter key: { disabled: true }
  → UPDATE proxy_api_keys SET is_active = false, revoked_at = NOW()
  → Key immediately stops working at OpenRouter
  → Balance is preserved (can create a new key with same limit)

Developer creates replacement key:
  → POST OpenRouter /api/v1/keys { limit: current_balance }
  → Show new key ONCE
  → Store new key hash
```

### Zero Balance State
```
Developer's OpenRouter key limit reaches $0:
  → OpenRouter rejects requests with 402
  → Hourly sync updates our balance to $0.00
  → Dashboard shows: "Out of credits" banner
      → "Share your profile to get funded" with copy-link button
      → Link to /[slug] (their public profile)
  → Developer's public profile still works (donors can still donate)
  → On next donation → key limit auto-increases via webhook
```

---

## Implementation Phases

### Phase 1: Core Loop

**Exit criteria**: Donor visits `/[slug]`, pays $10. Developer's OpenRouter key limit increases by ~$8.91. Developer makes an AI API call directly to OpenRouter using that key. It works.

**What ships**:
- Stripe PaymentIntent creation + webhook processing
- Developer balance crediting (with 5% platform fee deduction)
- OpenRouter key provisioning via Management API (create on onboarding, update limit on donation)
- Hourly usage sync cron (read key usage from OpenRouter, update our balance records)
- Public profile page with donate widget (Stripe Elements)
- Post-payment success state in the donate widget
- Dashboard: overview, balance, transactions, API key display, supporters
- 2-step onboarding wizard (profile + donation settings + key creation)
- Landing page
- Reconciliation cron (daily: compare our balances vs OpenRouter key limits, correct drift)

**Migration**: `001_core_loop.sql`

New tables:
- `provisioned_keys` — Maps developers to OpenRouter key hashes (replaces `proxy_api_keys`)
- `donation_supporters` — Donor-to-recipient relationships for supporter wall

Column additions:
- `users`: add `role VARCHAR(20) DEFAULT 'user'`
- `profiles`: add `total_supporters INTEGER DEFAULT 0`, `total_received_usd DECIMAL(10,2) DEFAULT 0.00`
- `transactions`: add `platform_fee DECIMAL(10,2)`

Schema cleanup:
- `DROP TABLE openrouter_keys` (superseded)

**Files to create/modify**:
```
CREATE  src/lib/db/migrations/001_core_loop.sql
CREATE  src/lib/stripe/client.ts                     — Stripe SDK init
CREATE  src/lib/stripe/webhooks.ts                   — Signature validation + event dispatch
CREATE  src/lib/openrouter/client.ts                 — OpenRouter Management API wrapper
CREATE  src/lib/openrouter/keys.ts                   — Key provisioning: create, update limit, disable, read usage
CREATE  src/types/platform.ts                        — ProvisionedKey, DonationSupporter types
CREATE  src/types/schemas.ts                         — Zod schemas for API input validation
MODIFY  src/types/transaction.ts                     — Add 'platform_fee_collected' to TransactionType
CREATE  src/app/page.tsx                             — Landing page (rewrite)
CREATE  src/app/[slug]/page.tsx                      — Public profile + donate widget (SSR)
CREATE  src/components/donate-widget.tsx              — Stripe Elements donate form (client component)
CREATE  src/app/dashboard/layout.tsx                 — Dashboard shell with sidebar nav
CREATE  src/app/dashboard/page.tsx                   — Overview: balance + recent activity + key info
CREATE  src/app/dashboard/onboarding/page.tsx        — 2-step wizard + key provisioning
CREATE  src/app/dashboard/profile/page.tsx           — Profile editor
CREATE  src/app/dashboard/balance/page.tsx           — Balance details + usage (from OpenRouter sync)
CREATE  src/app/dashboard/transactions/page.tsx      — Transaction history (donations)
CREATE  src/app/dashboard/api-keys/page.tsx          — Key display + revoke + regenerate
CREATE  src/app/dashboard/supporters/page.tsx        — Supporter list
CREATE  src/app/api/payments/intent/route.ts         — POST: create Stripe PaymentIntent
CREATE  src/app/api/webhooks/stripe/route.ts         — POST: Stripe webhook handler
CREATE  src/app/api/profile/route.ts                 — GET: own profile
CREATE  src/app/api/profile/update/route.ts          — PATCH: update profile
CREATE  src/app/api/profile/slug-check/route.ts      — GET: check slug availability
CREATE  src/app/api/balance/route.ts                 — GET: own balance
CREATE  src/app/api/transactions/route.ts            — GET: transaction history
CREATE  src/app/api/api-keys/route.ts                — GET: key info, POST: create key, DELETE: revoke key
CREATE  src/app/api/public/profile/[slug]/route.ts   — GET: public profile data
CREATE  src/app/api/cron/usage-sync/route.ts         — POST: sync key usage from OpenRouter (hourly)
CREATE  src/app/api/cron/reconcile/route.ts          — POST: reconcile balance vs key limits (daily)
MODIFY  src/app/api/auth/github/callback/route.ts    — Redirect new users to /dashboard/onboarding
CREATE  vercel.json                                  — Cron schedules
```

---

### Phase 2: GitHub Integration & Discovery

**Exit criteria**: Developer's profile shows real GitHub repos and contribution data. Supporters can browse `/explore` and search by language or topic.

**What ships**:
- GitHub repo sync via Octokit REST (on login + every 6h via cron)
- GitHub contribution graph via GraphQL
- AI bio generation (GPT-4o-mini based on repos + README content)
- `/explore` discovery page with full-text search (PostgreSQL tsvector)
- Dashboard repo management (feature/unfeature repos)
- Onboarding step addition: featured repos selection

**Migration**: `002_github_discovery.sql`

Column additions:
- `profiles`: add `search_vector tsvector` + GIN index
- `profiles`: add `ai_generated_bio_source JSONB`

**New routes**:
```
POST /api/github/sync
GET  /api/github/repos
GET  /api/github/contributions
POST /api/profile/bio-generate
GET  /api/search                    ?q=&language=&sort=
POST /api/cron/github-sync          (every 6h)

/explore
/dashboard/repos
```

---

### Phase 3: Attribution & Badges

**Exit criteria**: Developer adds a badge to a repo README. Dashboard shows click analytics by source and repo.

**What ships**:
- `/badge/[slug].svg` — Dynamic SVG badge (shields.io style, `#6366f1`)
- `/badge/[slug]/click` — Click tracking + 302 redirect
- Dashboard badge generator (Markdown/HTML snippets, per-repo variants)
- Profile view and badge click analytics with charts (recharts)
- Onboarding step addition: badge setup

**Migration**: `003_attribution.sql`

New table: `profile_views`

**Badge specification**:
```
GET /badge/[slug].svg
  Content-Type: image/svg+xml
  Cache-Control: public, max-age=3600

  ┌──────────────────────────────────────────────┐
  │  buymetokens  │  fund with AI tokens         │
  └──────────────────────────────────────────────┘
  Left: #555 (gray)   Right: #6366f1 (indigo-500)
```

Embed code:
```markdown
[![BuyMeTokens](https://buymetokens.dev/badge/yourslug.svg)](https://buymetokens.dev/badge/yourslug/click?ref=badge&repo=owner/repo)
```

**New routes**:
```
GET /badge/[slug].svg
GET /badge/[slug]/click             ?ref=badge&repo=owner/repo
GET /api/analytics/badge-clicks
GET /api/analytics/profile-views

/dashboard/badges
```

---

### Phase 4: Recurring Support

**Exit criteria**: Donor sets up $10/month. Developer auto-credited monthly. Donor cancels without an account via tokenized link.

**What ships**:
- Stripe subscriptions (monthly billing cycle)
- Recurring toggle on donate widget
- `invoice.paid` webhook → credit balance + update key limit
- `customer.subscription.deleted` webhook → update status
- `/manage-subscription?token=[jwt]` — No-login cancel/manage page
- Dashboard supporter list shows recurring vs one-time

**Migration**: `004_recurring.sql`

New table: `stripe_subscriptions`

**New routes**:
```
POST /api/payments/subscription
POST /api/webhooks/stripe                (extend: invoice.paid, subscription.deleted)

/manage-subscription
```

---

### Phase 5: Notifications & Polish

**Exit criteria**: Production-ready UX. Transactional emails sending. Mobile responsive. Dark mode.

**What ships**:
- `resend` package: donation receipt (to donor), funding notification (to developer), low balance alert
- Low balance alert cron (hourly: developers with `limit_remaining` < $1 and who opted in)
- Dark mode (`dark:` Tailwind classes)
- Mobile responsive polish
- OpenGraph meta tags for profile pages
- Email preferences in settings

**Migration**: `005_notifications.sql`

Column addition: `users.email_notifications BOOLEAN DEFAULT true`

**New routes**:
```
GET  /api/notifications
POST /api/notifications/read
POST /api/cron/low-balance-alerts    (hourly)

/dashboard/notifications
/dashboard/settings
```

---

### Phase 6: Admin Panel

**Exit criteria**: Operators can manage users, monitor key provisioning, and handle support without DB access.

**What ships**:
- Admin role (`users.role = 'admin'`) + middleware (already added)
- User management: view, deactivate, adjust balance/key limit
- Key health overview: list all provisioned keys, their limits, usage
- Transaction search across all users
- Stripe reconciliation cron (daily)

**New routes**:
```
GET  /api/admin/users
GET  /api/admin/keys
GET  /api/admin/transactions
POST /api/cron/stripe-reconcile      (daily)

/admin/
/admin/users
/admin/keys
/admin/transactions
```

---

## Database Schema

### Existing Tables (in `src/lib/db/schema.sql`)

```
users                 — Accounts, GitHub OAuth data, role
profiles              — Public showcase pages, slug, settings
balances              — USD balance per developer (synced from OpenRouter key limit_remaining)
transactions          — Donation records
github_repos          — Cached repo data from GitHub
github_contributions  — Contribution graph data
api_usage_logs        — Usage data (synced from OpenRouter, not real-time)
notifications         — In-app notifications
webhook_events        — Idempotency tracking for Stripe/GitHub webhooks
```

Note: `openrouter_keys` exists in base schema — dropped in `001_core_loop.sql`.

### Phase 1 Additions (`001_core_loop.sql`)

**`provisioned_keys`** — Maps developers to their OpenRouter key hashes
```sql
CREATE TABLE provisioned_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  key_name VARCHAR(255) NOT NULL DEFAULT 'Default',
  openrouter_key_hash VARCHAR(255) UNIQUE NOT NULL,  -- hash from OpenRouter's response
  key_prefix VARCHAR(20) NOT NULL,                   -- e.g. 'sk-or-...c123' for display
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMP,                          -- last usage sync from OpenRouter
  synced_limit_remaining DECIMAL(10,4) DEFAULT 0.00, -- cached from OpenRouter
  synced_usage DECIMAL(10,4) DEFAULT 0.00,           -- cached from OpenRouter
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP
);
CREATE UNIQUE INDEX idx_provisioned_keys_hash ON provisioned_keys(openrouter_key_hash);
CREATE INDEX idx_provisioned_keys_user ON provisioned_keys(user_id, is_active);
```

**`donation_supporters`** — Aggregated donor-to-recipient relationships
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

Column additions:
```sql
ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user';

ALTER TABLE profiles
  ADD COLUMN total_supporters INTEGER DEFAULT 0,
  ADD COLUMN total_received_usd DECIMAL(10,2) DEFAULT 0.00;

ALTER TABLE transactions ADD COLUMN platform_fee DECIMAL(10,2);

-- Cleanup
DROP TABLE IF EXISTS openrouter_keys;
```

### Phase 3 (`003_attribution.sql`)

```sql
CREATE TABLE profile_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  ref_source VARCHAR(100),
  ref_repo VARCHAR(255),
  visitor_country VARCHAR(2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_profile_views_profile ON profile_views(profile_id, created_at DESC);
```

### Phase 4 (`004_recurring.sql`)

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

## Security & Reliability

### Key Security
- Platform never stores the OpenRouter key plaintext. Only the `hash` (from OpenRouter's response) is stored.
- The key is shown to the developer once at creation (same as how OpenRouter's own dashboard works).
- Keys disabled instantly via OpenRouter Management API on revocation.
- OpenRouter enforces per-key spending limits — platform cannot overspend.

### Webhook Security
- All Stripe webhooks validated via `stripe.webhooks.constructEvent()` with `STRIPE_WEBHOOK_SECRET`.
- **Idempotency**: Every webhook handler checks `webhook_events.event_id` (UNIQUE constraint) before processing. If the event exists, return 200 without reprocessing.
- Webhook route must use `request.text()` (not `request.json()`) for raw body signature verification.
- Stripe retries failed webhooks for up to 3 days. Combined with idempotency, this makes the system self-healing.

### Balance ↔ Key Limit Consistency
- **On donation**: Balance and key limit updated in the same webhook handler. If the OpenRouter PATCH fails, the transaction is rolled back and the webhook returns 500 (Stripe will retry).
- **Hourly sync**: Cron reads `limit_remaining` from OpenRouter and updates `balances.available_balance`. This corrects any drift.
- **Daily reconciliation**: Compares `SUM(balances.available_balance)` against sum of all keys' `limit_remaining`. Flags discrepancies for admin review.
- **Edge case — donation while developer is actively using API**: The PATCH to increase the limit is atomic on OpenRouter's side. If a request is in-flight, OpenRouter handles the concurrency.

### Rate Limiting
- OpenRouter enforces its own rate limits per key.
- Platform rate limits only needed on platform's own API routes (profile updates, payment intents, etc.) — standard Next.js middleware, not proxy-level.
- Phase 5 adds Redis-backed rate limiting for public-facing routes.

### Failure Modes

| Failure | Impact | Recovery |
|---------|--------|----------|
| OpenRouter Management API down | Can't create keys or update limits | Queue limit updates, retry via cron |
| Stripe webhook delivery fails | Developer not credited | Stripe retries for 3 days; idempotency prevents double-credit |
| Usage sync cron fails | Dashboard shows stale balance | Next hourly run catches up; no functional impact (OpenRouter still enforces limits) |
| OpenRouter key compromised | Attacker uses developer's credits | Developer revokes from dashboard; limited to that key's remaining balance |
| Platform DB down | Dashboard inaccessible | API calls still work (OpenRouter handles them independently) |

### Reserved Slugs
Profile slugs validated against deny list:
`admin`, `api`, `explore`, `dashboard`, `badge`, `manage-subscription`, `login`, `logout`, `privacy`, `terms`, `u`, `proxy`, `cron`, `webhooks`

---

## Complete Route Map (All Phases)

### Public Pages
```
/                          Landing page                              Phase 1
/[slug]                    Public profile + donate widget (SSR)      Phase 1
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
/dashboard                 Overview: balance + key info + activity   Phase 1
/dashboard/onboarding      2-step wizard + key provisioning          Phase 1
/dashboard/profile         Profile editor                            Phase 1
/dashboard/balance         Balance + usage (synced from OpenRouter)  Phase 1
/dashboard/transactions    Donation history                          Phase 1
/dashboard/api-keys        Key display + revoke + regenerate         Phase 1
/dashboard/supporters      Supporter list                            Phase 1
/dashboard/repos           GitHub repo management                    Phase 2
/dashboard/badges          Badge generator + analytics               Phase 3
/dashboard/notifications   Notification inbox                        Phase 5
/dashboard/settings        Account settings                          Phase 5
```

### API Routes
```
# Auth (existing)
GET  /api/auth/github                                               Done
GET  /api/auth/github/callback                                      Done
GET  /api/auth/session                                              Done
POST /api/auth/logout                                               Done

# Profile                                                           Phase 1
GET   /api/profile
PATCH /api/profile/update
GET   /api/profile/slug-check
POST  /api/profile/bio-generate                                     Phase 2

# Payments                                                          Phase 1
POST /api/payments/intent

# Webhooks                                                          Phase 1
POST /api/webhooks/stripe

# Balance + Transactions                                            Phase 1
GET /api/balance
GET /api/transactions

# API Keys (OpenRouter provisioned)                                 Phase 1
GET    /api/api-keys                 — key info (masked)
POST   /api/api-keys                 — provision new key
DELETE /api/api-keys                 — revoke + disable at OpenRouter

# Public Profile                                                    Phase 1
GET /api/public/profile/[slug]

# GitHub                                                            Phase 2
POST /api/github/sync
GET  /api/github/repos
GET  /api/github/contributions

# Search                                                            Phase 2
GET /api/search

# Analytics                                                         Phase 3
GET /api/analytics/badge-clicks
GET /api/analytics/profile-views

# Subscriptions                                                     Phase 4
POST /api/payments/subscription

# Notifications                                                     Phase 5
GET  /api/notifications
POST /api/notifications/read

# Cron (secured by CRON_SECRET header)
POST /api/cron/usage-sync            (hourly)                       Phase 1
POST /api/cron/reconcile             (daily)                        Phase 1
POST /api/cron/github-sync           (every 6h)                     Phase 2
POST /api/cron/low-balance-alerts    (hourly)                       Phase 5
POST /api/cron/stripe-reconcile      (daily)                        Phase 6

# Admin (role-protected)                                            Phase 6
GET  /api/admin/users
GET  /api/admin/keys
GET  /api/admin/transactions
```

---

## Environment Variables

```bash
# Core (existing)
DATABASE_URL=postgresql://...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
SESSION_SECRET=...                       # 32+ char random string
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Phase 1
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
OPENROUTER_MANAGEMENT_KEY=sk-or-...      # Management API key (NOT a regular API key)
PLATFORM_FEE_PERCENT=5
CRON_SECRET=...                          # Vercel sets automatically

# Phase 5
RESEND_API_KEY=re_...
```

---

## Resolved Decisions

| Decision | Resolution | Rationale |
|----------|------------|-----------|
| Token delivery method | Provisioned OpenRouter keys | Zero financial risk. OpenRouter enforces spending limits. No proxy needed. |
| Why not proxy? | Platform would front real money on every call | Proxy = unsecured credit provider. Provisioned keys = OpenRouter enforces limits. |
| Which providers? | OpenRouter only | Covers 200+ models. Developer talks to OpenRouter directly. |
| Donor account required? | No | Email only for receipts. Subscriptions via signed JWT link. |
| Stripe Connect? | No | Platform is single merchant. Developers receive API credits, not cash. |
| Balance tracking | Our DB synced from OpenRouter hourly | Source of truth is OpenRouter's `limit_remaining`. Our DB is a cache for dashboard display. |
| Rate limiting | OpenRouter handles API rate limits; platform handles its own routes | No proxy = no proxy rate limiting needed. |
| Cursor support? | Deferred indefinitely | No reseller API. |
