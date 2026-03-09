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

## Secure Links Page

- Sidebar label: "Secure Links" (renamed from "Requests")
- Link-type tabs at top: All Links, Banking, Social Security, Full Intake, Document Upload, Forms
- Forms tab shows FormLink records merged with SecureLink records, sorted by date
- Form link rows navigate to `/dashboard/forms/[formId]`; form link URLs use `/f/[token]` path
- Underline-style navigation (active = blue text + blue bottom border, inactive = gray text)
- Status filter pills below tabs: All, Sent, Opened, Submitted, Expired
- Selecting a type tab resets the status filter to "All"
- Status counts are scoped to the currently selected type tab
- Create button: "Create Secure Link"
- No SMS buttons anywhere — only Email and Copy options in send panels

## Submissions Page

- Category tabs at top: All Submissions, Banking, Social Security, Full Intake, Document Upload, Forms
- Status filter pills: All, New, Viewed
- Uses `SubmissionsTable` client component (`src/components/submissions-table.tsx`)
- `buildSubmissionsIndex` in `src/lib/submissions-index.ts` merges legacy submissions, form submissions, and ID uploads
- Each submission carries a `category` field for tab filtering (BANKING_INFO, SSN_ONLY, FULL_INTAKE, ID_UPLOAD, CUSTOM_FORM)

## Uploads Page

- Lists all ID uploads for the current user at `/dashboard/uploads`
- Shows client name, email, upload date, and viewed/new status
- Searchable by client name
- Each row has a download button (downloads front ID image via `/api/id-uploads/[id]?side=front&download=1`)
- Each row links to the upload detail viewer at `/dashboard/uploads/[id]`

## Export/Download

- Legacy submissions: JSON and TXT export via `/api/submissions/[id]/export?format=json|text` (buttons in `submission-viewer.tsx`)
- Custom form submissions: JSON and TXT export via `/api/forms/[id]/submissions/[sid]/export?format=json|text` (buttons on form submission detail page)
- ID uploads: Direct download via `/api/id-uploads/[id]?side=front|back&download=1` (buttons on upload detail page and uploads list)
- All exports are audited (EXPORTED event), rate-limited, and include no-cache headers

## Auth Notes

- Uses custom /api/login endpoint that bypasses NextAuth CSRF (needed for Replit iframe)
- Sets JWT session cookie directly with SameSite=none; Secure
- Cookie name dynamically determined: uses `__Secure-` prefix when NEXTAUTH_URL is https
- Test account: test@example.com / TestPass123!

## Routing Number Lookup

- Local database of 150+ common US bank routing numbers in `src/lib/routing-numbers.ts`
- API endpoint: `/api/routing?number=XXXXXXXXX`
- Checks local DB first (instant), falls back to routingnumbers.info API (3s timeout, 24hr cache)
- No API key required — works offline for common banks
- Green "Verified" checkmark appears next to bank name after successful lookup

## Custom Forms (Merged into Secure Links)

- Custom Forms is now the 5th link type on the Create Secure Link page (`/dashboard/new`) — no separate "Forms" tab in sidebar
- Selecting "Custom Form" type shows inline form picker with existing forms, or "Build new form" link
- Link generation for custom forms uses `POST /api/forms/[id]/link` (different from regular links API)
- `/dashboard/forms` redirects to `/dashboard/links`; form detail and builder pages remain accessible
- Form detail page (`/dashboard/forms/[id]`) has "Generate secure link" button that links to `/dashboard/new?formId=[id]`
- Form builder at `/dashboard/forms/new` — starts with template selection (Client Contact Info, Banking Details, Full Application) or "Start from scratch"
- Templates pre-fill fields with smart defaults (labels, placeholders, help text, encryption, confirmation settings)
- Field types: text, email, phone, address, date, dropdown (multiple choice), SSN, routing, bank account, signature
- Fields show as compact cards with Edit/Close toggle to show advanced settings
- User-friendly labels: "What type of information?", "Field name (what your client sees)", "Example text inside the field", "Hint shown below the field"
- Toggle labels: "Required", "Encrypt", "Hide input", "Enter twice" (no jargon)
- Quick-add buttons at bottom: grid of field type icons for one-click adding
- Form fields can be edited after creation via "Edit Fields" button on form detail page
- PATCH `/api/forms/[id]` accepts field updates in a DB transaction for atomic saves
- No consent checkbox on any form type
- No data retention/auto-delete UI — data is only deleted manually by the agent

## Signup & Onboarding

- **Sign-up form** (`/auth?mode=signup`): 4 fields only — Full Name, Work Email, Password, Confirm Password
- After sign-up, users are redirected to `/onboarding` (multi-step wizard)
- **Onboarding steps** (all skippable except final):
  1. Profile Setup (`/onboarding/profile`): Company/Agency, Industry, Phone, Support Email, License/ID
  2. Trust Settings (`/onboarding/trust`): Destination label, Retention policy, Default expiration, Trust message
  3. Branding (`/onboarding/branding`): Logo upload, Profile photo upload, Live preview of client view
  4. First Request (`/onboarding/first-request`): Choose type, Client info, Destination — creates a real link
  5. Success (`/onboarding/success`): Shows link actions (copy, message), "Go to Dashboard" completes onboarding
- `onboardingCompleted` flag on User model — `false` for new users, `true` for existing
- Dashboard layout redirects to `/onboarding` if `onboardingCompleted` is false
- Onboarding layout redirects to `/dashboard` if `onboardingCompleted` is already true
- User model also has: `trustMessage` (String?), `defaultExpirationHours` (Int, default 24)

## Setup & Portability

- Full setup guide: `SETUP.md` (covers Replit, Vercel, and local development)
- Environment template: `.env.example` (copy to `.env` and fill in values)
- All external services use environment variables only — nothing is hardcoded to any platform
- External services: Resend (email), Twilio (SMS), Upstash Redis (rate limiting) — all optional

## Replit Migration Notes

- Migrated from Vercel: port changed to 5000, host bound to 0.0.0.0
- Database changed from SQLite to PostgreSQL (Replit built-in)
