# Audit — Silver Crest Connect

Audit of commit `b571a73` (the state of `main` before this work), against the
**Silver Crest Connect '26 Event Proposal v4** and the client's design feedback.

---

## Summary

The repository contained a well-built application **for a different event**. It implemented a
multi-hall exhibition stall-booking platform — floor plans, VIP islands at R8 500, tier pricing,
15% VAT, 30% deposits, an attendee networking hub with 1-on-1 chat, and a database/API inspector.

The proposal describes something much smaller and sharper: a half-day gathering of 15–20 vetted SMEs
at **R350 each**, with a vetting funnel and a donation portal, where 100% of proceeds fund a
community outreach drive. The client's feedback reinforced this — drop the Attendee Hub, focus the
page purely on converting visitors into ticket holders and donors.

Alongside the mismatch there were three defects that would have caused real damage in production:
a payment endpoint anyone could call to mark a booking paid, an API that did not exist once deployed,
and a `npm start` that could not start.

**Result:** 16 findings — 3 critical, 5 high, 8 medium/low. All addressed.

---

## Critical

### C1. Payments could be confirmed by anyone, without paying

`POST /api/payments/confirm` accepted a booking ID and marked it `COMPLETED` — no authentication, no
payment verification, no gateway involvement. Verified live against the running server:

```
$ curl -X POST -d '{"bookingId":"bkg-1002"}' localhost:3000/api/payments/confirm
{"success":true,"message":"Payment confirmed successfully. Stall reserved.", ...}
```

Anyone who could guess or enumerate a booking ID could award themselves a paid stall. The webhook
at `/api/webhooks/payment-gateway` had the same problem — it trusted its POST body with no signature
check, so a forged request could confirm any booking.

**Fixed.** Both endpoints are gone. A payment can now only reach `COMPLETE` through a PayFast ITN
callback that passes four independent checks: signature, source IP, amount matched against our own
stored record, and a server-to-server confirmation with PayFast. All three failure paths are covered
by tests, and verified end to end against the running server:

| Simulated callback | Result |
| --- | --- |
| Forged signature | Rejected — payment stays `PENDING` |
| Valid signature, amount changed R350 → R1 | Rejected — payment stays `PENDING` |
| Valid signature, correct amount | Accepted — `COMPLETE`, ticket issued |
| Same valid callback replayed 3× | 1 ticket sold, not 3 |

### C2. The entire API was missing in production

`vercel.json` deployed the project as a **static Vite site**. `server.ts` was never built or run, so
every `/api/*` call 404'd once deployed while working perfectly on localhost. Worse, the SPA rewrite
returned `index.html` for those paths, so the client received HTML where it expected JSON and failed
with an opaque parse error rather than a clear 404.

**Fixed.** The Express app is now a factory (`src/server/app.ts`) mounted by both a standalone Node
entrypoint and a Vercel serverless handler (`api/index.ts`), with `vercel.json` routing `/api/*` to
the function. Unmatched API paths return a JSON 404 — and the 404 handler is registered *before* the
client middleware, which is what makes that work.

### C3. `npm start` could not start

`start` ran `node dist/server.cjs`, but `build` only ran `vite build` — nothing ever produced
`dist/server.cjs`, and `clean` deleted a file that was never created.

```
$ npm start
Error: Cannot find module 'H:\ts\SilverCrestConnect\dist\server.cjs'
```

**Fixed.** `build` now runs `build:client` and `build:server`. A follow-on bug surfaced during the
fix and was also resolved: bundling to CJS silently emptied `import.meta.url`, which would have
broken path resolution at runtime. The server bundles to ESM, and path resolution now works from
both the source location and the bundle location.

---

## High

### H1. Product did not match the proposal

Halls, stall tiers, floor plans, add-ons (R1 200 screen banners, VIP gala passes), VAT and deposits —
none of it appears in the proposal, which specifies a flat R350 attendance fee and a vetting funnel.
The advertised dates were **14–16 October 2026** at a "Grand Crest Convention Center"; the proposal
says **24 October 2026, 09:00–13:00**.

