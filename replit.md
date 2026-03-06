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

## Design System

- "Tesla meets Apple" dark aesthetic with blue-toned palette
- CSS variables in globals.css use dark navy backgrounds (HSL 222 family)
- Glass-morphism card effects with backdrop-blur and subtle borders
- No emojis anywhere in UI — uses Lucide icons exclusively
- Custom animation keyframes: fade-in, slide-up, scale-in
- Sidebar uses separate --sidebar-* CSS variables
- Status badges use translucent colored backgrounds (e.g., bg-blue-500/20)

## Auth Notes

- Uses custom /api/login endpoint that bypasses NextAuth CSRF (needed for Replit iframe)
- Sets JWT session cookie directly with SameSite=none; Secure
- Test account: test@example.com / TestPass123!

## Replit Migration Notes

- Migrated from Vercel: port changed to 5000, host bound to 0.0.0.0
- Database changed from SQLite to PostgreSQL (Replit built-in)
