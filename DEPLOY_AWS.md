# AWS Amplify Deployment Guide — Silver Crest Connect

This guide covers deploying **Silver Crest Connect** to **AWS Amplify Hosting** from GitHub,
configuring environment variables, setting up routing, and connecting your GoDaddy domain.

> **Read this first — Amplify Hosting alone will not run this app.**
> `amplify.yml` publishes `dist/` as a static site. This project is not static: every
> application, payment and admin call goes through the Express API in `src/server/`
> (deployed on Vercel as the serverless function in `api/index.ts`). On a static-only
> Amplify app, `/api/*` returns 404, so nobody can apply for a seat, pay, or log into
> `/admin`. Vercel remains the supported target — see the README, "Deploying".
> To use Amplify you must additionally host the API (Amplify Functions, Lambda + API
> Gateway, or App Runner) and rewrite `/api/*` to it.

> **Never paste real secrets into this file.** It is committed to Git. Every value
> below is a placeholder; enter the real values only in the hosting provider's
> environment-variable console.

---

## 1. Quick Start: Deploying with AWS Amplify

1. Sign in to the **[AWS Management Console](https://console.aws.amazon.com/)** and open **AWS Amplify**.
2. Click **Create new app** > **Host web app**.
3. Select **GitHub** as your Git repository provider and authorize AWS Amplify.
4. Select repository: `mraaziqp/SilverCrestConnect` and branch: `main`.
5. In the **Build settings** step, Amplify will automatically detect `amplify.yml`.

---

## 2. Environment Variables in AWS Amplify

In the Amplify console, expand **Advanced settings** (or go to **App settings** >
**Environment variables** after creating the app) and add the following.

`APP_URL` must be the **event site** (`scconnect.co.za`), not the parent company site —
PayFast return URLs and the links inside applicant emails are built from it.

```env
APP_URL=https://scconnect.co.za
ADMIN_TOKEN=<generate a long random value; do not reuse a password>

PAYFAST_MODE=live
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

Generate an admin token with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

You also need the datastore variables (`STORE_DRIVER`, `FIREBASE_PROJECT_ID`,
`FIREBASE_DATABASE_URL`, `FIREBASE_SERVICE_ACCOUNT`) wherever the API runs, or
applicant and payment records are lost between requests. See `.env.example`.

---

## 3. SPA Rewrites & Redirects in AWS Amplify

To ensure routes like `/admin`, `/pay/:reference`, `/payment/return`, and `/payment/cancel` load properly without 404s on page refresh:

1. In Amplify Console, navigate to **App settings** > **Rewrites and redirects**.
2. Click **Edit** and ensure the default SPA rewrite rule is present:
   - **Source address**: `</^[^.]+$|\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json)$)([^.]+$)/>`
   - **Target address**: `/index.html`
   - **Type**: `200 (Rewrite)`
3. Add a rule ahead of it sending `/api/<*>` to wherever the API is hosted. Without
   this the site loads but every form fails.

---

## 4. Connecting Custom Domain (GoDaddy -> AWS Amplify)

1. In AWS Amplify, go to **App settings** > **Domain management**.
2. Click **Add domain** and enter `scconnect.co.za` (or your chosen domain).
3. Amplify will generate DNS verification records:
   - **CNAME record** for SSL verification (`_cname.scconnect.co.za` -> `...acm-validations.aws`).
   - **ANAME / ALIAS or CNAME record** for the root domain and `www` subdomain (`scconnect.co.za` -> `dXXXXXXXXX.amplifyapp.com`).
4. Log into your **GoDaddy DNS Management Console**:
   - Add the verification CNAME record.
   - Point `www` (or root `@`) to the Amplify distribution URL.
5. AWS Amplify will automatically provision a free Managed SSL/TLS Certificate.
