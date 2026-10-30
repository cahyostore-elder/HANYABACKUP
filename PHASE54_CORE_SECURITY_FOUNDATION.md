# Phase 54 — Core Security & Commerce Foundation

## Scope
- Uses `CREATE OR REPLACE FUNCTION` for the seven-argument order RPC created by Phase 53; this avoids a duplicate-function error when migrations are applied in timestamp order.
- Changes newly generated unique payment codes to an inclusive range of **Rp200–Rp999**. Allocation scans the full range from a randomized starting point, so it does not fail early just because random retries missed the last free code.
- Preserves server-side fee calculation, authenticated RPC access, input validation, and request idempotency.
- Includes a read-only Supabase security audit for RLS, policies, `SECURITY DEFINER` functions, RPC grants, and suspicious order totals.
- Does not rewrite historical orders or mark payments as paid.

## Payment rules retained
- QRIS: Rp300 admin fee.
- DANA, GoPay, OVO, ShopeePay: Rp500 admin fee.
- SeaBank: Rp1,000 admin fee.
- Total = database package price + method fee + server-generated unique code.

## Apply safely
1. Confirm this is the correct FityoraStore Supabase project and that it matches the project's Vercel environment variables.
2. Back up Supabase first and confirm the Phase 53 migration was applied. Do not apply migrations to an unknown or wrong Supabase project.
3. Run `supabase/migrations/20261028030000_phase54_core_security_and_payment_code_range.sql` in Supabase SQL Editor.
4. Run `supabase/PHASE54_READONLY_SECURITY_AUDIT.sql`; inspect the output. It is a diagnostic only and does not automatically fix findings.
5. Copy `scripts/phase54-core-security.test.mjs` into the repository `scripts/` folder and add this script to `package.json`:

   `"audit:phase54": "node --test scripts/phase54-core-security.test.mjs"`

6. Run `npm run audit:phase54`, then `npm run check` and the existing release audits. Only deploy if all checks pass.
7. Create test orders for QRIS, one e-wallet, and SeaBank. Confirm the database returns a unique code between 200 and 999, total matches the server response, retries with the same request ID do not duplicate orders, and payment remains pending until verified.

## Important limitations
- This patch is not proof that the live site or database is fully secure. The read-only audit results must be reviewed and a live checkout test is required.
- The unique code is a reconciliation aid, not guaranteed profit. Verify actual payment-provider fees and settlement behavior.
- Existing orders keep their original total and code; only newly created orders use Rp200–Rp999 after this migration is applied.
- Never put Supabase `service_role` or secret keys in `VITE_*` variables or client-side code.
