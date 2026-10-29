# Phase 34 — Integration and Production Validation

## Scope

This phase audits the exact Phase 33 source bundle before adding more storefront features. It adds a small regression suite to check the frontend/SQL RPC contract, migration safety invariants, RPC permissions, deployment order, and release-script registration. It adds no runtime dependencies and does not alter customer catalog, account details, payment destinations, or order pricing logic.

## Local validation performed

- `node --test scripts/*.test.mjs`: **156/156 tests passed** before Phase 34 tests were added.
- `npm run audit:release`: **all existing release checks passed** (Phase 10 9/9, preflight 12/12, Phase 29 7/7, Phase 30 10/10, Phase 31 7/7, Phase 32 8/8, Phase 33 8/8).
- Phase 34 migration/RPC contract tests are included and should be run using `npm run audit:phase34` or `npm run audit:release`.
- ZIP integrity and excluded-file checks are run separately after packaging.

## Validation still blocked / not claimed

- `npm ci --ignore-scripts --no-audit --no-fund --prefer-offline` timed out in this environment. The interrupted partial `node_modules` directory was removed. Therefore **TypeScript typecheck, ESLint, and Vite production build have not been verified in this run**.
- No Supabase project credentials or live database connection were available. The migration has **not** been executed against a database, and live RLS/RPC/customer/admin tests are not claimed.
- Vercel deployment, real bank transfer verification, and actual top-up fulfillment are not verified by source tests.

## Required rollout sequence

1. Back up the correct Supabase project and inspect its migration history/schema.
2. Apply `supabase/migrations/20261027000000_order_creation_idempotency.sql` through the normal migration workflow and confirm the function signature and grants.
3. Configure only the public Supabase URL and publishable/anon key in Vercel frontend environment variables; never put a service-role/secret key in `VITE_*` variables.
4. Install dependencies successfully and pass `npm run check` plus `npm run audit:release` in CI.
5. Deploy to Vercel Preview, then test sign-in, a controlled test order, retry-after-lost-response, order status lookup, and admin status transitions using authorized test accounts.
6. Verify payment against the real bank/provider record and confirm fulfillment manually. The app is not represented as an automatic payment gateway.
7. Promote to production only after all checks pass; retain the previous deployment for rollback.

## Decision

**Not yet certified production-ready.** Static/regression checks are positive, but dependency installation/build and live database/payment checks remain required. Do not deploy the new checkout frontend ahead of the matching database migration.
