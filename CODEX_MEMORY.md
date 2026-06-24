# AILIS Commercial Runtime Worktree

This repository checkout is the dedicated commercial-version worktree for AILIS.

## Use This Worktree

- Worktree path: `F:\AIGril_commerce_runtime`
- Branch: `codex/ailis-commerce-runtime`
- Remote branch: `origin/codex/ailis-commerce-runtime`
- Base commit: `9d18171 add AILIS commerce runtime backend`

Future Codex work on account, membership, Stripe payment, character commerce, credit ledger, entitlement, and official streaming gateway features should happen here.

Do not continue commercial-runtime development in `F:\AIGril_auth_deploy` or directly on `main` unless the user explicitly asks for that.

## Product Boundary

AILIS should sell character experience and runtime value, not raw API resale.

Commercial objects are separated:

- Entitlements: owned assets such as character packs, skins, motions, expressions, voice packs, persona packs, and scenes.
- Credits: consumable usage for official LLM/TTS gateway calls.
- Membership: account and payment state that can unlock API access, customer portal, and future plan features.

Keep entitlement and credit accounting separate. Do not merge them into one membership flag.

## Current Implemented Surface

Frontend:

- `index.html` is the commercial runtime dashboard.
- `about-ailis.html` redirects to `./` for old-link compatibility.
- GitHub Pages production homepage: `https://haowenguo.github.io/AIGril/`
- Experience page remains: `https://haowenguo.github.io/AIGril/Test/`

Backend:

- Account APIs are mounted under `/api/account/*`.
- Stripe APIs are mounted under `/api/stripe/*`.
- Admin APIs are mounted under `/api/admin/*`.
- Commerce APIs are mounted under `/api/commerce/*`.
- Existing model/TTS APIs are gated by membership checks.

Commerce APIs:

- `GET /api/commerce/catalog`
- `GET /api/commerce/me`
- `GET /api/commerce/entitlements`
- `GET /api/commerce/credits`
- `POST /api/commerce/gateway/llm/stream`

Database models added:

- `AppUser`
- `AppSession`
- `AppPayment`
- `AppApiUsage`
- `AppAdminAuditLog`
- `CommerceEntitlement`
- `CreditLedgerEntry`

## Deployment Status

The current commercial dashboard has already been pushed to `main` once and deployed.

The dedicated commercial branch is now created so future changes can be developed, reviewed, and merged intentionally:

```text
codex/ailis-commerce-runtime
```

GitHub Pages deploy was verified after commit `9d18171`.

Render backend was verified:

- `GET https://airi-backend.onrender.com/healthz`
- `GET https://airi-backend.onrender.com/api/commerce/catalog`

## Secrets And Environment

Never write real API keys, Stripe secret keys, webhook secrets, provider keys, passwords, or tokens into tracked files.

Required production env vars live in Render or local `.env` only.

Important env vars:

- `APP_PASSWORD_PEPPER`
- `APP_ADMIN_EMAILS`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_PAYMENT_PRICE_ID`
- `STRIPE_SUBSCRIPTION_PRICE_ID`
- `STRIPE_WEBHOOK_SECRET`
- `AILIS_OFFICIAL_LLM_API_BASE`
- `AILIS_OFFICIAL_LLM_API_KEY`
- `AILIS_OFFICIAL_LLM_MODEL`
- `LLM_API_BASE`
- `LLM_API_KEY`
- `LLM_MODEL_NAME`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID`

Stripe was not fully configured at the time this branch was created:

```text
GET /api/stripe/config
configured: false
publishableKey: ""
modes.payment: false
modes.subscription: false
```

Before testing real embedded payment, configure Stripe keys, Price IDs, and webhook secret in Render.

## Local Run

Frontend:

```powershell
pnpm build
pnpm preview --host 127.0.0.1 --port 4173
```

Backend:

```powershell
$env:DEBUG='False'
$env:APP_SESSION_COOKIE_SECURE='False'
$env:APP_SESSION_COOKIE_SAMESITE='lax'
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Useful local checks:

```powershell
python -m compileall backend
Invoke-WebRequest http://127.0.0.1:8000/healthz -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:8000/api/commerce/catalog -UseBasicParsing
```

## Development Notes

- Prefer small, reviewable commits on `codex/ailis-commerce-runtime`.
- Keep `main` deployable.
- When adding commerce products, add product metadata first, then Stripe Price mapping and entitlement grants.
- The official streaming gateway must not expose provider keys to the browser.
- The gateway should check credits before streaming, stream chunks immediately, and settle/refund credits after the stream ends.
- Do not query the database for every streamed chunk.
- Do not store card details or payment method data in AILIS.
- Keep CORS locked to known frontends for production.

## Next Good Tasks

- Add Stripe product-to-entitlement mapping after real Price IDs are created.
- Add webhook handling for character packs and credit packs, not only membership.
- Add admin commerce tools for granting/revoking entitlements and credits.
- Add CSRF protection for cross-site cookie flows before public launch.
- Move production database from SQLite disk to Render Postgres before serious public traffic.
- Add migrations instead of relying only on `Base.metadata.create_all`.
