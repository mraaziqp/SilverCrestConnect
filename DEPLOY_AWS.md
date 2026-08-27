# Deploying Silver Crest Connect on AWS

Two services. Amplify Hosting serves the built client; App Runner runs the
Express API. Amplify rewrites `/api/*` across to App Runner, so the browser
only ever sees one origin and the application code needs no changes.

```
                    scconnect.co.za
                          |
                   Amplify Hosting            (static: dist/)
                          |
                 /api/*  -> rewrite (200)
                          |
                   App Runner                 (Express: npm start)
                          |
              Firebase Realtime Database
```

PayFast is the exception to the single-origin rule, and it matters:

```
  browser  -> Amplify -> App Runner      return_url / cancel_url  (APP_URL)
  PayFast  ------------> App Runner      notify_url  (ITN)        (API_URL)
```

The ITN is signed, and the server verifies that signature against the **raw**
request body. Routing it through the Amplify rewrite risks the proxy
re-encoding the body, which fails verification *after* the customer has paid —
the money moves, the seat is never confirmed, and the only trace is an
`itnError` in the dashboard. So `API_URL` points PayFast straight at App
Runner, bypassing Amplify entirely.

> **Never put real secrets in this file.** It is committed. Every value below
> is a placeholder; enter real ones in the AWS console or Secrets Manager.

---

## 1. App Runner — the API

1. App Runner console -> **Create service** -> **Source code repository**.
2. Connect GitHub, pick `mraaziqp/SilverCrestConnect`, branch `main`.
3. Deployment trigger: **Automatic** to redeploy on push.
4. Configuration: **Use a configuration file** — it reads `apprunner.yaml`
   from the repo root (Node 22, `npm ci && npm run build`, then `npm start`).
5. **Health check**: set the protocol to `HTTP` and the path to `/api/health`.
   The default is a TCP check, which passes while the app is still broken.
6. Set the environment variables below.

Note the service URL it gives you — `https://<id>.<region>.awsapprunner.com`.
That is your `API_URL`, and the whole site is reachable there on its own, which
is the easiest way to test before any DNS is moved.

### Environment variables

Set these on the App Runner service. Secrets belong in Secrets Manager,
referenced from App Runner, rather than typed as plain environment values.

```env
APP_URL=https://scconnect.co.za                      # what the browser sees
API_URL=https://<id>.<region>.awsapprunner.com       # where PayFast posts the ITN

ADMIN_TOKEN=<long random value>

STORE_DRIVER=rtdb
FIREBASE_PROJECT_ID=<project id>
FIREBASE_DATABASE_URL=https://<project>.firebaseio.com
FIREBASE_SERVICE_ACCOUNT=<the service-account JSON, as a single line>

PAYFAST_MODE=sandbox                                 # live only after a test payment
PAYFAST_MERCHANT_ID=<from the PayFast dashboard>
PAYFAST_MERCHANT_KEY=<from the PayFast dashboard>
PAYFAST_PASSPHRASE=<from the PayFast dashboard>

SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=connect@scconsults.co.za
SMTP_PASS=<mailbox password / app password>
EMAIL_FROM=connect@scconsults.co.za
EMAIL_FROM_NAME=Silver Crest Connect
EMAIL_REPLY_TO=connect@scconsults.co.za
```

Do **not** set `PAYFAST_SKIP_IP_CHECK` or `PAYFAST_SKIP_SERVER_CONFIRM`. They
are local-testing flags that each remove one of the four ITN checks, and live
mode ignores them anyway. Do **not** set `GOOGLE_APPLICATION_CREDENTIALS` —
that is a file path for local use; `FIREBASE_SERVICE_ACCOUNT` replaces it.

Generate the admin token with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Confirm the service is healthy before going further:

```bash
curl https://<id>.<region>.awsapprunner.com/api/health
```

`"persistent": true` means records are going to Firebase and will survive. If
it says `false`, the service-account JSON did not parse and **every applicant
and payment record will be lost** — fix that before taking a single payment.

---

## 2. Amplify Hosting — the client

1. Amplify -> **Create new app** -> **Host web app** -> GitHub.
2. Repository `mraaziqp/SilverCrestConnect`, branch `main`.
3. Amplify detects `amplify.yml`, which builds `build:client` only. The API is
   not built or served here.

Amplify needs no environment variables. The client holds no secrets and reads
its configuration from the API at runtime.

### Rewrites and redirects

**App settings -> Rewrites and redirects.** Order matters — the API rule must
come first, or the SPA catch-all swallows it and every form returns the HTML
page instead of JSON.

| Source | Target | Type |
| --- | --- | --- |
| `/api/<*>` | `https://<id>.<region>.awsapprunner.com/api/<*>` | 200 (Rewrite) |
| `</^[^.]+$\|\.(?!(css\|gif\|ico\|jpg\|js\|png\|txt\|svg\|woff\|woff2\|ttf\|map\|json)$)([^.]+$)/>` | `/index.html` | 200 (Rewrite) |

Check the API rule reaches through:

```bash
curl https://<amplify-domain>/api/health
```

JSON means the rewrite works. The HTML of the home page means it does not, and
nothing on the site will function.

---

## 3. Custom domain

Add the domain in **Amplify -> App settings -> Domain management**, not in App
Runner — Amplify is what the public visits.

Enter the domain bare: `scconnect.co.za`. Not `https://scconnect.co.za`, no
trailing slash, no trailing dot, no leading space. ACM rejects anything else
with *"The domain provided is not a valid public domain"*, which reads like the
domain is wrong when it is only the formatting.

`scconnect.co.za` is registered on GoDaddy (`ns49`/`ns50.domaincontrol.com`),
so in GoDaddy's DNS manager add the records Amplify shows you:

- the ACM validation **CNAME**, and
- the record pointing the root and `www` at the Amplify distribution.

`www.scconnect.co.za` currently has no DNS record at all, so add it or the
`www` half of the certificate will never validate.

If ACM still refuses a correctly formatted domain, request the certificate
directly in ACM (**us-east-1** — Amplify fronts with CloudFront) for
`scconnect.co.za`. If it issues there and fails in Amplify, the problem is
Amplify's handling of the second-level `.co.za`, which is a support ticket
rather than something you can configure around.

Once DNS resolves, set `APP_URL=https://scconnect.co.za` on App Runner and
redeploy, so PayFast return links and applicant emails point at the real site.

---

## 4. Going live

In order:

1. `/api/health` reports `"persistent": true`.
2. `/admin` loads through the Amplify domain and accepts the admin token.
3. A test application submits, appears in the dashboard, and approval sends mail.
4. A sandbox payment completes and the ITN marks it `PAID` — check the payment
   in the dashboard carries no `itnError`.
5. Only then set `PAYFAST_MODE=live` with the live credentials, and do one real
   low-value payment end to end before announcing anything.

Two known blockers, neither in the code:

- SMTP AUTH is disabled at the Microsoft tenant level (error `535 5.7.139`).
  Until it is enabled in the Exchange admin centre, mail is logged rather than
  sent, and applicants will never receive their payment links.
- Any credential that has ever been committed to this repository must be
  rotated before going live.
