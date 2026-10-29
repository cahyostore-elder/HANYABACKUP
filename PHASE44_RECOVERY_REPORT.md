# FITYORA TOPUP — Phase 44 Recovery & Pre-Deploy Audit

## Main fix
- Admin dashboard no longer treats a missing `public.site_settings` table as a failure of all admin data.
- The global maintenance gate fails open if its optional setting cannot be read, logs the issue once, and avoids repeated polling when the table is unavailable.
- Maintenance controls show an explicit instruction and remain disabled until the table is available.
- Added `supabase/migrations/20261027050000_phase44_site_settings_maintenance_only.sql` to create/seed the missing table, configure public read-only access under RLS, and provide a SECURITY DEFINER admin/author-only maintenance RPC.
- Migration deliberately does not alter order deletion/status/payment RPCs.
- Preserved Phase 43 remote square icons for Call of Duty Mobile, FC Mobile, and Honor of Kings.

## Checks
- Phase 44 static regression tests: 5/5 passed.
- Phase 41/42 targeted tests: rerun after updating the maintenance polling expectation.
- Full TypeScript/lint/Vite build: not verified; `npm ci` timed out in this environment, so do not treat this archive as production-build verified.
- Live Supabase schema and checkout were not accessible from this local static audit.

## Before redeploy
1. Review and run only `supabase/migrations/20261027050000_phase44_site_settings_maintenance_only.sql` in Supabase SQL Editor.
2. Verify the result with `select id, maintenance_enabled, maintenance_message from public.site_settings;`.
3. Deploy this source to Vercel after configuring `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or supported legacy anon key).
4. After deployment, test login, storefront catalog, checkout/order creation, admin orders, and maintenance toggle with a real admin account.
