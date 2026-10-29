# Phase 20–21 Release Gate Report

## Delivered in this source bundle
- Customer history pagination, filtering, copy-code action and expanded order details.
- Spending total counts only explicitly successful orders.
- React hook-order fix in the dashboard.
- New SQL migration to pin the order lookup function search path and qualify referenced tables.
- Focused tests and static-audit logs included in the project root.

## Verification actually completed
| Check | Result |
|---|---:|
| Node regression tests (`node --test scripts/*.test.mjs`) | 99 passed, 0 failed |
| TypeScript syntax-only transpile scan | 24 files, 0 diagnostics |
| Phase 5 static audit | 20/20 passed |
| Phase 6 preflight | 51/51 passed |
| Phase 9 production readiness static checks | 17/17 passed |
| Phase 10 release audit | 9/9 passed |
| ZIP integrity | checked after package creation |

## Release blockers / not tested
- `npm ci --no-audit --no-fund` timed out in the available environment. Full semantic typecheck, ESLint and Vite production build could not be completed.
- Browser/device E2E tests were not run.
- The new SQL migration was not executed on PostgreSQL/Supabase and live RLS/role behavior was not tested.
- No live payment or top-up provider is integrated/verified; the documented store workflow remains manual.
- No Vercel deployment has been performed.

## Required before production deployment
1. Install dependencies successfully, then run `npm run check` and resolve every error.
2. Apply/verify Supabase migrations in a backed-up project and test RLS as anonymous, ordinary member and staff.
3. Configure only the Supabase publishable/anon key in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; never put a service-role/secret key in frontend variables or source.
4. Test signup/login, order creation, lookup, staff status transitions, mobile layouts and network-failure recovery in a staging environment.
5. Deploy to Vercel only after all above checks pass, then verify the deployed site and database integration.

This is a development checkpoint bundle, not a claim of production readiness.
