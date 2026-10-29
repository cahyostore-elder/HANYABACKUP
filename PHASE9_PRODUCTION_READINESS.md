# Phase 9 — Production Readiness Audit

## Changes
- Added `npm run audit:phase9` to check deployment/configuration assumptions without external credentials.
- Fixed Supabase placeholder detection: the exact publishable-key placeholder in `.env.example` is now recognized as unconfigured. Previously, the example placeholder text did not match the guard, which could make the UI treat a copied example key as configured.
- Kept the Vercel SPA fallback and confirmed required build/typecheck/lint scripts are declared.

## Checks
Run `npm run audit:phase9` after dependencies are installed (the script itself uses Node built-ins only and can also run directly with `node scripts/phase9-production-readiness.mjs`).

## Deployment checklist
1. In Vercel Project Settings → Environment Variables, set `VITE_SUPABASE_URL` to the project URL and `VITE_SUPABASE_ANON_KEY` to the project's public/publishable anon key. Do not put a service-role key in browser environment variables.
2. Set the variables for the correct environments (Preview and Production), then redeploy after changing them.
3. Review and test Supabase migrations in a separate staging project before applying to production. Do not run migrations blindly.
4. Confirm Supabase Row Level Security (RLS) policies and RPC permissions using a non-admin test account and an admin test account.
5. Test signup/login/logout, catalog loading and error states, checkout, order lookup, admin-only actions, and mobile layout in Preview.
6. Use a test payment flow; never mark an order successful until fulfillment is confirmed by the operator/provider.
7. Run `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build`, then `npm run preview` and browser smoke tests.

## Limitations
This audit does not contact Supabase, inspect live project settings, execute a real payment, or deploy to Vercel. Build/typecheck/lint are not claimed as passed unless separately run successfully. The public website title can be observed, but that alone does not verify its checkout or admin flows.
