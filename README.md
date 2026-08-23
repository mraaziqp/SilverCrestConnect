# Silver Crest Connect '26

Landing page, SME application funnel and PayFast payment engine for **Silver Crest Connect '26** —
an exclusive half-day B2B networking showcase presented by Silver Crest Consulting.

> **Building Business. Strengthening Community.**
> 24 October 2026 · 09:00–13:00 · Cape Town

15–20 vetted SME founders, R350 per business, and 100% of proceeds funding the Year-End Community
Outreach Drive.

---

## What this app does

| Area | Detail |
| --- | --- |
| **Landing page** | Hero → About → Programme → Tickets → Donate → Impact, on the poster's black/gold palette |
| **SME funnel** | Free application → team vetting → approval → PayFast payment → digital ticket |
| **Donations** | Custom-amount gateway open to non-attending supporters |
| **Payments** | PayFast custom integration with signed requests and fully validated ITN callbacks |
| **Dashboard** | `/admin` — PayFast config, live revenue, application review, payment ledger, CSV export |

---

## Quick start

```bash
npm install
cp .env.example .env    # then fill in the values below
npm run dev             # http://localhost:3000
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Express + Vite middleware, client hot-reloads |
| `npm run build` | Builds the client (`dist/`) and the server bundle (`dist/server.mjs`) |
| `npm start` | Runs the production server from `dist/` |
| `npm test` | Unit tests for the PayFast signing and currency formatting |
| `npm run lint` | `tsc --noEmit` |

---

## Configuration

Every value lives in `.env`, which is gitignored. **No credential is ever bundled into the client** —
the merchant key and passphrase stay server-side and the dashboard only ever shows a masked key.

| Variable | Required | Notes |
| --- | --- | --- |
| `APP_URL` | yes | Public base URL. PayFast builds its return/cancel/ITN URLs from this, so it must be the real HTTPS address in production. |
| `PAYFAST_MODE` | yes | `sandbox` or `live`. Defaults to `sandbox`. |
| `PAYFAST_MERCHANT_ID` | live only | From PayFast → Settings → Integration. |
| `PAYFAST_MERCHANT_KEY` | live only | Secret. Never commit. |
| `PAYFAST_PASSPHRASE` | recommended | Must match the passphrase set in the PayFast dashboard. |
| `ADMIN_TOKEN` | yes | Gates `/admin`. **If unset, the dashboard is disabled entirely.** |
| `DATA_DIR` | no | Where the JSON datastore is written. Defaults to `./data`. |
| `PAYFAST_SKIP_IP_CHECK` | no | Local testing only. Disables ITN source-IP verification. |
| `PAYFAST_SKIP_SERVER_CONFIRM` | no | Local testing only. Disables PayFast server confirmation. |

Generate an admin token with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Sandbox is safe by design

While `PAYFAST_MODE=sandbox`, the app **ignores your live merchant credentials** and uses PayFast's
public test merchant instead. A stray mode flip cannot move real money, and a test run cannot
accidentally hit the live account. The dashboard states this explicitly.

---

## Going live — checklist

1. Set `PAYFAST_MODE=live`.
2. Set `PAYFAST_MERCHANT_ID` and `PAYFAST_MERCHANT_KEY` from the PayFast dashboard.
3. Set a **security passphrase** in PayFast → Settings → Integration, and put the same value in
   `PAYFAST_PASSPHRASE`.
4. Set `APP_URL` to the live **HTTPS** domain.
5. Remove `PAYFAST_SKIP_IP_CHECK` and `PAYFAST_SKIP_SERVER_CONFIRM`.
6. Set a strong `ADMIN_TOKEN`.
7. Confirm the ITN URL is reachable from the public internet:
   `https://your-domain/api/payfast/itn`
8. Make one real R10 donation end-to-end and confirm it turns `COMPLETE` in `/admin`, then refund it
   from the PayFast dashboard.

Open `/admin` at any point — it lists every misconfiguration it can detect.

---

## How payment works

