# AWS Amplify Deployment Guide — Silver Crest Connect

This guide covers deploying **Silver Crest Connect** to **AWS Amplify Hosting** from GitHub, configuring environment variables, setting up routing, and connecting your GoDaddy domain.

---

## 1. Quick Start: Deploying with AWS Amplify

1. Sign in to the **[AWS Management Console](https://console.aws.amazon.com/)** and open **AWS Amplify**.
2. Click **Create new app** > **Host web app**.
3. Select **GitHub** as your Git repository provider and authorize AWS Amplify.
4. Select repository: `mraaziqp/SilverCrestConnect` and branch: `main`.
5. In the **Build settings** step, Amplify will automatically detect `amplify.yml`.

---

## 2. Environment Variables in AWS Amplify

In the Amplify console, expand **Advanced settings** (or go to **App settings** > **Environment variables** after creating the app) and add the following:

```env
APP_URL=https://scconsults.co.za
ADMIN_TOKEN=7093fe8ca5d1cdd7fc5806d6ff4087120fb35d3c754ea9fe26263ce858daa832

PAYFAST_MODE=live
PAYFAST_MERCHANT_ID=your_merchant_id_here
PAYFAST_MERCHANT_KEY=your_merchant_key_here
PAYFAST_PASSPHRASE=428c73a1f4ce4f53f552ec602077978f

SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=connect@scconsults.co.za
SMTP_PASS=F$755289989835ot
EMAIL_FROM=connect@scconsults.co.za
EMAIL_FROM_NAME=Silver Crest Connect
EMAIL_REPLY_TO=connect@scconsults.co.za
```

---

## 3. SPA Rewrites & Redirects in AWS Amplify

To ensure routes like `/admin`, `/pay/:reference`, `/payment/return`, and `/payment/cancel` load properly without 404s on page refresh:

1. In Amplify Console, navigate to **App settings** > **Rewrites and redirects**.
2. Click **Edit** and ensure the default SPA rewrite rule is present:
   - **Source address**: `</^[^.]+$|\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json)$)([^.]+$)/>`
   - **Target address**: `/index.html`
   - **Type**: `200 (Rewrite)`

---

## 4. Connecting Custom Domain (GoDaddy -> AWS Amplify)

1. In AWS Amplify, go to **App settings** > **Domain management**.
2. Click **Add domain** and enter `scconsults.co.za` (or your chosen domain).
3. Amplify will generate DNS verification records:
   - **CNAME record** for SSL verification (`_cname.scconsults.co.za` -> `...acm-validations.aws`).
   - **ANAME / ALIAS or CNAME record** for the root domain and `www` subdomain (`scconsults.co.za` -> `dXXXXXXXXX.amplifyapp.com`).
4. Log into your **GoDaddy DNS Management Console**:
   - Add the verification CNAME record.
   - Point `www` (or root `@`) to the Amplify distribution URL.
5. AWS Amplify will automatically provision a free Managed SSL/TLS Certificate.
