# Project Plan — Agent Secure Links

## MVP Status

### Completed (this session)

- [x] Agent sign up / sign in (NextAuth + bcrypt)
- [x] Agent dashboard — link list with statuses
- [x] Create secure link (type, client info, expiry, view-once)
- [x] Unguessable token generation (nanoid, 187 bits entropy)
- [x] Client secure form page — mobile-first, trust-focused UX
  - [x] Banking Info form
  - [x] SSN/DOB form
  - [x] Full Intake form
- [x] Routing number verification (routingnumbers.info API)
- [x] Consent checkbox on all client forms
- [x] AES-256-GCM field-level encryption at rest
- [x] Submission stored — no plaintext in database
- [x] View-once mode (reveal blocked after first reveal)
- [x] Audit log — created, opened, submitted, revealed
- [x] Agent can view submission and reveal with confirmation
- [x] Link expiry — enforced at load and submission time
- [x] Rate limiting on submission endpoint (in-memory)
- [x] Agent verification page `/verify/[agentSlug]`
- [x] Agent settings / profile page
- [x] Pre-written SMS copy for sharing links
- [x] Security headers (X-Frame-Options, CSP basics, etc.)
- [x] README with threat model and setup guide

---

## Next Iteration (Week 2)

### High priority

- [x] **Deletion job** — Cron cleanup endpoint now deletes submissions/uploads past `deleteAt` and can be scheduled with Vercel cron.
- [ ] **Email notification** — Notify agent when a client submits (Resend API, simple transactional email).
- [ ] **Link deletion** — Allow agents to manually delete a link and its submission.
- [ ] **Export submission** — Download decrypted submission as JSON or PDF for carrier forms.
- [ ] **Mobile nav** — Bottom nav bar for small screens (current nav is desktop-first).

### Medium priority

- [ ] **Twilio SMS integration** — One-click "Send SMS" button using Twilio API. Currently provides copy-paste text only.
- [ ] **Password reset** — Forgot password flow via email.
- [ ] **Pagination** — Dashboard link list paginates after 50 links.
- [ ] **Link search/filter** — Filter by status, type, date.
- [ ] **Submission masked preview** — Show masked field previews (e.g. `****1234`) on submission card even before reveal.

---

## Future Roadmap

### Agent Trust Stack (Phase 2)

- **Client Vault** — Persistent encrypted client portal where clients can update banking or personal info without a new link each time.
- **Document upload** — Secure photo ID / document upload on Full Intake form (S3 + server-side encryption).
- **Agency accounts** — Multi-agent teams, RBAC (admin / agent roles), agency branding.
- **Carrier form autofill** — Map submission fields into carrier application PDFs or web forms.

### Integrations (Phase 3)

- **Zapier / webhooks** — Trigger on submission events (submitted, expired) to push to CRM.
- **Resend** — Full email workflow (submission received, link reminder, data deletion notice).
- **Stripe** — Billing for paid plans (per agent / per link).
- **CRM connectors** — HubSpot, Salesforce, AgencyBloc.

### Analytics (Phase 4)

- **Funnel metrics** — Link created → opened → submitted drop-off.
- **Close rate uplift** — Track whether secure links correlate with higher application completion.
- **Retention analysis** — Identify where clients abandon the secure form.

---

## Architecture Notes

### Switching to Postgres (production)

1. Change `prisma/schema.prisma` provider from `sqlite` to `postgresql`
2. Run `prisma migrate dev --name init`
3. Update `DATABASE_URL` in environment

### Switching to Supabase

Supabase uses Postgres. Use the Prisma connection string from your Supabase project settings. Enable row-level security (RLS) as an additional layer beyond application-level agent isolation.

### Key management upgrade path

Currently the `ENCRYPTION_KEY` is a static env var. For high-security production:
- Migrate to AWS KMS or GCP Cloud KMS for envelope encryption
- Store a per-submission DEK (data encryption key), encrypted with the CMK
- This way, compromising the database alone doesn't expose plaintext even if the app server is partially compromised

### Rate limiting upgrade path

Current rate limiter is in-memory (single process). For multi-instance deployments:
- Replace with Upstash Redis rate limiting (`@upstash/ratelimit`)
- Drop-in compatible with the current interface
