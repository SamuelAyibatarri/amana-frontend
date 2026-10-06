<div align="center">

<img src="./public/logo.svg" alt="Amana logo" height="64" />

# Amana Frontend

Web app + ledger API for Amana — WhatsApp-native wallet with Paystack on-ramp and Solana devnet settlement.

Companion to [`amana-backend-azure`](../amana-backend-azure) — the backend owns chat, signing, and chain; this service owns identity, ledger, and webhooks.

</div>

## Overview

Amana lets users transact in plain WhatsApp chat: buy SOL/USDC with naira, send to phone numbers or Solana addresses, request money, check balance. This Next.js app provides the landing page, sign-in, mock KYC, dashboard (PIN + profile), public receipts, and every ledger/payment API the bot calls.

Stack: Next.js 16 + React 19 on Cloudflare Workers (OpenNext), D1 + Drizzle ORM, Better Auth magic-link over WhatsApp, Paystack test mode.

```
WhatsApp bot (backend) ──SHARED_SECRET──▶ this worker
  /api/transfers/*  → D1 ledger (provision, credit, balance, sums, history, withdraw)
  /api/payments/*   → Paystack initialize / webhook / manual check
  /api/auth/*       → magic-link request, session
  /api/kyc/*, /api/pin/*, /api/requests/*, /api/prices, /api/mirror
Paystack webhook ──HMAC-SHA512──▶ /api/webhooks/paystack ──delegate──▶ backend /buy/settle
```

> [!NOTE]
> Hackathon build for Superteam Nigeria. KYC is mocked (any 11-digit BVN + NIN passes), funds live on Solana devnet, Paystack runs test mode — no real money moves.

## Features

- **Landing + onboarding** — hero, how-it-works, wa.me deep links, QR card, token handler for magic-link callbacks.
- **Passwordless auth** — Better Auth magic-link plugin; `sendMagicLink` delivers via backend `/whatsapp/send` relay. Identity = phone-derived `…@amana.whatsapp`.
- **Mock KYC** — pure `lib/kyc.ts` rule; `/kyc` form + `/api/kyc/*`; dashboard gated on `verified`.
- **Transaction PIN** — PBKDF2-SHA256 (210k, per-user salt + `PIN_PEPPER`), 4-digit, 5-miss 15-min lock, 6-digit WhatsApp OTP reset flow.
- **Ledger API** — D1 `transfer`/`payment` tables, minor-unit amounts (lamports / micro-USDC / kobo), idempotent fund/credit on Paystack `reference`, net sums for proof-of-liability.
- **Paystack funnel** — `initialize` → `charge.success` webhook (raw-body verify, unknown refs acked) → `delegateSettle` to backend → manual `/payments/check` for "I've paid".
- **Money requests** — create/respond/cancel/mine/sweep, 7-day expiry, 24h nudge, blocklist, `open|contacts|blocked` privacy.
- **Public receipts** — `/receipt/[id]`, masked phones, no login; QR on bot images links here.
- **Bot operator APIs** — `clearance`, `balance`, `sums`, `mirror` for backend gates and `/health/mirror`.

## Prerequisites

- Node 20+ or Bun
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (ships as dev dep)
- Cloudflare account with D1 (local D1 works offline)
- Paystack test secret (`sk_test_…`) for payments; empty = payments return clear 500
- Running backend for full chat loop (default `http://localhost:3001`)

## Getting started

```bash
npm install   # or bun install
```

Local env lives in `.dev.vars` (gitignored template below). Production secrets go via `wrangler secret put`, never `wrangler.jsonc` vars.

```bash
# .dev.vars
NEXTJS_ENV=development
BETTER_AUTH_URL=http://localhost:8787
FRONTEND_URL=http://localhost:8787
AZURE_BACKEND_URL=http://localhost:3001
BETTER_AUTH_SECRET=dev-better-auth-secret-change-me
SHARED_SECRET=dev-shared-secret-change-me   # must equal backend .env
PAYSTACK_SECRET_KEY=sk_test_…
WHATSAPP_BOT_NUMBER=2348088848220
PIN_PEPPER=<random-hex>
```

D1 setup:

```bash
npx drizzle-kit generate
npx wrangler d1 migrations apply amana-db --local   # repeat without --local for remote
```

## Run

```bash
npm run dev      # plain Next dev (no D1 binding — landing pages only)
npm run preview  # OpenNext Cloudflare build + local worker on :8787 (full API + D1)
npm run deploy   # OpenNext build + deploy to workers.dev
npm test         # vitest (paystack, webhook, kyc, pin, transfers, requests)
npm run lint
npm run cf-typegen  # regenerate cloudflare-env.d.ts after binding changes
```

