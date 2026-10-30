# Phase 64 — Reconciliation of the 19 legacy production migrations

Snapshot: 2026-10-30 (Asia/Jakarta)  
Target: Supabase project `xgmbwvwiryimwenhwhbu`  
Repository: `cahyostore-elder/FITYORATOPUP`

## Executive result

The Supabase project is healthy, but its migration ledger is not initialized:

- The `supabase_migrations` schema and `supabase_migrations.schema_migrations` relation are absent.
- Supabase `list_migrations` returns an empty array.
- This does **not** mean the SQL in the repository has never been applied. The live catalog and function definitions show that substantial portions of the historical migrations already took effect, while other parts have been replaced, manually changed, or are missing.

The migration directory currently contains 28 files. Files 1–19 below predate Phase 52 and must not be run as one batch or marked as applied merely because their main tables exist.

## Read-only production snapshot

| Object / data | Observed production state |
|---|---:|
| Public tables | 11; RLS enabled on all 11 |
| Profiles | 1 (role `admin`) |
| Top-up categories | 3 |
| Brands | 18 |
| Packages | 309 |
| Packages with sale price Rp0 | 189 |
| Packages with sale price above Rp0 | 120 |
| Orders | 0 |
| Promo banners / testimonials / FAQs | 2 / 6 / 11 |
| Site settings | 1 row; global `maintenance_enabled = true` |
| Supplier-cost rows / pricing-audit rows | 0 / 0 |
| Payment-proof bucket | Private, 5 MiB limit, 0 objects |

Legacy tables `categories`, `products`, `purchases`, `reviews`, `vip_memberships`, and `vip_orders` are absent. The current catalog is held by `topup_categories`, `brands`, and `packages`.

The profile ID hard-coded by the legacy Author migration does not match the current profile. The only current profile has role `admin`; do not replay the old role update.

## Legacy migration-by-migration comparison

The status below classifies the **observed effects**, not a claim that a particular timestamp was historically recorded as applied.

