# Plan Feature Matrix

This file is the source-of-truth process for plan gating.

## Current tiers

- `FREE`: secure links only, lifetime cap of 10 links
- `BEGINNER`: secure links only, monthly cap of 50 links
- `PRO`: secure links + custom forms + file transfers
- `AGENCY`: secure links + custom forms + file transfers + higher team cap

## Where entitlements are defined

- Code matrix: `src/lib/plans.ts`
- Automated guard tests: `tests/security/plans.test.ts`

## Rule when adding a new feature

1. Add a new `PlanFeature` in `src/lib/plans.ts`.
2. Add that feature to each plan's `features` array.
3. Add server-side gate checks in all related API routes.
4. Add dashboard route/nav gating so non-eligible users cannot access the UI path.
5. Add/adjust tests in `tests/security/plans.test.ts` (and endpoint tests as needed).

## Non-negotiable policy

- Never rely only on UI hiding.
- Every paid feature must enforce entitlement in API/server handlers.