```
Applicant                 This server                    PayFast
   |                          |                             |
   |-- apply ---------------->| store PENDING_REVIEW        |
   |                          |                             |
   |         (team approves in /admin -> APPROVED)          |
   |                          |                             |
   |-- pay (reference) ------>| create Payment(PENDING)     |
   |                          | sign fields (server-side)   |
   |<-- signed form ----------|                             |
   |------------------- POST signed form ------------------>|
   |                          |                             |
   |<---------- redirect to /payment/return ----------------|
   |                          |<---- ITN callback ----------|
   |                          | verify: signature, source   |
   |                          | IP, amount, PayFast confirm |
   |                          | -> COMPLETE, issue ticket   |
   |-- poll status ---------->|                             |
```

**The browser return is never treated as proof of payment.** Only a fully verified ITN can mark a
payment complete, because a user can navigate to the return URL directly without paying. The return
page polls the server and shows "confirming…" until the callback lands.

### Testing ITN locally

PayFast cannot reach `localhost`, so a simulator stands in for it:

```bash
npx tsx scripts/simulate-itn.ts <m_payment_id> <amount>
```

```bash
npx tsx scripts/simulate-itn.ts TKT-ABC123 350.00 COMPLETE --tamper
```

The `--tamper` flag sends a deliberately invalid signature; the server must reject it and leave the
payment `PENDING`. To test against real PayFast callbacks, expose the server with a tunnel
(`cloudflared`, `ngrok`) and set `APP_URL` to the tunnel URL.

---

## Deploying

### Any Node host (Render, Railway, Fly, a VPS) — recommended

```bash
npm run build
npm start
```

The JSON datastore persists to `DATA_DIR`, so applications and payments survive restarts. Point
`DATA_DIR` at a mounted volume.

### Vercel

`vercel.json` builds the client to `dist/` and mounts the Express app as a serverless function at
`api/index.ts`.

> **Before taking live payments on Vercel:** serverless filesystems are ephemeral, so the JSON store
> degrades to memory and payment records will not survive between invocations. Replace `Store` in
> `src/server/store.ts` with a database-backed implementation (it is a single class behind a narrow
> interface), or deploy to a Node host instead. `/admin` warns when storage is not persistent.

---

## Project structure

```
api/index.ts              Vercel serverless entrypoint
server.ts                 Standalone Node entrypoint
scripts/simulate-itn.ts   Local PayFast ITN simulator
src/
  config/event.ts         Single source of truth for every event fact
  types.ts                Domain types shared by client and server
  server/
    app.ts                Express app factory — all routes
    payfast.ts            Signing + ITN verification
    store.ts              Persistence
    validate.ts           Input validation
  components/             Landing page sections
  admin/                  Dashboard
  lib/                    Client fetch wrapper, PayFast hand-off
tests/                    Unit tests
```

**Event copy lives in `src/config/event.ts` only.** Change the date, price or capacity there and it
updates everywhere — page, API and dashboard.

---

## API

### Public

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness + config summary |
| `GET` | `/api/event` | Event facts, seats remaining, total raised |
| `POST` | `/api/applications` | Submit an SME application |
| `GET` | `/api/applications/:reference` | Applicant status lookup |
| `POST` | `/api/checkout/ticket` | Start a PayFast ticket payment |
| `POST` | `/api/checkout/donation` | Start a PayFast donation |
| `GET` | `/api/payments/:reference/status` | Poll a payment |
| `GET` | `/api/supporters` | Public supporters wall |
| `POST` | `/api/payfast/itn` | PayFast callback (verified) |

### Admin — all require `Authorization: Bearer <ADMIN_TOKEN>`

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/admin/overview` | Stats, PayFast config, storage health |
| `GET` | `/api/admin/applications` | List / filter applications |
| `PATCH` | `/api/admin/applications/:id` | Change application status |
| `GET` | `/api/admin/payments` | Payment ledger |
| `GET` | `/api/admin/payments.csv` | CSV export for reconciliation |

---

## Security notes

- Ticket and donation amounts are set **server-side**; the client cannot influence what is charged.
- ITN callbacks are verified four ways: signature, source IP, amount against our own record, and a
  server-to-server confirmation with PayFast.
- ITNs are idempotent — a replayed notification cannot double-count revenue or reissue a ticket.
- The admin API **fails closed**: an unset `ADMIN_TOKEN` disables it rather than opening it.
- Tokens are compared in constant time.
- Public forms are rate limited.
- `data/` is gitignored: it holds applicant contact details and payment records.

---

© Silver Crest Consulting
