# FITYORA TOPUP Phase 45 — Price Editing Repair

## What this fixes
- Adds explicit authenticated write grants for `public.packages`.
- Recreates the `staff_manage_packages` RLS policy so only accounts accepted by `public.is_admin()` can insert, update, or delete packages.
- Keeps package SELECT public for the storefront catalog.
- Admin price saving now checks the returned database price before reporting success.
- Price input rejects negative values and supports whole-rupiah increments.

## Apply order
1. In the Supabase project used by the live FITYORA TOPUP website, open SQL Editor.
2. Review and run `FITYORA-TOPUP-Phase45-Price-Edit-Fix.sql`.
3. Confirm the query returns a `staff_manage_packages` policy for `public.packages`.
4. Deploy the Phase 45 ZIP to Vercel after the normal build and release checks pass.

## Safety
This migration does not update existing package prices or delete/modify order records. It is transactional and safe to re-run. It relies on the existing `public.is_admin()` function used by the current admin dashboard. If that function is missing, the migration will fail rather than silently opening write access.

## Verification limits
Static source checks only. This environment did not validate the migration against the live Supabase project, perform a real admin login, or complete a production build. Test editing one low-risk package price in staging or a controlled test record first.
