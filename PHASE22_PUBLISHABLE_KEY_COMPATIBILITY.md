# Phase 22 — Supabase Publishable Key Compatibility

## Changes
- Supabase client now prefers `VITE_SUPABASE_PUBLISHABLE_KEY` (current key naming) and falls back to `VITE_SUPABASE_ANON_KEY` for existing deployments.
- Updated setup warning and `.env.example` to use the publishable-key variable by default.
- Kept the real project URL/key out of the source bundle.
- Added four focused regression tests for environment-key compatibility and safe configuration.

## Verification
- Node regression tests: 103 passed, 0 failed.
- Full `npm run check` could not complete because dependency installation in this environment timed out and left incomplete type-definition packages. TypeScript check reports missing dependency type definitions; lint/build are therefore not claimed as passed.
- No production deployment, live Supabase request, browser E2E test, or database mutation was performed.

## Vercel setup required
Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for the Production environment (and Preview if desired), then redeploy. The existing `VITE_SUPABASE_ANON_KEY` variable remains supported for backwards compatibility, but do not set a secret/service-role key in any `VITE_*` variable.
