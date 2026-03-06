# Secure Link — Setup Guide

Complete guide for setting up Secure Link in any environment. This covers every API key and service the application uses. Whether you are working on Replit, deploying to Vercel, or running locally, follow this guide to get everything connected.

---

## Quick Start

1. Copy `.env.example` to `.env`
2. Fill in the **Required** variables (Database, NextAuth, Encryption)
3. Run `npx prisma db push` to create database tables
4. Run `npm run dev` to start the development server
5. Set up **Recommended** services (Resend, Twilio) when ready for production

---

## Required Services

These must be configured for the app to function.

### 1. PostgreSQL Database

The app stores all user accounts, links, encrypted submissions, and audit logs in PostgreSQL.

| Environment | How to Set Up |
|-------------|---------------|
| **Replit** | Already provided. The `DATABASE_URL` is automatically set by Replit's built-in PostgreSQL. No action needed. |
| **Vercel** | Use [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres), [Neon](https://neon.tech), or [Supabase](https://supabase.com). Copy the connection string to `DATABASE_URL`. |
| **Local** | Install PostgreSQL, create a database, and set `DATABASE_URL` to your local connection string. |

After setting `DATABASE_URL`, run:
```bash
npx prisma db push
npx prisma generate
```

### 2. NextAuth (Authentication)

NextAuth handles user sessions. You need two values:

**`NEXTAUTH_URL`** — The public URL where your app runs.
- Local: `http://localhost:5000`
- Replit: Your Repl's URL (e.g., `https://your-repl.replit.app`)
- Vercel: Your production domain

**`NEXTAUTH_SECRET`** — A random string for signing session tokens.
```bash
# Generate one:
openssl rand -hex 32
```

### 3. Encryption Key

All sensitive client data (SSNs, bank accounts, etc.) is encrypted with AES-256-GCM before storage. This key must remain the same across all environments that share a database.

**`ENCRYPTION_KEY`** — A 64-character hex string (32 bytes).
```bash
# Generate one:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**WARNING:** If you change this key after data has been stored, all existing encrypted submissions become permanently unreadable. Keep it safe and consistent.

---

## Recommended Services

These enable important features but the app runs without them.

### 4. Email Notifications (Resend)

Enables: sending secure links to clients via email, password reset emails, submission notifications to agents.

**Sign up:** [resend.com](https://resend.com) (free tier: 3,000 emails/month)

**Step-by-step:**
1. Create an account at [resend.com](https://resend.com)
2. Go to [API Keys](https://resend.com/api-keys) and create a new key
3. Copy the key — it starts with `re_`
4. Set the environment variables:
   - `RESEND_API_KEY` = your API key
   - `RESEND_FROM_EMAIL` = the sender address (e.g., `Secure Link <noreply@yourdomain.com>`)

**Domain verification (recommended for production):**
- In the Resend dashboard, go to Domains and add your domain
- Follow the DNS verification steps they provide
- This prevents your emails from landing in spam

**Without this configured:** Email features are silently disabled. Links can still be copied and shared manually.

### 5. SMS Delivery (Twilio)

Enables: sending secure links to clients via text message directly from the dashboard.

**Sign up:** [twilio.com/try-twilio](https://www.twilio.com/try-twilio) (free trial includes ~$15 credit)

**Step-by-step:**
1. Create an account at [twilio.com](https://www.twilio.com/try-twilio)
2. From the [Console dashboard](https://console.twilio.com), copy:
   - **Account SID** (starts with `AC`)
   - **Auth Token** (click to reveal)
3. Buy a phone number:
   - Go to [Phone Numbers > Manage > Buy a Number](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming)
   - Choose any US number with SMS capability (~$1.15/month)
4. Set the environment variables:
   - `TWILIO_ACCOUNT_SID` = your Account SID
   - `TWILIO_AUTH_TOKEN` = your Auth Token
   - `TWILIO_FROM_NUMBER` = your Twilio phone number (e.g., `+15551234567`)

**Without this configured:** The SMS send button is hidden from the dashboard. Links can still be sent via email or copied manually.

---

## Optional Services

### 6. Rate Limiting (Upstash Redis)

Provides distributed rate limiting for submission endpoints and authentication. Without it, the app uses an in-memory fallback that works fine for single-server deployments.

**Sign up:** [console.upstash.com](https://console.upstash.com) (free tier: 10,000 commands/day)

**Step-by-step:**
1. Create an account at [upstash.com](https://console.upstash.com)
2. Create a new Redis database (choose "Global" region for best latency)
3. On the database details page, go to the **REST API** section
4. Copy the values:
   - `UPSTASH_REDIS_REST_URL` = the REST URL
   - `UPSTASH_REDIS_REST_TOKEN` = the REST token

**Without this configured:** Uses in-memory rate limiting. Works perfectly for development and single-server production. Only needed if you run multiple server instances.

### 7. Cron Cleanup Secret

The app has an endpoint (`/api/cron/cleanup`) that automatically deletes expired links and submissions past their retention period.

**`CRON_SECRET`** — Set to any random string.
```bash
# Generate one:
openssl rand -hex 16
```

**Setting up automatic cleanup:**
- **Vercel:** Use [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs) to call `GET /api/cron/cleanup?secret=YOUR_SECRET` on a schedule
- **Any host:** Use an external cron service (e.g., [cron-job.org](https://cron-job.org)) to hit the endpoint periodically
- **Recommended schedule:** Every 6 hours

### 8. Audit IP Logging

**`AUDIT_STORE_IP`** — Set to `"true"` to record client IP addresses in audit logs. Default is `"false"` for maximum privacy.

---

## Routing Number Lookup

The app includes a built-in routing number lookup that auto-fills bank names when clients enter their routing number. This works automatically with no API key required:

- **Top 100+ US banks** are resolved instantly from a local database (no network call)
- **Less common routing numbers** fall back to the free routingnumbers.info API
- **No setup needed** — this feature works out of the box in any environment

---

## Deployment Guides

### Replit

1. Database is already set up (built-in PostgreSQL)
2. Set `NEXTAUTH_SECRET` and `ENCRYPTION_KEY` in Replit Secrets
3. Set `NEXTAUTH_URL` to your Repl's public URL
4. Add Resend and Twilio keys in Replit Secrets when ready
5. Run `npx prisma db push` in the Shell
6. The workflow "Start application" runs `npm run dev` automatically

### Vercel

1. Push code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add a PostgreSQL database (Vercel Postgres, Neon, or Supabase)
4. Set all environment variables in Vercel's project settings
5. Prisma will auto-generate on build (configured in `package.json`)
6. Set up a Vercel Cron Job for `/api/cron/cleanup`

### Local Development

1. Install PostgreSQL and create a database
2. Copy `.env.example` to `.env` and fill in your values
3. Run:
   ```bash
   npm install
   npx prisma db push
   npm run dev
   ```
4. App runs at `http://localhost:5000`

---

## Verify Your Setup

After configuring, verify each service:

| Service | How to Verify |
|---------|---------------|
| **Database** | App starts without errors, you can create an account |
| **Auth** | You can sign up, log in, and log out |
| **Encryption** | Create a test link, submit data, view it in dashboard — data should be readable |
| **Email** | Send a test link via email from the dashboard — client should receive it |
| **SMS** | Send a test link via SMS from the dashboard — client should receive a text |
| **Rate Limiting** | Submit a form 6 times rapidly — the 6th should be blocked |
| **Cron** | Call `GET /api/cron/cleanup?secret=YOUR_SECRET` — should return success |

---

## Environment Variable Summary

| Variable | Required | Service | Where to Get It |
|----------|----------|---------|-----------------|
| `DATABASE_URL` | Yes | PostgreSQL | Your database provider |
| `NEXTAUTH_URL` | Yes | NextAuth | Your app's public URL |
| `NEXTAUTH_SECRET` | Yes | NextAuth | `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | Yes | AES-256 | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `RESEND_API_KEY` | Recommended | Resend | [resend.com/api-keys](https://resend.com/api-keys) |
| `RESEND_FROM_EMAIL` | Recommended | Resend | Your verified domain email |
| `TWILIO_ACCOUNT_SID` | Recommended | Twilio | [console.twilio.com](https://console.twilio.com) |
| `TWILIO_AUTH_TOKEN` | Recommended | Twilio | [console.twilio.com](https://console.twilio.com) |
| `TWILIO_FROM_NUMBER` | Recommended | Twilio | Twilio phone number you purchased |
| `UPSTASH_REDIS_REST_URL` | Optional | Upstash | [console.upstash.com](https://console.upstash.com) |
| `UPSTASH_REDIS_REST_TOKEN` | Optional | Upstash | [console.upstash.com](https://console.upstash.com) |
| `CRON_SECRET` | Optional | Cron | `openssl rand -hex 16` |
| `AUDIT_STORE_IP` | Optional | Privacy | Set `"true"` or `"false"` |