> [!IMPORTANT]
> Use `preview` (not `dev`) for anything touching D1/auth/ledger — `getDb()` throws outside the Workers runtime. `SHARED_SECRET` must match the backend or bot calls 401.

## API

Guard: bot routes require `x-amana-secret: SHARED_SECRET`. Paystack webhook requires `x-paystack-signature` HMAC-SHA512.

| Route | Purpose |
|-------|---------|
| `POST /api/auth/request-link` | Mint magic link, deliver via WhatsApp relay |
| `POST /api/auth/*` | Better Auth handler (session, verify) |
| `POST /api/kyc/verify` / `GET /api/kyc/status` | Mock BVN+NIN check |
| `POST /api/pin/set|verify|forgot|reset` / `GET /api/pin/status` | PIN lifecycle + OTP reset |
| `GET /api/profile` | Viewer + KYC + defaults |
| `POST /api/payments/initialize` | Paystack checkout (bot buy flow) |
| `POST /api/webhooks/paystack` | Charge verify → D1 update → delegate settle |
| `POST /api/payments/check` | Manual "I've paid" verify (Paystack verify API = truth) |
| `GET /api/payments/mine|status` | User payment history / reference status |
| `POST /api/transfers/credit|fund|withdraw` | Bot ledger writes (idempotent) |
| `GET /api/transfers/balance|history|sums` | Bot reads + invariant inputs |
| `POST /api/requests/create|respond|cancel` / `GET /api/requests/mine` / `POST /api/requests/sweep` | Money-request lifecycle |
| `GET /api/prices` | Cached quote passthrough |
| `GET /api/mirror` | Mirror pool config for backend |
| `GET /api/balance/mine` | Dashboard balance |
| `GET /receipt/[id]` | Public receipt page |

Pages: `/` landing, `/signin`, `/kyc`, `/dashboard` (verified-only), `/receipt/[id]`.

## Configuration

| Var | Where | Purpose |
|-----|-------|---------|
| `BETTER_AUTH_SECRET` | secret | Session signing |
| `SHARED_SECRET` | secret | Bot relay guard, must match backend |
| `PAYSTACK_SECRET_KEY` | secret | Webhook verify + API calls (`sk_test_`) |
| `PIN_PEPPER` | secret | Server pepper for PIN/OTP hashes |
| `BETTER_AUTH_URL` / `FRONTEND_URL` | var | Canonical URLs (magic links, receipts, QR) |
| `AZURE_BACKEND_URL` | var/`.dev.vars` | Backend base for settle + WhatsApp relay |
| `WHATSAPP_BOT_NUMBER` | var | Public wa.me routing number |
| D1 `amana_db` | binding | `amana-db`, migrations in `./drizzle` |

## Project structure

```
src/app/              → pages (page, signin, kyc, dashboard, receipt/[id]) + api/* routes
src/components/      → Hero, Navbar, Dashboard, KycForm, PinForm, SignInForm, ChatDemoCard, …
src/lib/              → auth.ts, db.ts, gate.ts, kyc.ts, pin.ts, paystack.ts, webhook.ts, settle.ts, notify.ts
src/db/schema.ts      → user, session, account, verification, kyc_profile, payment, transfer, money_request, request_block
drizzle/              → D1 migrations (migrations_dir in wrangler.jsonc)
wrangler.jsonc        → worker entry .open-next/worker.js, d1 binding, vars
open-next.config.ts   → Cloudflare adapter
```

Schema notes: `payment.reference` unique (once-only crediting); `transfer.amountMinor` in smallest units; `money_request` stores execution-ready crypto minor + display `sendNgn`.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `D1 binding 'amana_db' is missing` | Use `npm run preview`, not `next dev` |
| Bot calls 401 | `SHARED_SECRET` drift between `.dev.vars` and backend `.env` |
| `Payments are not configured` (500) | `PAYSTACK_SECRET_KEY` empty — set test key |
| Webhook 401 `Invalid signature` | Wrong secret or body re-serialized — verify raw body HMAC-SHA512 |
| Magic link never arrives | `AZURE_BACKEND_URL` down or relay secret wrong; check backend `/whatsapp/send` logs |
| Dashboard loops signin → kyc | `getViewer()` null/pending — sign in via fresh WhatsApp link, then verify |
| `PIN_PEPPER missing` | Set in `.dev.vars` / secrets; legacy unprefixed hashes must re-set PIN |

## Tech stack

Next.js · React · Tailwind v4 · OpenNext Cloudflare · D1 + Drizzle · Better Auth + magic-link · Paystack · jose · GSAP · Vitest

Related: [`amana-backend-azure`](https://github.com/SamuelAyibatarri/amana-backend-azure) — Baileys bot, Gemini intents, Solana devnet treasury + mirror pools, receipt PNGs.
