# Phase 51 — Local Supabase Configuration & Key Safety

## What changed
- Added `.env.local` at the project root with the Supabase URL and public publishable key supplied by the project owner.
- Kept `VITE_SUPABASE_PUBLISHABLE_KEY` as the canonical variable and the `VITE_SUPABASE_ANON_KEY` alias for backward compatibility.
- Updated the setup guide to distinguish local `.env.local` from Vercel Environment Variables.
- Added a Vite pre-bundle guard that refuses modern secret keys and legacy JWTs with elevated service role claims before the browser bundle is emitted.
- Added a static regression suite runnable with `npm run audit:phase51`.

## Important limits
- A publishable key is intended for browser use and is not a database authorization boundary by itself. Verify RLS is enabled and policies use least privilege for every exposed table, view, RPC, and storage bucket.
- `.env.local` is for local development only. Configure the same URL and publishable key explicitly under Vercel Project Settings → Environment Variables, then redeploy.
- No live database migration was applied, and no production Supabase/Vercel transaction was run in this change.
- The root directory is the canonical project. `fityora39/` is a separate nested project snapshot and is not updated by this root configuration.
