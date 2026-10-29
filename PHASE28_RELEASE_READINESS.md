# Phase 28 — Release Readiness & Quality Gate

This phase prioritizes making release checks repeatable. It does **not** claim the production site has been deployed or live-payment tested.

## Included

- A GitHub Actions quality workflow on pull requests and pushes to `main`/`master`.
- A release preflight that checks essential project files, lockfile consistency, environment template hygiene, Vercel SPA fallback, and release documentation.
- A single `npm run audit:release` command for static release checks and the existing release audit.
- Existing regression tests remain in place; no database migration or Supabase schema changes are introduced in this phase.

## Required before production

1. Use Node.js 22 and run `npm ci` from the project root.
2. Run `npm run check` (TypeScript, ESLint, Vite production build).
3. Run `node --test scripts/*.test.mjs` and `npm run audit:release`.
4. Deploy to a **Preview** environment first and test on a phone and desktop.
5. Verify sign-in/sign-out, catalog search and retry, product/package selection, target/server validation, order creation, order-status lookup, and admin access using separate customer/staff accounts.
6. Confirm an order is only marked successful after payment and service fulfillment are actually verified. Payment and top-up delivery remain manual unless a separately implemented and tested provider integration exists.
7. Promote the verified preview to production and keep the previous production deployment available for rollback.

## Environment safety

- Required frontend variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (legacy `VITE_SUPABASE_ANON_KEY` is supported by the source).
- Frontend variables must contain only the public publishable/anon key. Never put Supabase `service_role` or secret keys in `VITE_*` variables, source files, or Git.
- Vercel environment variable changes apply to new deployments, so redeploy after changing them.
- No `.env.local` or actual credentials are included in this ZIP.

## Verification status for this artifact

- Node built-in regression tests: run locally without installing packages.
- Release preflight: run locally without installing packages.
- Full TypeScript/lint/build: **not verified in this environment** because dependency installation timed out.
- Live Supabase, checkout, payment, email, WhatsApp, and admin behavior: **not verified here**; test in Preview before production.
