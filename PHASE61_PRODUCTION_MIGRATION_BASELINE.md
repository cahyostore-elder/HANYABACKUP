# Phase 61 — Production Migration Baseline and Rollout

## Current known facts
- The remote database currently has no `supabase_migrations.schema_migrations` table, so its migration history is not authoritative.
- Live database schema is mixed: supplier-cost list/upsert RPCs and supplier-cost table lockdown are already present, but `private.is_admin()` and `admin_save_package(...)` were absent during the latest inspection.
- The live `package_supplier_costs` constraint still rejects supplier cost `0`; the Phase 57A migration repairs this to `CHECK (supplier_cost >= 0)`.
- The live order RPC currently blocks zero sale-price packages but its payment unique-code allocator is still an older 200–400 implementation; Phase 54 source expands it to Rp200–Rp999. The Phase 54 file has been corrected to retain the zero-price guard.
- The Phase 58/60 functions are new and must be applied only after their prerequisite migrations.

## Before applying anything
1. Confirm the linked Supabase project is `xgmbwvwiryimwenhwhbu` (`https://xgmbwvwiryimwenhwhbu.supabase.co`).
2. Take a fresh Supabase backup or export through the project's backup tooling.
3. From the repository root, run `npx supabase link --project-ref xgmbwvwiryimwenhwhbu`.
4. Export a schema-only copy for review: `npx supabase db dump --linked --schema public -f supabase/production-baseline-20261030.sql`. This is a read-only dump; do not include production data.
5. Run `npx supabase migration list --linked` and inspect the full file list in `supabase/migrations/`.
6. Run `supabase/audits/20261030_remote_migration_baseline_readonly.sql` in Supabase SQL Editor. Compare its output with the schema dump and the function/policy definitions before changing migration history.

## Repairing migration history
- The CLI's `migration repair --status applied` only inserts a history record; it does not execute migration SQL. Use it only for a timestamp whose schema effects are already verified on the live database.
- Do not mark every historical file as applied automatically. The live database is mixed and at least Phase 54 is only partially represented.
- Mark confirmed legacy migrations as applied one timestamp at a time after verifying them against the schema dump and read-only audit.
- Keep Phase 54, Phase 56, Phase 57A, Phase 57B, Phase 58, Phase 59 and Phase 60 pending until their SQL has been applied and verified, unless a specific migration is proven already applied in full.
- After the history is reconciled, use `npx supabase migration list --linked` again. The local/remote list must show only the intended next migration as pending.

## Apply order once the baseline is reconciled
1. `20261028030000_phase54_core_security_and_payment_code_range.sql` — server-side code range Rp200–Rp999; keeps zero-sale-price checkout blocked.
2. `20261028040000_phase56_atomic_admin_package_save.sql` — prerequisite atomic package save RPC.
3. `20261028050000_phase57_supplier_cost_rpc_security.sql` — private role helper, supplier cost Rp0 support, RPCs.
4. Deploy frontend using RPC supplier-cost reads/writes and verify Author succeeds while a Member is denied.
5. `20261028060000_phase57b_supplier_cost_table_lockdown.sql` — only after step 4 is confirmed.
6. `20261030010000_phase58_author_catalog_pricing.sql` — single product supplier-to-sale update and price audit.
7. `20261030020000_phase59_database_policy_index_hardening.sql` — policy/index cleanup and old RPC revocation.
8. `20261030030000_phase60_atomic_bulk_pricing.sql` — single-call atomic CSV/bulk save.
9. Deploy the matching frontend and run small controlled tests (one item, then three items) before importing the full catalogue.

## Explicitly prohibited on production
- Do not run `supabase db push` while the history is empty or before reconciling the exact pending versions.
- Do not run `supabase db reset --linked`; this drops and rebuilds the linked remote schema and is destructive.
- Do not run all SQL files in one pasted batch.
- Do not insert supplier costs or alter existing selling prices as part of migration. Prices stay under Author control.

## Manual Supabase Auth setting
Enable leaked-password protection in Supabase Auth settings; the advisor finding is a dashboard-level Auth configuration, not a schema migration.

References: Supabase CLI documentation for [db dump](https://supabase.com/docs/reference/cli/global-flags), [migration repair](https://supabase.com/docs/reference/cli/global-flags), and [local workflow](https://supabase.com/docs/guides/local-development/cli-workflows).