# Secure Link

A Next.js 14 application that lets agents generate secure, expiring links so clients can privately submit sensitive information (banking info, SSNs, ID uploads, etc.). All submitted data is AES-256 encrypted before storage. Company name: **Secure Link** (two words, always capitalized).

## Architecture

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL via Prisma ORM (Replit built-in DB)
- **Auth**: NextAuth v4 (credentials provider)
- **Styling**: Tailwind CSS + Radix UI components
- **Encryption**: AES-256-GCM for field-level encryption
- **Email**: Resend (optional)
- **SMS**: Twilio (backend exists but UI disabled — users copy/paste links to text manually)
- **Rate limiting**: Upstash Redis (optional, falls back to in-memory)

## Project Structure

```
src/
  app/         # Next.js App Router pages and API routes
  components/  # Shared React components
  lib/         # Server-side utilities (db, crypto, auth, email, sms, etc.)
  types/       # TypeScript types
prisma/
  schema.prisma  # PostgreSQL schema
```

## Environment Variables

Required secrets (set in Replit Secrets):
- `DATABASE_URL` - PostgreSQL connection string (Replit built-in)
- `NEXTAUTH_SECRET` - Random hex string for session signing
- `ENCRYPTION_KEY` - 64-char hex string for AES-256 field encryption

Optional:
- `NEXTAUTH_URL` - App URL (set as env var)
- `RESEND_API_KEY` / `RESEND_FROM_EMAIL` - Email notifications
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` - SMS
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` - Rate limiting
- `CRON_SECRET` - Protects the cleanup cron endpoint
- `AUDIT_STORE_IP` - Set "true" to log IP addresses in audit logs

## Running

The app runs on port 5000 via `npm run dev`. The workflow "Start application" handles this automatically.

## Database

Uses Replit's built-in PostgreSQL. Schema is managed with Prisma.
- `npx prisma db push` - Sync schema changes
- `npx prisma generate` - Regenerate client after schema changes
- `npx prisma studio` - Browse database

User model includes `photoUrl` field (String?, base64 data URI) for agent profile photos, alongside the existing `logoUrl` field for company logos.

## Design System

- Calm, light baby blue + soft gray palette — professional, trustworthy feel
- CSS variables in globals.css: `--background: 210 25% 97%`, `--card: 0 0% 100%`, `--primary: 214 65% 52%`
- White cards with subtle shadows and borders (no glass-morphism)
- No emojis anywhere in UI — uses Lucide icons exclusively
- Custom animation keyframes: fade-in, slide-up, scale-in
- Sidebar: white background with `--sidebar-*` CSS variables
- Client-facing forms: clean white cards, trust indicators row, professional section headers, agent photo display

## Branding

- Company name: "Secure Link" (two words)
- All user-facing references use "Secure Link" — never "Agent Secure Links" or "SecureLink"
- Client-facing header shows "Secure Link" text branding when no custom logo is uploaded
- Page titles: "Secure Link", dashboard titles: "Dashboard | Secure Link"

## Client-Facing Form Standards

- All button text uses Title Case: "Submit Securely", not "Submit securely"
- Field labels use Title Case: "First Name", "Routing Number", etc.
- Consent text uses formal authorization language
- Success state: "Submitted Securely" with encryption confirmation
- Full Intake form organized with section dividers (Personal Information, Beneficiary Details, Banking Information)
- Trust indicators centered: "Bank-Level Security", "256-Bit Encryption", "Private & Secure"

## Agent Profile Photo

- Upload endpoint: `/api/agent/photo` (POST for upload, DELETE to remove)
- Max 512KB, accepts PNG/JPG/WebP, stored as base64 data URI in `photoUrl` field
- Upload UI in dashboard Settings page (Profile section)
- Displayed on client-facing secure forms via `client-trust-header.tsx`
- Falls back to initials avatar when no photo is set

## Dashboard Overview

- Twilio-inspired layout: greeting banner, stat cards, quick action cards, alert banners, tabular recent activity
- Stat cards: Total Links, Pending, Submitted, Active Forms (color-coded: blue, amber, emerald, violet)
- Quick action cards: Create Secure Link, View Submissions, Manage Forms
- Alert banners: unviewed submissions (blue), expired links (amber) — contextual, only shown when relevant
- Recent activity: tabular layout with client/type, created, expires, status columns; links to detail pages

## Auth Notes

- Uses custom /api/login endpoint that bypasses NextAuth CSRF (needed for Replit iframe)
- Sets JWT session cookie directly with SameSite=none; Secure
- Cookie name dynamically determined by NEXTAUTH_URL: uses `__Secure-` prefix when URL is HTTPS
- Both auth options and login route share the same cookie-name logic for consistency
- `suppressHydrationWarning` on `<html>` and `<body>` tags to handle Replit iframe hydration
- Test account: test@example.com / TestPass123!

## Routing Number Lookup

- Local database of 150+ common US bank routing numbers in `src/lib/routing-numbers.ts`
- API endpoint: `/api/routing?number=XXXXXXXXX`
- Checks local DB first (instant), falls back to routingnumbers.info API (3s timeout, 24hr cache)
- No API key required — works offline for common banks

## Setup & Portability

- Full setup guide: `SETUP.md` (covers Replit, Vercel, and local development)
- Environment template: `.env.example` (copy to `.env` and fill in values)
- All external services use environment variables only — nothing is hardcoded to any platform
- External services: Resend (email), Twilio (SMS), Upstash Redis (rate limiting) — all optional

## Replit Migration Notes

- Migrated from Vercel: port changed to 5000, host bound to 0.0.0.0
- Database changed from SQLite to PostgreSQL (Replit built-in)
