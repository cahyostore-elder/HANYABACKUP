# FITYORA TOPUP — Phase 36 Supabase Verification

## Purpose

Phase 36 adds a read-only diagnostic script and contract tests for the order-creation idempotency migration. It does **not** connect to or change your Supabase project, and it does not certify live payments or top-up fulfillment.

## Safe validation order

1. Back up the target database and inspect the migration `supabase/migrations/20261027000000_order_creation_idempotency.sql`.
2. Apply it first to a disposable/test Supabase project or a database clone, not production.
3. In the test project's SQL Editor, run `supabase/PHASE36_READONLY_ORDER_DIAGNOSTICS.sql`.
4. Confirm `orders.client_request_id` exists and is nullable, the partial unique index exists, the expected seven-argument `create_topup_order` function is active, and only `authenticated` has execute permission (`anon` should be false).
5. Deploy the matching frontend to Vercel Preview only after the function signature and grants are confirmed.
6. Run controlled tests: logged-out checkout denied; valid order created once; retry with same request key and same payload returns same order; same key with changed payload rejected; invalid brand/package rejected; database total is used; unauthorized user cannot read another user's order.
7. Test the manual workflow separately: verify payment before moving pending to processing; mark success only after actual fulfillment; ensure failed/final orders behave as intended.
8. Keep production deployment blocked until `npm ci`, `npm run check`, all regression/release audits, and Preview checks pass in an environment with working npm registry and real test credentials.

## Important boundaries

- The SQL diagnostic is read-only and is not a migration.
- Do not paste service-role keys, database passwords, or private payment credentials into chat or commit them to the repository.
- The current project still uses manual payment verification and manual top-up fulfillment unless a real provider integration is separately implemented and verified.
- Static tests confirm source contracts only; they cannot prove that a remote database has the expected schema or permissions.
