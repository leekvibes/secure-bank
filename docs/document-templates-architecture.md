# Document Templates Architecture (Step 1 Spec)

## Purpose
Add a first-class `DOCUMENT` template type to the existing template system, without breaking current `FORM` and `SECURE_LINK` flows.

This spec is the source of truth for implementation order, schema, API contracts, validation rules, sender UX state transitions, and rollout safeguards.

## Non-goals
- Do not replace current forms/secure link templates.
- Do not create a disconnected signing system.
- Do not store legal template content only as ad-hoc free text.

## Product Requirements (Locked)
- Template Gallery shows 3 top-level types: `DOCUMENT`, `FORM`, `SECURE_LINK`.
- A document template is a real agreement-style document with:
  - Pre-written body text.
  - Fillable highlighted variables.
  - Optional clauses (toggle on/off).
  - Default signing anchors (pre-placed signature/date/name fields).
- Sender flow:
  1. Pick document template.
  2. Fill required variables.
  3. Preview generated document.
  4. Continue into `/dashboard/signing/new` with defaults preloaded.
  5. Send + recipient signs + signed PDF/certificate downloads through existing signing stack.

## Data Model Changes

### 1) `SystemTemplate` (extend existing)
Keep current model and add fields for document templates.

- `type` (existing): now supports `DOCUMENT | FORM | SECURE_LINK`.
- `docSchemaJson` `String?`
  - JSON describing document blocks, variables, and optional clauses.
- `docDefaultValuesJson` `String?`
  - Default variable values for quick starts.
- `docSigningDefaultsJson` `String?`
  - Array of default signing field anchors with recipient role mapping.
- `docVersion` `Int @default(1)`
- `docStatus` `String @default("DRAFT")`
  - `DRAFT | REVIEWED | PUBLISHED | ARCHIVED`.
- `thumbnailUrl` `String?`
- `previewBlobUrl` `String?` (optional pre-rendered preview artifact).

### 2) New model: `DocumentTemplateInstance`
Tracks per-use, immutable template snapshot linked to a signing request.

- `id` `String @id @default(cuid())`
- `templateId` `String`
- `requestId` `String @unique` (1:1 with `DocSignRequest`)
- `templateVersion` `Int`
- `resolvedValuesJson` `String` (validated sender inputs at send time)
- `enabledClausesJson` `String?`
- `renderHash` `String?` (sha256 of rendered PDF bytes)
- `renderedBlobUrl` `String?` (PDF used as the request source doc)
- `createdAt` `DateTime @default(now())`
- `updatedAt` `DateTime @updatedAt`

Indexes:
- `@@index([templateId, createdAt])`
- `@@index([requestId])`

## JSON Contracts

### `docSchemaJson` shape
```json
{
  "title": "Bill of Sale",
  "locale": "en-US",
  "versionLabel": "v1",
  "roles": ["SELLER", "BUYER"],
  "variables": [
    { "key": "effective_date", "label": "Effective Date", "type": "date_text", "required": true, "editable": true },
    { "key": "seller_legal_name", "label": "Seller Legal Name", "type": "text", "required": true, "editable": true },
    { "key": "buyer_legal_name", "label": "Buyer Legal Name", "type": "text", "required": true, "editable": true },
    { "key": "purchase_price", "label": "Purchase Price", "type": "currency_usd", "required": true, "editable": true }
  ],
  "clauses": [
    { "id": "as_is_clause", "label": "As-Is Sale Clause", "required": true, "defaultEnabled": true }
  ],
  "blocks": [
    { "kind": "heading", "text": "Bill of Sale" },
    { "kind": "paragraph", "text": "This Bill of Sale is entered into on {{effective_date}} by and between {{seller_legal_name}} and {{buyer_legal_name}}." },
    { "kind": "paragraph", "text": "The Buyer agrees to pay {{purchase_price}} for the property." }
  ]
}
```

### `docSigningDefaultsJson` shape
```json
[
  { "type": "SIGNATURE", "role": "SELLER", "page": 1, "x": 0.12, "y": 0.86, "width": 0.22, "height": 0.05, "required": true },
  { "type": "DATE_SIGNED", "role": "SELLER", "page": 1, "x": 0.37, "y": 0.86, "width": 0.16, "height": 0.04, "required": true },
  { "type": "SIGNATURE", "role": "BUYER", "page": 1, "x": 0.12, "y": 0.93, "width": 0.22, "height": 0.05, "required": true },
  { "type": "DATE_SIGNED", "role": "BUYER", "page": 1, "x": 0.37, "y": 0.93, "width": 0.16, "height": 0.04, "required": true }
]
```

## API Contracts

All responses follow existing `apiSuccess`/`apiError` style for new routes.

### 1) List templates
`GET /api/templates?type=DOCUMENT&category=General&q=bill`

Response:
```json
{
  "templates": [
    {
      "id": "tpl-doc-bill-of-sale-v1",
      "title": "Bill of Sale",
      "description": "General bill of sale with seller and buyer signatures.",
      "category": "General",
      "type": "DOCUMENT",
      "docVersion": 1,
      "docStatus": "PUBLISHED",
      "thumbnailUrl": "https://...",
      "isFeatured": true,
      "usageCount": 0
    }
  ]
}
```

### 2) Get template detail
`GET /api/templates/[id]`

