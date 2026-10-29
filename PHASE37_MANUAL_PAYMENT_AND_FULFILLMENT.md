# FITYORA TOPUP — Phase 37: Manual Payment & Supplier Fulfillment

## Scope
- Keeps payment gateway integration out of the project.
- Adds optional proof-of-payment upload for the current order.
- Accepts JPG, PNG, and WebP up to 5 MB; files live in a private Supabase Storage bucket.
- Restricts upload to the signed-in owner of a pending order and stores only the private object path on the order.
- Admin can request a short-lived signed URL from the private bucket to inspect the proof.
- Uploading proof does **not** mark an order paid, processing, or successful. Staff must verify incoming funds, then move the order through the existing guarded workflow.
- Glory Voucher fulfillment remains manual until an authorized supplier API and its documentation are available.

## Required deployment step
Review and apply `supabase/migrations/20261027010000_manual_payment_proofs.sql` to the intended Supabase project. The ZIP cannot apply a migration to a live project automatically. Then deploy the frontend and test with a non-production order and a test image.

## Verification boundary
The Phase 37 regression tests validate the frontend contract and SQL source statically. They do not prove that the migration was applied, Storage policies work in a live Supabase project, signed URLs work against production data, or payments/top-ups have been received/fulfilled. Those require a controlled live test after migration.
