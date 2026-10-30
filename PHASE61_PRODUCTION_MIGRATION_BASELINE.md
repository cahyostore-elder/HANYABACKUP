# Phase 61 — Production Migration Baseline and Safe Rollout

Snapshot date: 2026-10-30 (Asia/Jakarta). This document records the read-only audit performed against the live Supabase project and supersedes the older pre-merge status notes.

## Repository and deployment

- Repository: `cahyostore-elder/FITYORATOPUP`, default branch: `main`.
- PR #1 (Phase 56/57 integration) is merged. Merge commit: `230b5b2b5c63cadcdff2c0604855d0f7fb389437`.
- The Vercel check for the merge commit reported **success**. This confirms the deployment check, not a complete end-to-end checkout or Author-dashboard smoke test.
- Phase 62 correction branch: `phase62-markup-audit-correction`. It corrects the UI language to “markup 7%” and changes pending Phase 58/60 audit SQL to store actual gross margin, rather than recording markup as margin. These edits do not change any catalogue selling price.

## Live Supabase project

- Project ref: `xgmbwvwiryimwenhwhbu`.
- URL: `https://xgmbwvwiryimwenhwhbu.supabase.co`.
- Status: `ACTIVE_HEALTHY`; region: `ap-southeast-1`; PostgreSQL 17.11.
- The live project returned 11 public tables and RLS was enabled on all 11.
- Current row counts observed: profiles 1; categories 3; brands 18; packages 309; orders 0; promo banners 2; testimonials 6; FAQs 11; site settings 1; package supplier costs 0; package pricing audit 0.
- No supplier-cost rows or pricing-audit rows were inserted by the reviewed work. No live selling prices were changed by the reviewed work.

## Critical migration-history state

- `supabase_migrations` schema is absent.
- `supabase_migrations.schema_migrations` is absent.
- Supabase `list_migrations` returned an empty list.
- Therefore there is no trustworthy remote migration ledger to use for an automatic `db push`. The production schema is a mixed/manual state; an empty migration list does **not** prove that no migration effects were applied manually.

## Verified live schema/function differences

- `public.package_supplier_costs` exists, has RLS enabled and includes `updated_by`, but its current constraint is `CHECK (supplier_cost > 0)`. It rejects Rp0; Phase 57A changes this to `CHECK (supplier_cost >= 0)`.
- The live `admin_list_package_supplier_costs()` and `admin_upsert_package_supplier_cost(uuid,numeric)` functions are older implementations.
- `private.is_admin()` and `admin_save_package(...)` are missing from production.
- Phase 58 `admin_update_supplier_cost_and_price(uuid,numeric)` is missing.
- Phase 60 `admin_apply_package_pricing_batch(jsonb)` is missing.
- The existing seven-argument `create_topup_order(..., p_request_id uuid)` checks `v_price <= 0` (so zero-price packages cannot be checked out), but the live payment-code allocator still chooses Rp200–Rp400. Phase 54 expands that allocation to Rp200–Rp999. The existing `orders.unique_code` check allows 100–999, so the target range is compatible.
- `public.generate_order_code()` has no pinned `search_path`.
- `public.lookup_order(text)` is a public SECURITY DEFINER RPC callable by `anon`. It intentionally supports guest order tracking and returns a limited order summary, but it still needs abuse/rate-limit review.
- `public.rls_auto_enable()` is attached to the active `ensure_rls` event trigger and its execute ACL still includes PUBLIC/anon/authenticated. Phase 59 revokes browser execution; the event trigger itself must remain intact.
- Catalog tables have duplicate public-read and staff-manage policies. The Phase 59 migration replaces these with operation-specific staff write policies and removes redundant reads.
- Profile column grants were checked: authenticated users can update the intended profile columns (`display_name`, `bio`, `avatar_url`), but cannot update `role` or `id`. Do not widen profile grants.

## Security-advisor snapshot

The latest production security advisor reported:
- `rls_enabled_no_policy`: 2 INFO findings for private pricing tables. Direct table access is not granted to anon/authenticated; the intended access path is the admin-gated SECURITY DEFINER RPCs. Phase 59 adds explicit restrictive deny policies as a backstop.
- `function_search_path_mutable`: 1 WARN for `public.generate_order_code()`.
- `anon_security_definer_function_executable`: 2 WARN findings: guest `lookup_order(text)` (intentional, rate-limit review required) and `rls_auto_enable()` (browser execution should be revoked).
- `authenticated_security_definer_function_executable`: 13 findings. Each exposed admin RPC must retain an explicit `auth.uid()` and Author/Admin check; do not grant these to anon.
- `auth_leaked_password_protection`: 1 WARN. This is an Auth dashboard setting and must be enabled manually under Supabase Auth password/security settings.

Re-run both Security and Performance advisors after each production migration.

## Backup and baseline requirements — blocking gate

No full, restorable production backup was created or verified during this audit. A schema-only SQL export is not a data backup and is not sufficient rollback protection.

