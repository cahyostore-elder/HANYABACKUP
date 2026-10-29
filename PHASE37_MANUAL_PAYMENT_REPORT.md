# Phase 37 — Manual Payment & Supplier Fulfillment

Implemented:
- Optional payment-proof upload in checkout result panel.
- Private Supabase Storage bucket `payment-proofs`, capped at 5 MiB and restricted to JPEG/PNG/WebP.
- Authenticated order-owner checks and pending-order-only proof submission through `submit_payment_proof` RPC.
- Admin action to open proof through a 60-second signed URL.
- No payment gateway SDK or runtime dependency added.
- Existing manual status sequence remains: `pending` → `processing` only after funds are verified, then `success` only after fulfillment is complete.
- Glory Voucher fulfillment remains manual; no supplier API integration is claimed.

Verification:
- Phase 37 focused regression tests: 7/7 passed.
- Full `npm run audit:release`: exit code 0, including Phase 37.
- `npm run check` attempted but could not be validated in this environment because dependencies are not installed (`node_modules` absent); TypeScript then reports missing React/JSX type declarations. `npm ci` must succeed in a network-enabled environment before build/typecheck/lint can be claimed.
- Live Supabase migration, Storage RLS, proof upload, signed URL, and actual payment/top-up remain unverified until migration is applied to the intended Supabase project and tested there.

Deployment prerequisite:
1. Review and apply `supabase/migrations/20261027010000_manual_payment_proofs.sql` to the intended Supabase project.
2. Deploy the frontend to Vercel.
3. Run a controlled test order, upload a test image, confirm staff can view the signed URL, verify that uploading proof does not mark the order paid, and test the manual processing/success sequence.
