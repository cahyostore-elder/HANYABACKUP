# FityoraStore Ultimate No-VIP — Phase 1

## Changes included
- Added migration `20261026030000_manual_order_workflow_hardening.sql` for the manual payment/order workflow.
- New orders keep the Rp500 admin fee and receive a generated 3-digit code instead of the old hardcoded Rp225.
- Allocation serializes unique-code generation and avoids transfer totals already used by pending/processing orders.
- Added audit columns for payment verification and fulfillment completion.
- Admin status transitions are constrained: `pending -> processing -> success`; `pending/processing -> failed`. `success` and `failed` are terminal.
- Updated checkout wording so it does not display a fake fixed unique code before the order exists; the exact amount is shown after the database creates the order.
- Added status workflow guidance to the admin order list.
- Existing order records are not deleted or rewritten by this migration.

## Deployment steps
1. Download and retain a backup of the production database before applying SQL.
2. Review and run `supabase/migrations/20261026030000_manual_order_workflow_hardening.sql` in the intended Supabase project.
3. Ensure the existing `public.is_admin()` function is correct and admin/author profiles are assigned intentionally.
4. Deploy this source to a Vercel Preview deployment first; verify login, order creation, exact transfer amount, admin transitions, and customer order history using test accounts/test data.
5. Promote to production only after Preview tests pass.

## Verification limits
- This package has not been applied to the live Supabase database.
- The live website's full interactive flow has not been tested.
- `npm ci --ignore-scripts --no-audit --no-fund` timed out in the working environment.
- `npm run typecheck` failed because the available `node_modules` tree is incomplete (missing type definitions including React, Node, and other transitive types). This is an environment/dependency verification failure, not proof that the source compiles.
- SQL syntax/runtime was not validated against a live PostgreSQL/Supabase instance.