| # | Migration | Live evidence | Reconciliation / replay decision |
|---:|---|---|---|
| 1 | `20261025093451_fityorastore_schema.sql` | Legacy product-marketplace tables are absent. The current public schema is the top-up schema, not the old `categories/products/purchases/reviews/vip_memberships` design. | Historical predecessor only. It was superseded by #3's explicit legacy-table drops. Do not replay. |
| 2 | `20261025093753_add_increment_sales_rpc.sql` | `increment_sales(uuid)` is absent. #3 explicitly revokes and drops it. | Superseded by #3. Do not replay. |
| 3 | `20261025215051_fityora_topup_schema.sql` | Current top-up tables, 3 categories, 18 brands, and 309 packages exist. This file drops five legacy tables with CASCADE and inserts starter catalog/content rows. | Core schema effects exist, but its catalog INSERT statements are not safe to repeat; package names are not unique at the database level. Do not replay. |
| 4 | `20261025215743_orders_payment_columns.sql` | `payment_method`, `total_amount`, and `unique_code` exist. Direct order writes are now revoked from browser roles; only SELECT is granted to authenticated. | Columns survived; the old owner UPDATE policy/grant was superseded by later order hardening. Partial/superseded. |
| 5 | `20261025220738_fityora_content_and_lookup.sql.sql` | `promo_banners`, `testimonials`, `faqs`, and `lookup_order(text)` exist; current counts are 2, 6, and 11. | Objects exist but content counts and function definition differ from the seed migration. Replaying would append duplicate content or overwrite the lookup routine. Do not replay. |
| 6 | `20261025221558_fityora_add_roblox_mcgg_logos.sql.sql` | Roblox and Magic Chess Go Go brands/packages exist. The package table has no unique constraint on `(brand_id,name)`; this migration's package INSERTs use `ON CONFLICT DO NOTHING`, which does not prevent duplicates without a matching unique constraint. | Historical catalog/icon effects are present in the live catalog. Replaying may duplicate packages and overwrite brand icons. Do not replay. |
| 7 | `20261025222830_fityora_author_role.sql.sql` | The migration's hard-coded profile ID matches 0 current rows. Current `public.is_admin()` is SECURITY DEFINER, not the SECURITY INVOKER definition in the file. | The live role is already `admin`; the old role update is not applicable. Do not replay. |
| 8 | `20261026000000_fityorastore_hardening.sql` | Direct INSERT/UPDATE/DELETE on orders is revoked; a guarded create-order RPC and order-status RPC exist. However, `vip_orders`, `profiles.is_vip`, and `profiles.vip_expires_at` are absent; the current order RPC and status RPC signatures/returns differ. | Some hardening effects exist, but the migration's VIP/table/function state is not present as authored. Divergent; do not replay. |
| 9 | `20261026010000_remote_brand_icons.sql` | Brand image fields and brands exist. The migration is data-only and overwrites curated image URLs with fixed URLs. | Not safe to replay over possible Author edits. Verify any icon changes separately; do not replay. |
| 10 | `20261026020000_disable_vip_membership.sql` | Current order creation ignores VIP pricing and uses the seven-argument idempotent RPC. VIP table/columns and VIP RPCs are absent. Content and order RPCs have subsequently diverged from this file. | VIP appears disabled in the current live schema, but the exact migration chain is not proven. Do not replay. |
| 11 | `20261026030000_manual_order_workflow_hardening.sql` | Payment verification/fulfillment columns and `idx_orders_pending_amount` exist. The current order RPC is seven-argument; the current status RPC returns JSONB and enforces stricter transitions than this file. A second pending-amount index also exists. | Structural effects are present, functions have since changed, and indexes are duplicated. Partial/superseded. |
| 12 | `20261026040000_lookup_order_search_path_hardening.sql` | `lookup_order(text)` exists and is callable by anon for guest tracking. Current search path is `pg_catalog, public`, and the SECURITY DEFINER function exposes limited order details. | Function exists but is not exactly the hardened definition; keep guest lookup intentional and review rate limiting. Do not overwrite blindly. |
| 13 | `20261027000000_order_creation_idempotency.sql` | `orders.client_request_id`, unique partial index `idx_orders_user_client_request_id`, and seven-argument `create_topup_order` exist. | Idempotency effects are present. The allocator remains Rp200–Rp400, not the target Rp200–Rp999. Partial. |
| 14 | `20261027010000_manual_payment_proofs.sql` | Payment-proof columns, private `payment-proofs` bucket, and `submit_payment_proof(uuid,text)` exist; the bucket currently has 0 objects. | Main objects are present. Verify Storage policies/ACLs and backup the bucket configuration before deciding history status. Do not blindly recreate policies. |
| 15 | `20261027020000_phase39_catalog_import.sql` | `packages.provider_code` exists; 85 packages have a non-empty provider code. Of 258 package rows parsed from the migration, 253 match current rows by brand slug and case-insensitive package name; all 253 matching provider codes match. Five exact package names differ/are absent. | Catalog import is substantially reflected but not byte-for-byte identical. Do not replay any catalog seed; preserve five name differences and current manual edits for Author review. |
| 16 | `20261027030000_phase40_roblox_user_pricing.sql` | All 11 Roblox package names and selling prices in the migration match the current live values. The live Roblox catalog also contains additional packages beyond those 11. | The update effect is present. Replaying would reset those 11 sale prices, descriptions, and sort order to the migration values. Do not replay. |
| 17 | `20261027040000_phase41_admin_order_delete_site_maintenance.sql` | `site_settings`, `admin_delete_order(uuid)`, and `admin_set_site_maintenance(boolean,text)` exist. The live delete function returns JSONB and only permits pending/failed orders; the maintenance function returns JSONB and is SECURITY INVOKER, unlike the migration's declared return types/security. | Objects exist but definitions were customized. Preserve the live versions; do not replay. |
| 18 | `20261027050000_phase44_site_settings_maintenance_only.sql` | `site_settings` has one row and RLS. The global maintenance flag is currently true. The live maintenance RPC differs from the file's composite-return SECURITY DEFINER implementation. | The settings object exists; the routine has drifted. Do not replay. |
| 19 | `20261027060000_phase45_repair_package_price_edit.sql` | `packages` has RLS, anon SELECT, authenticated write grants, and a staff-manage policy. Duplicate public-read policies remain. | Package editing access exists but is not fully normalized. Partial; Phase 59-style policy reconciliation remains pending. |

### Phase 39 / Phase 40 catalog detail

The Phase 39 migration contains 258 package seed statements. A read-only join against the current catalog found 253 exact brand/name matches and zero provider-code mismatches among those matches. The five names not found exactly include:
- Mobile Legends: migration names `5 Diamond` and `12 Diamond`; live names are `5 Diamonds` and `12 Diamonds`.
- Free Fire: migration name `5 Diamond`; live name is `5 Diamonds`.
- Genshin Impact: migration name `60 Genesis Crystals` was not found by exact name.
- Telkomsel: migration name `Telkomsel 2.000` was not found by exact name.

These are differences to review, not instructions to insert replacement rows.

Phase 40's 11 Roblox sale prices currently match exactly: 50/100/200/300/400/500/1000/1500/2000/2500/5000 Robux. Additional Roblox packages (80/800/1700/4500/10000 Robux) also exist in production. Do not replay Phase 40 because it updates live sale prices and descriptions.

