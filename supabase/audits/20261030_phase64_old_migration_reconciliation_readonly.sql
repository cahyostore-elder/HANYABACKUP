-- Phase 64: read-only reconciliation evidence for the 19 pre-Phase-52 migrations.
-- This file contains SELECT statements only. It does not alter schema, data, grants, policies,
-- migration history, or storage. Run only against the intended production project.

-- 1) Migration ledger and current top-level schema.
SELECT
  to_regnamespace('supabase_migrations') IS NOT NULL AS migration_schema_exists,
  to_regclass('supabase_migrations.schema_migrations') IS NOT NULL AS migration_history_table_exists,
  to_regclass('public.categories') IS NOT NULL AS legacy_categories_exists,
  to_regclass('public.products') IS NOT NULL AS legacy_products_exists,
  to_regclass('public.purchases') IS NOT NULL AS legacy_purchases_exists,
  to_regclass('public.reviews') IS NOT NULL AS legacy_reviews_exists,
  to_regclass('public.vip_memberships') IS NOT NULL AS legacy_vip_memberships_exists,
  to_regclass('public.vip_orders') IS NOT NULL AS legacy_vip_orders_exists;

-- 2) Public tables and RLS state.
SELECT
  t.table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS force_rls
FROM information_schema.tables AS t
JOIN pg_namespace AS n ON n.nspname = t.table_schema
JOIN pg_class AS c ON c.relnamespace = n.oid AND c.relname = t.table_name
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name;

-- 3) Core row counts and price readiness.
SELECT 'profiles' AS object_name, count(*) AS row_count FROM public.profiles
UNION ALL SELECT 'topup_categories', count(*) FROM public.topup_categories
UNION ALL SELECT 'brands', count(*) FROM public.brands
UNION ALL SELECT 'packages', count(*) FROM public.packages
UNION ALL SELECT 'orders', count(*) FROM public.orders
UNION ALL SELECT 'promo_banners', count(*) FROM public.promo_banners
UNION ALL SELECT 'testimonials', count(*) FROM public.testimonials
UNION ALL SELECT 'faqs', count(*) FROM public.faqs
UNION ALL SELECT 'site_settings', count(*) FROM public.site_settings
UNION ALL SELECT 'package_supplier_costs', count(*) FROM public.package_supplier_costs
UNION ALL SELECT 'package_pricing_audit', count(*) FROM public.package_pricing_audit
ORDER BY object_name;

SELECT
  count(*) AS package_count,
  count(*) FILTER (WHERE price = 0) AS zero_sale_price_count,
  count(*) FILTER (WHERE price > 0) AS positive_sale_price_count,
  count(*) FILTER (WHERE provider_code <> '') AS nonempty_provider_code_count
FROM public.packages;

SELECT
  b.slug AS brand_slug,
  count(p.id) AS package_count,
  count(p.id) FILTER (WHERE p.price = 0) AS zero_sale_price_count,
  count(p.id) FILTER (WHERE p.price > 0) AS positive_sale_price_count
FROM public.brands AS b
LEFT JOIN public.packages AS p ON p.brand_id = b.id
GROUP BY b.slug
ORDER BY b.slug;

-- 4) Check exact package names from legacy catalog seeds against the live catalog separately.
-- This summary deliberately does not insert missing rows or normalize package names.
SELECT
  b.slug AS brand_slug,
  p.name AS package_name,
  p.provider_code,
  p.price
FROM public.packages AS p
JOIN public.brands AS b ON b.id = p.brand_id
WHERE b.slug IN (
  'mobile-legends', 'free-fire', 'genshin-impact', 'telkomsel',
  'roblox', 'magic-chess-go-go', 'pubg-mobile', 'super-sus', 'valorant'
)
ORDER BY b.slug, p.sort_order, p.name;

-- 5) Roblox prices that Phase 40 must not overwrite on replay.
SELECT p.name, p.price, p.sort_order, p.description
FROM public.packages AS p
JOIN public.brands AS b ON b.id = p.brand_id
WHERE b.slug = 'roblox'
ORDER BY p.sort_order, p.name;

-- 6) Current function signatures, security mode and search_path.
SELECT
  n.nspname AS function_schema,
  p.oid::regprocedure::text AS signature,
  pg_get_function_result(p.oid) AS return_type,
  p.prosecdef AS security_definer,
  p.proconfig AS function_config,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
  has_function_privilege('public', p.oid, 'EXECUTE') AS public_can_execute
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE (n.nspname = 'public' AND p.proname IN (
  'increment_sales', 'generate_order_code', 'is_admin', 'lookup_order',
  'create_topup_order', 'admin_update_order_status', 'admin_set_site_maintenance',
  'admin_delete_order', 'submit_payment_proof', 'create_vip_order',
  'admin_update_vip_order', 'admin_list_package_supplier_costs',
  'admin_upsert_package_supplier_cost', 'admin_save_package',
  'admin_update_supplier_cost_and_price', 'admin_apply_package_pricing_batch'
))
OR (n.nspname = 'private' AND p.proname = 'is_admin')
OR (n.nspname = 'public' AND p.proname = 'rls_auto_enable')
ORDER BY n.nspname, p.proname, p.oid::regprocedure::text;

-- 7) Current policy inventory. Duplicate permissive policies are intentionally visible here.
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, policyname;

-- 8) Index definitions relevant to duplicate-index checks.
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    indexname IN (
      'idx_brands_category', 'brands_category_idx',
      'idx_packages_brand', 'packages_brand_idx',
      'idx_orders_pending_amount', 'orders_pending_amount_idx',
      'idx_orders_user_client_request_id'
    )
    OR tablename IN ('orders', 'brands', 'packages')
  )
ORDER BY tablename, indexname;

-- 9) Order constraints and current settings.
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.orders'::regclass
ORDER BY conname;

SELECT
  id,
  maintenance_enabled,
  maintenance_message,
  updated_at,
  updated_by
FROM public.site_settings
WHERE id = true;

-- 10) Storage inventory and existing payment-proof object count.
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE name = 'payment-proofs';

SELECT count(*) AS payment_proof_object_count
FROM storage.objects
WHERE bucket_id = 'payment-proofs';

-- 11) Profile roles and legacy VIP columns; does not display email or personal fields.
SELECT role, count(*) AS profile_count
FROM public.profiles
GROUP BY role
ORDER BY role;

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('is_vip', 'vip_expires_at')
ORDER BY column_name;