Response additions for `DOCUMENT`:
```json
{
  "template": {
    "id": "tpl-doc-bill-of-sale-v1",
    "type": "DOCUMENT",
    "docSchemaJson": "{...}",
    "docDefaultValuesJson": "{...}",
    "docSigningDefaultsJson": "[...]",
    "docVersion": 1,
    "docStatus": "PUBLISHED"
  }
}
```

### 3) Create document template instance and draft request
`POST /api/templates/[id]/use`

Request body for `DOCUMENT`:
```json
{
  "kind": "DOCUMENT",
  "titleOverride": "optional string"
}
```

Response for `DOCUMENT`:
```json
{
  "type": "document",
  "requestId": "req_123",
  "templateInstanceId": "dti_123",
  "templateId": "tpl-doc-bill-of-sale-v1"
}
```

Behavior:
- Creates `DocSignRequest` in `DRAFT`.
- Creates `DocumentTemplateInstance` with template version snapshot.
- Records `TemplateUsage`.

### 4) Validate + render document draft
`POST /api/document-templates/instances/[instanceId]/render`

Request:
```json
{
  "values": {
    "effective_date": "March 29, 2026",
    "seller_legal_name": "John Seller LLC",
    "buyer_legal_name": "Jane Buyer",
    "purchase_price": "$2,500.00"
  },
  "enabledClauseIds": ["as_is_clause"]
}
```

Response:
```json
{
  "ok": true,
  "requestId": "req_123",
  "blobUrl": "https://...",
  "documentHash": "sha256...",
  "pages": [{ "page": 1, "widthPts": 612, "heightPts": 792 }]
}
```

Behavior:
- Validates values against `docSchemaJson`.
- Renders deterministic PDF from template blocks.
- Uploads PDF to blob.
- Updates `DocSignRequest.blobUrl/documentHash/originalName`.
- Replaces `DocSignPage` rows for request.
- Updates `DocumentTemplateInstance` with `resolvedValuesJson`, `renderHash`, `renderedBlobUrl`.
- Writes `DocSignAuditLog` event: `DOCUMENT_RENDERED`.

### 5) Apply default signing fields
`POST /api/document-templates/instances/[instanceId]/apply-signing-defaults`

Request:
```json
{
  "recipientRoleMap": {
    "SELLER": "rec_1",
    "BUYER": "rec_2"
  }
}
```

Response:
```json
{ "ok": true, "created": 4 }
```

Behavior:
- Maps default anchors to actual recipient IDs.
- Writes to `DocSignField` with normalized 0–1 coordinates.

## Variable Validation Rules
- Unknown variable keys rejected.
- Missing required variables rejected.
- Type checks:
  - `date_text`: valid string date (normalized format for output).
  - `currency_usd`: parseable currency with fixed 2 decimals.
  - `email`, `phone`: strict formats.
  - `address`, `multiline`: length limits and newline sanitization.
- Max string lengths enforced at API boundary.
- Clause IDs must exist in schema.

## Sender Flow State Machine
- `DRAFT_CREATED` -> `/dashboard/templates/[id]/use`
- `VARIABLES_PENDING` -> render form shown.
- `DOCUMENT_RENDERED` -> preview shown.
- `RECIPIENTS_CONFIGURED` -> existing Step 2.
- `FIELDS_PRESEEDED` (optional) -> existing Step 3.
- `READY_TO_SEND` -> existing Step 4.
- `SENT` -> existing send route.

## UI Contracts (for frontend build)
- New query handoff:
  - `/dashboard/signing/new?requestId=<id>&templateInstanceId=<id>&mode=document-template`
- Signing page should:
  - Load request if `requestId` provided.
  - Skip file upload if document already rendered.
  - Allow editing/adding/removing fields as usual.

## Plan Gating (must enforce server-side)
- Add new feature flag in `src/lib/plans.ts`: `canUseDocumentTemplates`.
- Enforce in:
  - `POST /api/templates/[id]/use` for `DOCUMENT`.
  - Render/apply-default endpoints.
- UI hide is not sufficient.

## Auditing
Add doc-sign audit events:
- `TEMPLATE_SELECTED`
- `DOCUMENT_RENDERED`
- `SIGNING_DEFAULTS_APPLIED`

Include metadata:
- `templateId`, `templateVersion`, `instanceId`, `renderHash`.

## Migration + Rollout Order
1. Prisma schema migration for new fields/model.
2. Backward-compatible API updates (`/api/templates*` still serves forms/secure links unchanged).
3. Render/apply-default endpoints.
4. Gallery type tabs + document card UX.
5. Template variable form + preview screen.
6. Signing flow handoff.
7. Seed 10 document templates in `prisma/seed-templates.ts`.

## Test Plan (required)
- Unit:
  - variable validator
  - clause toggles
  - renderer deterministic output hash check
- Integration:
  - template use -> render -> request blob/pages written
  - apply defaults -> fields created with mapped recipients
- E2E:
  - sender from gallery to send
  - recipient signs
  - signed PDF/certificate downloadable
- Regression:
  - existing `FORM` and `SECURE_LINK` templates still function.

## Implementation Ownership
- Backend-heavy work (recommended Claude):
  - schema migration, renderer endpoints, template instance model, defaults application.
- Frontend-heavy work (recommended Codex):
  - gallery reorg, document variable UI, preview, signing handoff integration.
