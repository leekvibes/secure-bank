# Agent Secure Links

A privacy-first platform for professionals to collect sensitive information from clients securely — without requiring them to read it aloud during phone calls or video sessions.

## What it does

An agent generates an expiring secure link and sends it to a client. The client opens the link on their device and privately submits sensitive information (banking details, SSN-only, SSN/DOB, personal info). The agent receives the encrypted submission in their dashboard and can reveal it with a full audit trail.

---

## Setup

### Prerequisites

- Node.js 18+
- npm

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the example and fill in your values:

```bash
cp .env.example .env
```

Generate required secrets:

```bash
# NEXTAUTH_SECRET (32 random bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# ENCRYPTION_KEY (32 random bytes, different from above)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Set up database

```bash
npm run db:generate   # Generate Prisma client
npm run db:push       # Create SQLite database from schema
npm run db:seed       # Add demo agent account
```

When pulling new backend schema changes (including asset library updates), run:

```bash
npm run db:generate
npm run db:push
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Demo credentials:** `demo@agentsecurelinks.com` / `demo1234`

### 5. Security checks

```bash
npm run typecheck
npm test
```

### Troubleshooting UI Load

If the UI is blank, constantly refreshing, or routes fail to load:

1. Clean stale Next.js build artifacts and restart:
```bash
npm run dev
```
`predev` now clears `.next` automatically.

2. Ensure DB schema is up to date (required for dashboard/auth flows):
```bash
npm run db:push
```

3. If another dev server is already running, stop it first:
```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
kill <PID>
```

Common causes:
- Stale/corrupted `.next` chunk files after branch switches or concurrent edits
- SQLite schema drift (new tables/columns referenced by server routes before `db:push`)
- Multiple `next dev` processes running on different ports causing confusion

---

## Routes

| Route | Description |
|---|---|
| `/` | Landing page / redirect to dashboard if signed in |
| `/auth` | Sign in / sign up |
| `/dashboard` | Agent link list |
| `/dashboard/new` | Create a new secure link |
| `/dashboard/submissions/[id]` | View a submission |
| `/dashboard/settings` | Agent profile settings |
| `/secure/[token]` | Client-facing secure form |
| `/verify/[agentSlug]` | Public agent verification page |

---

## Asset Library (Agent Branding)

Agents can store reusable branding assets and attach multiple assets to links.

- `POST /api/assets` (auth): upload/register asset (`file`, optional `type`, optional `name`)
- `GET /api/assets` (auth): list current agent assets
- `DELETE /api/assets/[id]` (auth): delete asset
  - blocked if attached to links unless `?force=true`
- `POST /api/links/[id]/assets` (auth): set ordered assets for a legacy secure link
- `POST /api/forms/[id]/link` (auth): accepts `assetIds[]` and attaches on form-link creation
- `GET /api/f/[token]`: returns selected assets for token-rendered form config
- `GET /api/secure/[token]`: returns selected assets for token-rendered secure-link config

Upload/security rules:
- Allowed types: `jpg`, `jpeg`, `png`, `pdf`
- Max size: `5MB`
- `LOGO` / `AVATAR` asset types enforce image-only uploads (`jpg/jpeg/png`)
- Stored privately as encrypted files under server-side storage (not public static files)

Backward compatibility:
- Existing single `logoUrl` values are auto-migrated into `AgentAsset` entries on first asset-aware access.

---

## Manual SSN Flow Test

1. Sign in as demo agent: `demo@agentsecurelinks.com` / `demo1234`
2. Go to `/dashboard/new` and create an `SSN (Secure)` link
3. Enter a client name (required for SSN links), keep expiry at 7 days, generate the link
4. Open the secure link URL from the create screen
5. Submit:
   - First name
   - Last name
   - SSN
   - Confirm SSN (must match)
   - Consent checkbox
6. Confirm submission success page appears
7. Back in dashboard, verify link status is `Submitted`
8. Open the submission:
   - masked SSN preview should show only last 4 (for example `****6789`)
   - reveal action should decrypt and show fields
   - if view-once is enabled, second reveal should be blocked
