# FityoraStore Ultimate No-VIP — Phase 8 Regression & Security Contract Audit

## Changes
- Added `scripts/phase8-regression.test.mjs` using Node's built-in test runner; no extra dependency is required.
- Registered `npm run audit:phase8` in `package.json`.
- The regression suite checks RPC `search_path` pinning, public/anon execute revocation, authenticated order creation, package-brand relation, server-side payment-method allowlist, row locking during status transitions, scoped order lookup signature, frontend key safety, checkout pending-state cleanup, admin RPC usage, accessible lookup errors, and audit script registration.

## Results from this environment
- Phase 8 regression contracts: **12 passed, 0 failed**.
- Phase 7 integration contracts: **18 passed, 0 failed**.
- Phase 6 static preflight: **51 passed, 0 failed**.
- Phase 5 static audit: **20 passed, 0 failed**.

## Important limits
These are source-contract/static tests. They do not execute PostgreSQL functions or validate actual Supabase RLS policies against a live database. They do not replace TypeScript semantic typecheck, ESLint, Vite production build, browser E2E tests, or a payment sandbox run. `npm ci` has previously timed out because the npm registry could not be reached, so full build verification remains outstanding. No SQL migration was applied and no production data was changed.

## Recommended commands when dependencies/network are available
```bash
npm ci --no-audit --no-fund
npm run check
npm run audit:static
npm run audit:phase6
npm run audit:phase7
npm run audit:phase8
```

Use a separate Supabase staging project for live tests. Never put a service-role key in `VITE_*` frontend variables.
