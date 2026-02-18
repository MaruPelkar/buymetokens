# Docker Development Guide

This guide explains how to run BuyMeTokens locally using Docker. The database is fully containerised — no local Postgres install needed. You only need API keys for the external services.

---

## Prerequisites

- **Docker Desktop** 4.x+ (or Docker Engine + Compose plugin v2)
- **A GitHub OAuth App** — create one at https://github.com/settings/developers
- **Stripe test keys** — from https://dashboard.stripe.com/apikeys
- **OpenRouter management key** — from https://openrouter.ai/settings/keys (use the management key, not a regular API key)
- **Stripe CLI** (optional, for testing payments locally) — https://stripe.com/docs/stripe-cli

---

## Quick Start

### 1. Copy the environment template

```bash
cp .env.example .env.docker
```

### 2. Fill in `.env.docker`

Open `.env.docker` and set all required values:

| Variable | How to get it |
|----------|--------------|
| `SESSION_SECRET` | `openssl rand -base64 32` |
| `GITHUB_CLIENT_ID` | GitHub OAuth app → Client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app → Client Secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard → Publishable key (test) |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Secret key (test) |
| `STRIPE_WEBHOOK_SECRET` | Run `stripe listen` (see below) |
| `OPENROUTER_MANAGEMENT_KEY` | OpenRouter → Settings → Keys |
| `CRON_SECRET` | `openssl rand -hex 32` |

**GitHub OAuth app settings:**
- Homepage URL: `http://localhost:3000`
- Authorization callback URL: `http://localhost:3000/api/auth/github/callback`

The `DATABASE_URL` is already correct for Docker — leave it as-is.

### 3. Start the environment

```bash
docker compose --env-file .env.docker up
```

**First boot** (~60–90 seconds):
1. PostgreSQL starts and applies the schema + migration automatically
2. `npm ci` runs inside the Linux container to install dependencies
3. Next.js dev server starts with hot reload

**Subsequent boots** (< 10 seconds):
- DB is already initialised — skipped
- `node_modules` stamp file detected — `npm ci` skipped
- Next.js starts immediately with cached build

### 4. Open the app

```
http://localhost:3000
```

---

## Common Commands

```bash
# Start in foreground (shows logs)
docker compose --env-file .env.docker up

# Start in background
docker compose --env-file .env.docker up -d

# View logs
docker compose logs -f app
docker compose logs -f db

# Stop containers (data persists)
docker compose down

# Stop and wipe the database — runs schema from scratch on next boot
docker compose down -v

# Open a PostgreSQL shell
docker compose exec db psql -U postgres -d buymetokens

# List tables
docker compose exec db psql -U postgres -d buymetokens -c '\dt'

# Run a one-off command in the app container
docker compose --env-file .env.docker run --rm app npm run lint
```

---

## Adding npm Packages

1. Edit `package.json` on your host machine as normal.
2. Restart the app container — the entrypoint script detects that `package.json` is newer than the stamp file and re-runs `npm ci`:

```bash
docker compose --env-file .env.docker restart app
```

Or force an immediate reinstall:

```bash
docker compose --env-file .env.docker run --rm app sh -c "npm ci && touch node_modules/.install-stamp"
```

---

## Stripe Webhooks in Local Dev

Stripe cannot push webhooks to `localhost`. Use the Stripe CLI to forward them:

```bash
# In a separate terminal (not inside Docker)
stripe listen --forward-to localhost:3000/api/payments/webhook
```

Copy the `whsec_...` webhook signing secret that the CLI prints and set it as `STRIPE_WEBHOOK_SECRET` in `.env.docker`, then restart the app container.

---

## Triggering Cron Jobs Manually

Vercel Cron runs the jobs automatically in production. In Docker dev, trigger them manually:

```bash
# Read CRON_SECRET from .env.docker
CRON_SECRET=$(grep '^CRON_SECRET=' .env.docker | cut -d= -f2)

# Sync OpenRouter usage limits → balance
curl -s -X POST http://localhost:3000/api/cron/usage-sync \
  -H "Authorization: Bearer $CRON_SECRET" | jq

# Daily reconciliation check
curl -s -X POST http://localhost:3000/api/cron/reconcile \
  -H "Authorization: Bearer $CRON_SECRET" | jq
```

---

## Database

The schema is applied automatically on first boot via PostgreSQL's init directory:

| Init file | Source |
|-----------|--------|
| `01_schema.sql` | `src/lib/db/schema.sql` |
| `02_migration.sql` | `src/lib/db/migrations/001_core_loop.sql` |

These files only run when the data directory is empty. On subsequent starts they are skipped.

**Reset the database to a clean state:**

```bash
docker compose down -v   # removes db_data volume
docker compose --env-file .env.docker up
```

---

## NEXT_PUBLIC_ Environment Variables

In dev (`npm run dev`), `NEXT_PUBLIC_` vars are read at runtime — passing them in `docker-compose.yml` is sufficient and changes take effect on the next page load.

In production Docker builds, these values are **baked into the JavaScript bundle at build time** and cannot be changed at runtime without rebuilding the image:

```bash
docker build \
  --build-arg NEXT_PUBLIC_APP_URL=https://buymetokens.dev \
  --build-arg NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx \
  -t buymetokens:prod \
  .
```

---

## Production Image

The `Dockerfile` uses a three-stage build (`deps` → `builder` → `runner`) with Next.js standalone output. The final image has no `node_modules` and runs as a non-root user.

Build and run locally to verify before deploying:

```bash
docker build \
  --build-arg NEXT_PUBLIC_APP_URL=http://localhost:3000 \
  --build-arg NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx \
  -t buymetokens:prod \
  .

docker run --rm -p 3000:3000 \
  --env-file .env.docker \
  buymetokens:prod
```

For Vercel deployment, no Docker is needed — push to `main` and Vercel builds automatically.
