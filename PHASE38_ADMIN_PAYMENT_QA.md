# Phase 38 — Manual Payment & Admin Workflow QA

## Scope
- Adds a focused regression suite for the manual payment-proof and admin review workflow.
- Confirms checkout accepts only JPEG/PNG/WebP and blocks repeat submission while uploading/submitted.
- Confirms proof submission calls the database RPC and does not set paid status in the client.
- Confirms admin opens proof using a short-lived signed URL with `noopener,noreferrer`.
- Confirms migration has private bucket/owner/status checks and supplier fulfillment remains manual.
- Adds Phase 38 tests to `npm run audit:release`.

## Verification results
- Phase 38 focused regression tests: 6/6 passed in the supplied source archive.
- Phase 36 + 37 regression tests: 15/15 passed.
- Phase 10 release source audit: 9/9 passed.
- ZIP integrity verified.
- Full TypeScript/lint/build remains **unverified**: dependencies are absent in this environment and the earlier check showed missing React/JSX modules. Run `npm ci` in a network-enabled environment, then `npm run check`.
- Live Supabase policies, migration application, Vercel deployment, real incoming payments, and real Glory Voucher fulfillment have not been tested from this environment.

## Before deployment
1. Review and apply migration `supabase/migrations/20261027010000_manual_payment_proofs.sql` to the correct Supabase project.
2. Verify private bucket and RLS policies using a test member and admin account.
3. Upload a test image; confirm the member cannot read other members' proof and admin access expires.
4. Verify payment status remains unpaid until admin confirms receipt of funds.
5. Test manual supplier fulfillment and only mark success after the supplier result is confirmed.
