# Audit & Phase 1 Report — FityoraStore Ultimate No-VIP

Baseline: `FityoraStore-Ultimate-NoVIP.zip`
Live URL: https://fityoratopup.vercel.app/

## Confirmed from source inspection
1. The previous order RPC assigned `unique_code = 225` to every new order and calculated `total_amount = price + 500 + 225`.
2. The old admin status RPC accepted any of `pending`, `processing`, `success`, and `failed` without enforcing a safe transition path.
3. The customer checkout preview displayed a fixed unique-code value before the database created an order.
4. The admin status selector exposed all statuses regardless of the current status.

## Phase 1 source changes
- Replaced fixed unique code with generated 3-digit code for new orders.
- Added audit fields for payment verification and fulfillment completion.
- Added guarded status transitions and row locking in the admin RPC.
- Updated checkout copy to distinguish estimate from the exact amount returned by the order-creation RPC.
- Updated admin status selector and added manual processing guidance.
- Added migration and deployment notes.

## Not verified
- The live Vercel site's interactive features, real payment destinations, and live Supabase state were not verified.
- The new SQL migration has not been applied to production or tested against a live database.
- `npm ci` timed out; `npm run typecheck` could not complete because type definitions in the local dependency tree are missing.
- Do not treat this release as production-verified until Preview tests and SQL validation pass.
