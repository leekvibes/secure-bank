# Agent Secure Links

A Next.js 14 application that lets agents generate secure, expiring links so clients can privately submit sensitive information (banking info, SSNs, ID uploads, etc.). All submitted data is AES-256 encrypted before storage.

## Architecture

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL via Prisma ORM (Replit built-in DB)
- **Auth**: NextAuth v4 (credentials provider)
- **Styling**: Tailwind CSS + Radix UI components
- **Encryption**: AES-256-GCM for field-level encryption
- **Email**: Resend (optional)
- **SMS**: Twilio (optional)
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

## Agent Profile Photo

- Upload endpoint: `/api/agent/photo` (POST for upload, DELETE to remove)
- Max 512KB, accepts PNG/JPG/WebP, stored as base64 data URI in `photoUrl` field
- Upload UI in dashboard Settings page (Profile section)
- Displayed on client-facing secure forms via `client-trust-header.tsx`
- Falls back to initials avatar when no photo is set

## Auth Notes

- Uses custom /api/login endpoint that bypasses NextAuth CSRF (needed for Replit iframe)
- Sets JWT session cookie directly with SameSite=none; Secure
- Test account: test@example.com / TestPass123!

## Replit Migration Notes

- Migrated from Vercel: port changed to 5000, host bound to 0.0.0.0
- Database changed from SQLite to PostgreSQL (Replit built-in)
