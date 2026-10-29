# FityoraStore Phase 10 — Release Candidate Audit

## Scope
This phase packages the Phase 9 source as a release candidate and adds a repeatable release audit. It does not deploy the site or modify the live Supabase database.

## Verified locally
- Phase 5 static audit: 20/20 passed.
- Phase 6 source preflight: 51/51 passed.
- Phase 7 integration contract tests: 18/18 passed.
- Phase 8 regression tests: 12/12 passed.
- Phase 9 production-readiness checks: 17/17 passed.
- Phase 10 release audit: see `PHASE10_CHECK_RESULTS.txt`.
- ZIP integrity checked after packaging.

## Build limitation
`npm ci --ignore-scripts --no-audit --no-fund` timed out in this environment. Therefore TypeScript project typecheck, ESLint, and Vite production build are **not verified**. Passing source-contract tests does not prove runtime behavior or production readiness.

## Before production release
1. In an environment with npm registry access, run `npm ci`.
2. Run `npm run typecheck`, `npm run lint`, and `npm run build`; fix any errors and rerun.
3. Deploy to Vercel Preview and set `VITE_SUPABASE_URL` plus `VITE_SUPABASE_ANON_KEY` in the appropriate environment. Never put a service-role key in frontend variables.
4. Review and test Supabase migrations in a staging project first.
5. Use test accounts to verify login, checkout, order lookup, staff permissions, manual payment verification, and fulfillment. Do not mark an order successful until fulfillment is actually confirmed.
6. Only promote to production after all checks pass.

## Honest status
This is a source release candidate, not a certified production build. Live Supabase behavior, payment flows, browser/mobile UI, and Vercel deployment were not tested in this phase.