9. Confirm audit trail includes SSN open, submit, and reveal events

### Prisma / migration notes for SSN flow

- No Prisma schema migration is required for SSN-only links in this implementation.
- Existing models (`SecureLink.linkType` + encrypted `Submission.encryptedData`) are reused.

---

## Threat Model

### What we protect against

**Data exposure at rest** — All sensitive submission fields are encrypted with AES-256-GCM before storage. The database only ever holds ciphertext. The encryption key lives in the environment, never in the database.

**Unauthorized access to submissions** — API routes enforce session-based agent isolation. An agent can only access their own links and submissions. This is verified at the database query level, not just at the route level.

**Link enumeration** — Tokens are 32 characters from a 55-character alphabet (~187 bits of entropy). Brute-forcing is computationally infeasible.

**Repeated submissions / spam** — The submission endpoint is rate-limited to 5 attempts per token per IP per 15-minute window.

**Replay after expiry** — Link expiry is checked on every form load and submission attempt. Expired links are rejected server-side.

**Double submissions** — Submissions are one-per-link. A second submission to the same token is rejected with HTTP 409.

**View-once bypass** — Once a view-once submission is revealed, the server refuses to decrypt it again. The masked state is enforced at the API level.

**Log leakage** — Prisma query logging is disabled. No sensitive field values appear in logs. Audit logs store only event types and timestamps.

### What we do not currently protect against

- A compromised server with access to both the encryption key and the database (key management service like AWS KMS would address this)
- Long-term session hijacking (sessions expire in 8 hours)
- Malicious agents (no multi-tenant isolation beyond ownership checks)

---

## Security Decisions

### Field-level AES-256-GCM encryption

Each field in a submission is independently encrypted with a random 96-bit IV. Storage format per field: `base64(iv):base64(authTag):base64(ciphertext)`. This means:
- Fields can be individually decrypted
- IV reuse is statistically impossible
- GCM provides authenticated encryption (detects tampering)
- Master key comes from `ENCRYPTION_KEY` env var only

### Tokens

Generated with `nanoid` using a custom 55-character alphabet (no ambiguous characters). 32 characters = ~187 bits of entropy. Non-sequential, non-predictable.

### Retention

Submissions and uploads have a `deleteAt` timestamp set at creation time. A scheduled cleanup job (`/api/cron/cleanup`) permanently deletes records past retention.

### Audit logs

Every meaningful event is recorded: link created, link opened, client submitted, agent revealed, etc. IPs are NOT stored by default (privacy-first). Set `AUDIT_STORE_IP=true` to enable. User agents are truncated to 200 characters.

### Consent

Every client form requires an explicit consent checkbox before submission can proceed. Consent language names the agent, the purpose, and the retention policy.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Prisma connection string. Use `file:./dev.db` for local SQLite |
| `NEXTAUTH_URL` | Yes | Full URL of the app (e.g. `http://localhost:3000`) |
| `NEXTAUTH_SECRET` | Yes | 32-byte random hex string for JWT signing |
| `ENCRYPTION_KEY` | Yes | 32-byte random hex string for AES-256-GCM field encryption |
| `AUDIT_STORE_IP` | No | Set to `"true"` to store IP addresses in audit logs (default: off) |
| `UPSTASH_REDIS_REST_URL` | No | Upstash REST URL for distributed rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | No | Upstash REST token for distributed rate limiting |

---

## Moving to Production

1. Replace `DATABASE_URL` with a Postgres connection string (change `provider = "sqlite"` to `provider = "postgresql"` in `prisma/schema.prisma`)
2. Run `prisma migrate dev` instead of `prisma db push`
3. Store `ENCRYPTION_KEY` in a secrets manager (never commit to source)
4. Replace in-memory rate limiter in `src/lib/rate-limit.ts` with Redis/Upstash
5. Set `NEXTAUTH_URL` to your production domain
6. Configure `CRON_SECRET` and keep `/api/cron/cleanup` scheduled daily so retention deletions continue to run