1. In Supabase Dashboard, open **Database → Backups** and verify the latest successful backup and restore point. Automatic daily backups are plan-dependent; do not assume they exist. Projects on Free should make and retain their own export.
2. Create a separate off-project logical backup before DDL. Preserve schema, data and custom roles as appropriate. Supabase CLI examples are documented at [Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). Remember that the standard CLI dump excludes Supabase-managed `auth` and `storage` schemas; storage object files also need their own handling.
3. Export the live public schema for diff/review, e.g. `npx supabase db dump --linked --schema public -f supabase/production-baseline-20261030.sql`. This is schema-only and must not be described as a complete backup.
4. Run `supabase/audits/20261030_remote_migration_baseline_readonly.sql` and compare the output with the schema dump, functions, constraints, grants and RLS policies.
5. Run `npx supabase migration list --linked` and inventory every migration file, especially the Phase 52 and Phase 53 prerequisites. Reconcile historical versions one by one only after each migration's complete effects are verified.

**Do not proceed with production DDL until the backup and baseline have been confirmed.** The assistant's connected Supabase tools do not provide a downloadable full-project backup or a safe rollback snapshot. Do not use a development branch as a substitute: it does not carry production data.

## Controlled rollout order

After the backup, schema comparison and migration-history reconciliation are complete:

1. Phase 54 — `20261028030000_phase54_core_security_and_payment_code_range.sql`.
2. Phase 56 — `20261028040000_phase56_atomic_admin_package_save.sql`.
3. Phase 57A — `20261028050000_phase57_supplier_cost_rpc_security.sql`.
4. Deploy/verify the matching Author frontend. Confirm Author can read/write supplier cost and an ordinary Member is denied. A cost-only save must never modify `packages.price`.
5. Phase 57B — `20261028060000_phase57b_supplier_cost_table_lockdown.sql`, only after step 4 succeeds. It removes direct table access; the RPC path must already be live.
6. Phase 58 — `20261030010000_phase58_author_catalog_pricing.sql`. Automatic sale price is `round(supplier_cost * 1.07, 0)`; this is a 7% markup on cost, not a 7% gross margin. The audit column `margin_percent` should contain actual gross margin: `(sale_price - supplier_cost) / sale_price * 100` (0 when sale price is 0).
7. Phase 59 — `20261030020000_phase59_database_policy_index_hardening.sql`.
8. Phase 60 — `20261030030000_phase60_atomic_bulk_pricing.sql`.
9. Deploy/test the matching frontend with one product, then three products, then a CSV batch. Confirm all-or-nothing rollback on an invalid row.

## Business-rule invariants

- Blank supplier cost means “not configured”; it must not be inferred from the sale price or inserted as Rp0.
- Rp0 is a valid explicitly entered supplier cost.
- Cost-only save changes only supplier cost and audit metadata; it never changes sale price.
- Cost + sale price changes only after explicit Author confirmation.
- 7% is markup on modal: `sale_price = round(cost * 1.07)`.
- Phase 63 adds illustrative supplier-cost rows only with `supplier_cost_status = 'sample'`; they are never treated as real supplier quotes, never trigger sale-price recalculation, and never enter the verified-cost audit path.
- For the 120 packages with positive sale prices, the Phase 63 sample is an illustrative reverse estimate from the current 7% markup rule. For the 189 Rp0 packages, Rp0 is only a placeholder, not an asserted supplier price.
- Author-entered costs must be explicitly saved as `verified`; sale-price recalculation remains an explicit, separately confirmed action.
- Sample seeding must not change any of the 309 existing selling prices.
- Checkout must continue rejecting sale price `<= 0`, even though the database permits a zero price for draft/catalogue configuration.

## Related reconciliation and maintenance patches

- `PHASE64_PRODUCTION_MIGRATION_RECONCILIATION.md` records the read-only mapping of all 19 migrations that predate Phase 52.
- `supabase/audits/20261030_phase64_old_migration_reconciliation_readonly.sql` captures the live tables, policies, grants, functions, indexes, catalog and Storage state using SELECT statements only.
- Phase 62 adds separate global-closure and order-only maintenance modes. Phase 63 adds sample/verified supplier-cost statuses and status-aware Author pricing RPCs. Both migration files are pending; neither has been executed in production.
- Phase 63 provides the current status-aware replacements for package-save, supplier-cost+price, and batch-pricing RPCs. Do not apply the older Phase 56/58/60 function definitions after Phase 63, because they do not preserve the sample/verified status model.

## Prohibited production commands/actions

- Do not run `supabase db push` while migration history is empty or unreconciled.
- Do not run `supabase db reset --linked`; it is destructive to the linked remote project.
- Do not paste all migration files into one SQL batch.
- Do not mark all historical timestamps as applied. `migration repair --status applied` only changes history; it does not run the migration SQL.
- Do not revoke or disable the `ensure_rls` event trigger itself; only revoke inappropriate browser execution on its function.