**Fixed.** Rebuilt around the proposal. Every event fact now lives in `src/config/event.ts` and is
read by the page, the API and the dashboard, so the copy cannot drift from the PDF again.

### H2. Client feedback not applied

The brief asked to drop the Attendee Hub and public guest list, and to restructure around
Hero → About → Tickets → Donate with a simple anchor nav.

**Fixed.** Removed `AttendeeNetworkingHub`, `FloorPlan`, `StallSummaryCard`, `ExhibitorDirectory`,
`SchemaInspector`, `VerifiedBadgeModal`, `MyBookings`, `StallBookingDashboard`, `CheckoutModal`,
`AgendaDashboard`, `Header`, `mockData` and `prismaSchema` (~3 400 lines). Rebuilt to the requested
flow with nav links About / Event Details / Tickets / Donate plus a persistent **Buy Tickets** button.

Verified in the browser against the brand spec — every value matches exactly:

| Token | Spec | Rendered |
| --- | --- | --- |
| Background | `#0A0A0A` | `rgb(10, 10, 10)` |
| Gold accent | `#C5A059` | `rgb(197, 160, 89)` |
| Headers | `#FFFFFF` | `rgb(255, 255, 255)` |
| Body copy | `#A1A1AA` | `rgb(161, 161, 170)` |
| Display face | Cinzel / Montserrat | Cinzel |
| Body face | Inter | Inter |

The previous build used `#D4AF37`, not the `#C5A059` the brief specified. `#D4AF37` is retained only
as a hover highlight.

### H3. No payment gateway at all

Checkout was simulated: `paymentMethod` was a free-text string, and confirmation was a local state
change. No money could ever have been collected.

**Fixed.** Full PayFast custom integration — signed payment requests, verified ITN callbacks,
sandbox/live modes, and an admin dashboard.

### H4. No persistence

All state lived in module-level arrays. Every restart silently discarded every booking and payment.

**Fixed.** A write-through JSON store with atomic temp-file-plus-rename writes and serialised writes,
so a crash mid-write cannot truncate the file. Requests only return once the record is saved. The
store degrades to memory on a read-only filesystem and says so loudly in `/admin` — which matters on
Vercel, where it will.

### H5. No input validation

`POST /api/payments/checkout-session` performed presence checks only. Amounts, emails and lengths
were unvalidated, and a `stallId` for an already-`BOOKED` stall was accepted.

**Fixed.** A validation layer caps lengths, checks email and phone shapes, and bounds money. Donation
amounts are clamped to R10–R100 000 and reject `NaN`, `Infinity` and negatives. **Ticket amounts come
from server config and are never read from the request body.** Verified:

```
amount=-100      -> Donation amount must be at least R10.
amount=999999999 -> Donation amount cannot exceed R100 000.
amount="abc"     -> Enter a valid donation amount.
amount=0.001     -> Donation amount must be at least R10.
```

---

## Medium and low

