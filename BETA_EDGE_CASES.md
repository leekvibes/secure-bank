# Beta Edge Cases Checklist

Manual verification targets for bug bash and stability pass.

## Request Detail And Timeline

- Open `/dashboard/links/[id]` for an expired request and verify:
  - page loads (not redirected or crashed)
  - status displays as `Expired`
  - send/copy actions are hidden or disabled
- Open a request with no sends and verify:
  - "Send history · 0" card renders
  - empty state message appears ("No sends recorded yet.")
- Open a request with sends and verify:
  - timeline includes send events in chronological order
  - send history shows newest send first
- Open a request with no submission and no ID upload and verify:
  - page renders without reveal/export section errors

## Client Contact And Destination Edge Cases

- Request with missing `clientPhone` and available `clientEmail`:
  - send panel defaults to `Email`
- Request with missing `clientPhone` and missing `clientEmail`:
  - send panel defaults to `Copy`
  - copy action succeeds and records send history entry
- Request with missing `destinationLabel` and `destination`:
  - message builder falls back to `Internal processing`
  - detail page shows destination as `—`
- Request with no assets selected:
  - detail page renders without asset thumbnail section
  - no layout break in header

## Submission Reveal / Export History

- Request with submission but no reveals:
  - "Reveal count" is `0`
  - "Last revealed" shows `Never`
- Request with submission and no exports:
  - timeline does not error when `EXPORTED` event is absent
- Export submission (JSON and TXT):
  - files download
  - audit timeline records `EXPORTED`

## ID Upload Download

- Agent A cannot download Agent B upload (403)
- Upload owner can download successfully
