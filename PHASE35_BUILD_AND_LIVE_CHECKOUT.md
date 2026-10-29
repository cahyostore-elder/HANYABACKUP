# Phase 35 — Build Readiness & Live Checkout Verification

## Status at packaging

- Phase 34 source regression baseline: **162/162 tests passed** when rerun with Node.js 22.16.0.
- Phase 35 build-readiness checks are added to `node --test scripts/*.test.mjs` and `npm run audit:release`.
- `npm run check` was attempted, but could not complete because project dependencies were not installed in this execution environment. `npm ci` could not fetch registry packages (`EAI_AGAIN` / npm exit-handler error). TypeScript, ESLint, and the Vite production build therefore remain **unverified**, not failed due to confirmed source diagnostics and not passed.
- No project-specific Supabase credentials/database access were available. The idempotency migration has **not** been executed against a live database. Real bank payment and top-up fulfillment have not been tested.

## Re-run checks in an environment with npm registry access

From the extracted project directory:

```bash
npm ci
npm run check
node --test scripts/*.test.mjs
npm run audit:release
```

Do not use a partially populated `node_modules` from an interrupted installation. If installation fails, remove `node_modules` and rerun `npm ci` with working network/DNS before drawing conclusions about typecheck, lint, or build.

## Safe Preview rollout

1. Back up the correct Supabase project. Review the live migration history and schema; do not blindly replay old seed migrations.
2. Apply `supabase/migrations/20261027000000_order_creation_idempotency.sql` using the project's normal migration workflow. Confirm the RPC signature accepts `p_request_id` and `authenticated` has execute permission while `anon` and `PUBLIC` do not.
3. Configure only `VITE_SUPABASE_URL` and a public publishable/anon key in Vercel frontend settings. Never use a Supabase service-role or secret key in a `VITE_*` variable.
4. Deploy to **Vercel Preview**, not production. Use a controlled test account and an explicitly designated test product/package.
5. Test login-required checkout, correct server-returned amount, order status lookup, and the admin's guarded status transitions.
6. Test retry-after-lost-response: submit once, simulate a lost response/retry with the same request key and unchanged payload, and confirm only one order exists. Confirm that reusing the same request key with different payload is rejected.
7. Verify payment against the real bank/provider record and only mark fulfillment complete after it actually occurred. Payment verification and top-up fulfillment remain manual unless a real provider integration is separately implemented and validated.
8. Promote to production only after `npm run check`, all regression/release tests, and the live Preview checks pass. Keep the prior deployment available for rollback.

## Decision

**Not certified production-ready yet.** Static regression checks can pass while a build, Supabase migration, permission check, or live payment test remains blocked or unverified. Do not claim a successful build until it has actually run with installed dependencies, and do not deploy the new checkout frontend before the matching database migration is applied.