| # | Finding | Resolution |
| --- | --- | --- |
| M1 | US data throughout a ZAR app — `EIN-98-3819203`, `US-DEL-8923019`, "Federal Tax ID Lookup", "State Secretary Registry", `+1 (555)` numbers | Replaced with South African context: CIPC registration numbers, `+27` numbers, Cape Town |
| M2 | `"Verified™"` / VerifiedBizLink endpoints returned fabricated trust scores and fake audit results (`Math.random()` presented as a credit grade) | Removed. Vetting is now what the proposal describes: a human CIPC / digital-footprint check recorded in the dashboard |
| M3 | `tsconfig.json` had `strict` off | `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` on; typecheck passes clean |
| M4 | No tests | 40 unit tests covering PayFast signature encoding, input validation, email rendering and currency formatting |
| M5 | `@google/genai` and `dotenv` declared but unused; `vite` in both dependency blocks | Dependencies pruned; `dotenv` is now genuinely used |
| M6 | No security headers | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`; `x-powered-by` disabled |
| M7 | No rate limiting on public endpoints | Fixed-window limiter on applications and checkout — verified: the 5th rapid application returns `429` |
| M8 | Errors leaked stack traces; no error handler | Central handler logs server-side and returns a generic message |
| L1 | Stale AI Studio scaffolding (`DISABLE_HMR`, `metadata.json` Gemini capability, mojibake in a comment) | Removed |
| L2 | `alert()` used for booking errors | Inline, per-field error messages |
| L3 | No accessibility affordances — no focus management, no `aria-*`, no reduced-motion support | Focus moves into the dialog and is trapped by scroll lock; `aria-modal`, `aria-invalid`, `aria-describedby`, `role="alert"`; visible focus rings; `prefers-reduced-motion` respected |
| L4 | `README.md` documented an exhibition booking platform | Rewritten, including a go-live checklist |

---

## Verification

```
npm run lint     tsc --noEmit — clean
npm test         40/40 passing
npm run build    client + server bundle, no warnings
```

Exercised against the running server: application validation and submission, duplicate-email
rejection (409), payment-before-approval rejection (409), admin approval, PayFast checkout field
generation, ITN forgery rejection, ITN amount-tamper rejection, valid ITN completion, ITN replay
idempotency, double-payment rejection (409), disk persistence, rate limiting, admin auth (401 on
missing and wrong token), and the full application flow through the browser UI.

Confirmed the signed PayFast payload contains **no `merchant_key`** — the secret never reaches the
browser.

---

## Resolved since the first pass

The first audit closed with seven open items. Five are now done.

| Was | Now |
| --- | --- |
| No email delivery | Four automatic emails — application received, approval with payment link, ticket confirmation, donation receipt. Sent via Resend; without an API key they log to the console so the funnel still works end to end and a mail outage can never fail a payment. |
| Applicant had no way to check status | `/pay/:reference` shows every funnel state in plain language and doubles as the payment button. It is where approval emails point. |
| Supporters endpoint had no UI | A supporters wall on the landing page — named donors only, no amounts, anonymous gifts filtered server-side. Hidden entirely until there is something to show. |
| Unknown URLs silently rendered the homepage | A real 404 page, so a truncated reference in an email reads as broken rather than as a working homepage. |
| Storage undecided | Confirmed as a Node host. `render.yaml` provisions the disk the datastore needs — without it every deploy would wipe the records. |

Test coverage went from 16 to **40**, adding the validation boundary and the
email layer. Two of the new tests exist because the failure would be invisible:
HTML escaping of applicant names in emails, and the plain-text part staying in
sync with the HTML.

One further defect was found and fixed during this pass:

**The ITN handler acknowledged before it verified.** It replied `200 OK`
immediately, then processed. That is the pattern PayFast documents for speed,
but it means a failure *after* the acknowledgement — a disk error, a crash —
loses a real payment with no retry, because PayFast has already been told the
notification was handled. Verification now runs before the reply: a genuine
server-side failure returns 500 so PayFast retries, while an untrusted
notification still gets a 200 so a forged request cannot occupy a retry slot.
The handler is idempotent, so a retry is always safe.

---

## Still open

These need a decision or a credential, not code.

1. **Venue is unconfirmed** — the proposal says only "Cape Town". `src/config/event.ts` reads
   "Venue to be confirmed"; set `EVENT.venue` when it is booked. It appears on the page and in the
   ticket email.
2. **Keynote speakers are unnamed** — the proposal lists all four as "topic to be confirmed", so the
   page says the same rather than inventing names as the previous build did.
3. **Contact details are placeholders.** `EVENT.contactEmail` is
   `connect@silvercrestconsulting.co.za` and the social links are empty; the footer hides social
   icons until they are filled in. This address is also the email sender — it must exist and its
   domain must be verified in Resend.
4. **No Resend API key yet.** Emails are logged, not delivered, until one is set.
5. **No PayFast passphrase set.** Strongly recommended before going live — see the README checklist.
6. **No screenshots captured.** The browser preview pane was not displayed during either pass, so
   the UI was verified structurally — computed styles, DOM, live interaction through every funnel
   state — rather than visually. Worth a human eye before launch.