## Current security / index drift that blocks a clean baseline

Observed in production:

- All 11 public tables have RLS enabled.
- Duplicate pending-order indexes: `idx_orders_pending_amount` and `orders_pending_amount_idx`.
- Duplicate brand-category indexes: `idx_brands_category` and `brands_category_idx`.
- Duplicate package-brand indexes: `idx_packages_brand` and `packages_brand_idx`.
- Catalog/content tables have overlapping public-read and `staff_manage_*` policies. The orders table has duplicate owner SELECT policies. Profiles still has a broad `read_public_profile` SELECT policy and duplicate own-profile policies.
- `public.is_admin()` remains SECURITY DEFINER; `private.is_admin()` is absent.
- `rls_auto_enable()` is SECURITY DEFINER and remains executable by PUBLIC/anon/authenticated; its `ensure_rls` event trigger is active. Do not disable/drop the event trigger. Revoke browser EXECUTE only after a verified patch.
- `lookup_order(text)` is SECURITY DEFINER and intentionally anon-callable for guest status lookup; keep its limited return shape and rate-limit review.
- `generate_order_code()` has no pinned search_path.
- The order unique-code constraint allows 100–999, while the current RPC allocator generates Rp200–Rp400. Target Phase 54 range Rp200–Rp999 is not installed.
- Phase 56 `admin_save_package`, Phase 57 private helper, Phase 58 automatic pricing RPC, and Phase 60 batch pricing RPC are absent. The supplier-cost list/upsert RPCs are older versions.

## Safe baseline strategy — not yet executed

The current active migration folder contains historical timestamps that predate the production schema's actual current state. A new baseline must not be added *after* those files while they remain in the active folder, or they would still be pending to the CLI.

1. Obtain and verify a restorable backup of database roles/schema/data, Auth users/settings, Storage bucket configuration/policies, and Storage object files. The three SQL files `roles.sql`, `schema.sql`, and `data.sql` are useful logical exports but are not, by themselves, a full project restore point. Supabase's backup guide separates role, schema, and data dumps and calls out Auth/Storage customizations for separate handling.
2. Keep an immutable Git tag/branch or archive copy of **all 28 current migration files**, including Phase 52–63. After the backup is confirmed, move the archived copies outside the active `supabase/migrations/` directory (for example `supabase/archive/migrations-pre-baseline-20261030/`). Do not discard or rewrite the originals.
3. Run the companion read-only audit: `supabase/audits/20261030_phase64_old_migration_reconciliation_readonly.sql`, and export the actual live schema and grants for review.
4. With the active migration directory containing no old pending timestamps, use the Supabase existing-project workflow: `supabase db pull --linked`. This creates a baseline migration from the live schema and records that baseline as applied in the remote migration history; it is a migration-history adoption step, not a request to replay the old catalog/data migrations. Review the generated SQL carefully before committing it. Supabase warns the generated diff can contain unexpected statements (for example extension drops) that must be removed or explained.
5. If the project has custom Auth or Storage schema changes, pull/review those schemas separately with `supabase db pull --linked --schema auth` and `supabase db pull --linked --schema storage`. Storage object files and Auth users/settings still require their own backup/restore handling; a schema pull is not a data backup.
6. Verify that the baseline can recreate the intended schema in a **local** development database using `supabase db reset` only against the local stack. Compare tables, functions, grants, RLS, policies, indexes, triggers, extensions, and Storage policies against the retained production snapshot.
7. After the baseline is committed and its remote history entry is verified, recreate only the required forward patches with `supabase migration new <descriptive_name>` so their timestamps are newer than the baseline. Reintroduce the reviewed Phase 62/63 SQL content into those new forward migrations; do not reuse their pre-baseline timestamps.
8. Apply small forward patches only after reviewing the exact diff and confirming the backup. Verify each function, policy, grant, constraint and UI integration before moving to the next patch.

The Supabase CLI docs describe `db pull` as the existing-project path for creating a remote-schema baseline and recording it as applied. The old 19 migration timestamps should therefore be preserved as an archive, not blindly repaired as applied.

## Prohibited until baseline is reconciled

- Do not run `supabase db push` against this empty remote ledger.
- Do not run `supabase db reset --linked`.
- Do not paste all 28 migrations into one SQL Editor execution.
- Do not use `migration repair --status applied` as a substitute for verifying effects; it changes only the migration ledger.
- Do not replay Phase 39/40 catalog SQL or the old marketing/brand-icon seed migrations.
- Do not remove the `ensure_rls` event trigger.
- Do not seed any sample supplier cost as verified or use a sample value to recalculate sale prices.
