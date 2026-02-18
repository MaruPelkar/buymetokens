# BuyMeTokens

BuyMeACoffee for AI API credits. Supporters pay USD via Stripe; developers receive a provisioned OpenRouter key with a USD spending limit they can use immediately — no proxy, no middleman on API calls.

```
Supporter pays $10
  → Stripe fee ~$0.59 + platform fee $0.50
  → Developer balance: $8.91
  → OpenRouter key spending limit raised by $8.91
  → Developer makes AI calls directly to OpenRouter using their key
```

---

## How It Works

1. **Developer signs up** with GitHub, runs a 2-step onboarding wizard, gets a provisioned OpenRouter key (shown once)
2. **Supporter visits** `/{slug}`, chooses an amount, pays with a card (no account needed)
3. **Balance credited instantly** — the platform updates the developer's OpenRouter key spending limit via the Management API
4. **Developer builds** by pointing their existing OpenAI-compatible code at OpenRouter with their key

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router), TypeScript |
| Styling | Tailwind CSS |
| Database | PostgreSQL 16 |
| Auth | GitHub OAuth + iron-session |
| Payments | Stripe (PaymentIntents + Webhooks) |
| AI credits | OpenRouter Provisioned Keys (Management API) |
| Deployment | Vercel (app) + Docker (local dev) |

---

## Getting Started

### Option A — Docker (recommended, zero local dependencies)

```bash
git clone <repo>
cd buymetokens
cp .env.example .env.docker
# Fill in .env.docker — see DOCKER.md for what each value means
docker compose --env-file .env.docker up
```

First boot takes ~90 seconds (PostgreSQL initialises, `npm ci` runs inside the container). Subsequent boots are under 10 seconds. Hot reload works.

See **[DOCKER.md](./DOCKER.md)** for the full guide: adding packages, Stripe CLI setup, triggering crons, resetting the database.

### Option B — Native dev

**Prerequisites**: Node.js 20+, PostgreSQL 16+

```bash
cp .env.example .env.local
# Fill in all values in .env.local

npm install

# Apply database schema + migration
psql $DATABASE_URL < src/lib/db/schema.sql
psql $DATABASE_URL < src/lib/db/migrations/001_core_loop.sql

npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For Stripe webhooks: `stripe listen --forward-to localhost:3000/api/payments/webhook`

---

## Environment Variables

Copy `.env.example` and fill in:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | 32-char secret — `openssl rand -base64 32` |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | From https://github.com/settings/developers |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` / `STRIPE_SECRET_KEY` | From Stripe Dashboard (use test keys for dev) |
| `STRIPE_WEBHOOK_SECRET` | From `stripe listen` output |
| `OPENROUTER_MANAGEMENT_KEY` | Management key from https://openrouter.ai/settings/keys |
| `CRON_SECRET` | `openssl rand -hex 32` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` for local dev |

---

## Project Structure

```
src/
├── app/
│   ├── [slug]/               Public profile + donate widget (SSR)
│   ├── api/
│   │   ├── auth/             GitHub OAuth (callback, session, logout)
│   │   ├── payments/         Stripe PaymentIntent creation
│   │   ├── webhooks/stripe/  Webhook handler (idempotent)
│   │   ├── profile/          Profile CRUD + slug availability check
│   │   ├── balance/          Balance query (joins provisioned_keys)
│   │   ├── transactions/     Paginated transaction history
│   │   ├── api-keys/         Provisioned key create/list/revoke
│   │   ├── public/           Unauthenticated profile data
│   │   └── cron/             Usage sync + reconcile (CRON_SECRET gated)
│   └── dashboard/
│       ├── page.tsx          Overview: balance, quick setup, recent activity
│       ├── onboarding/       2-step wizard → key provisioning
│       ├── profile/          Profile editor
│       ├── balance/          Balance + setup instructions
│       ├── transactions/     Paginated table
│       ├── api-keys/         Key display (shown once on creation) + revoke
│       └── supporters/       Donor list
├── components/
│   ├── donate-widget.tsx     Multi-step Stripe payment flow (client)
│   ├── dashboard/Sidebar.tsx Active-link sidebar nav
│   └── ui/                   Button, Input, Card, Textarea
├── lib/
│   ├── auth/                 GitHub OAuth + iron-session
│   ├── db/                   pg Pool, transaction helper, schema + migrations
│   ├── stripe/               SDK init + webhook handler
│   └── openrouter/           Management API client + key operations
└── types/
    ├── schemas.ts            Zod validation schemas for all API inputs
    ├── platform.ts           ProvisionedKey, DonationSupporter types
    ├── user.ts               User, Profile types
    └── transaction.ts        Transaction types
```

---

## Architecture

Full technical architecture, phase roadmap, and design decisions: **[docs/architecture.md](./docs/architecture.md)**

---

## Phase Status

| Phase | Description | Status |
|-------|-------------|--------|
| Foundation | GitHub OAuth, session, DB pool, middleware | ✅ Complete |
| 1 | Core loop: donate → balance → OpenRouter key limit | ✅ Complete |
| 2 | GitHub repo sync + `/explore` discovery page | Planned |
| 3 | Badge generator + click tracking | Planned |
| 4 | Recurring donations (Stripe subscriptions) | Planned |
| 5 | Email notifications (Resend) | Planned |
| 6 | Admin panel | Planned |

---

## License

MIT
