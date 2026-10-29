# Phase 17 — Product Catalog & Package Selection

## Changes
- Added package sorting options: original catalog order, lowest price first, and highest price first.
- Improved package cards with a clearer price hierarchy, compact popularity marker, and visible selection affordance.
- Added accessible labels and selected-state semantics to package selection buttons.
- Kept package search across package name and description, with an empty-result recovery action.
- Reset package search/sort, selected package, target/server fields, payment choice, and stale error text when a different brand is selected. Category changes reset package sort as well.
- Displayed prices continue to come from the loaded Supabase `packages` records and use the existing IDR formatter. No client-side price table, checkout RPC, payment behavior, or database schema was changed.
- Added `npm run audit:phase17` and tests for package search, sorting, state reset, accessible selection, data-backed prices, responsive styling, and reduced motion.

## Verification
- All local Node source-contract tests: **77 passed, 0 failed**.
- Phase 5 static audit: **20/20 passed**.
- Phase 6 source preflight: **51/51 passed**.
- Phase 9 production-readiness audit: **17/17 passed**.
- Phase 10 release audit: **9/9 passed**.
- TypeScript syntax transpile scan: **24 `.ts`/`.tsx` files, 0 syntax diagnostics**.
- ZIP integrity check: expected to be checked after archive creation.

## Limitations
`npm run check` did **not** pass because this working environment has no installed project dependencies (`react`, `react/jsx-runtime`, React type declarations, and other packages could not be resolved). Consequently, full TypeScript typecheck stopped early; lint and Vite production build were not reached. Browser rendering, real Supabase queries, payment, and deployed behavior have not been tested in this phase.

## Deployment notes
No new runtime dependencies were added. No database migration is required for this UI-only change. Install dependencies in a connected environment using `npm ci`, then run `npm run audit:phase17` and `npm run check` before deploying to a Vercel Preview environment.
