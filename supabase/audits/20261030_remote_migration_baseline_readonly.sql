-- Phase 61 remote migration baseline audit.
-- READ ONLY: run this in Supabase SQL Editor before repairing migration history or applying pending DDL.
WITH checks AS (
  SELECT
    'remote migration history' AS check_name,
    to_regclass('supabase_migrations.schema_migrations') IS NOT NULL AS passed,
    COALESCE(to_regclass('supabase_migrations.schema_migrations')::text, 'missing') AS observed,
    'Supabase migration history table exists' AS expected
  UNION ALL
  SELECT 'supplier cost table RLS',
    COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.package_supplier_costs')), false),
    COALESCE((SELECT relrowsecurity::text FROM pg_class WHERE oid = to_regclass('public.package_supplier_costs')), 'missing'),
    'RLS enabled'
  UNION ALL
  SELECT 'supplier cost accepts Rp0',
    EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.package_supplier_costs') AND pg_get_constraintdef(oid) = 'CHECK (supplier_cost >= 0)'),
    COALESCE((SELECT string_agg(pg_get_constraintdef(oid), '; ') FROM pg_constraint WHERE conrelid = to_regclass('public.package_supplier_costs') AND contype = 'c'), 'no check constraint'),
    'CHECK (supplier_cost >= 0)'
  UNION ALL
  SELECT 'browser cannot access supplier cost table directly',
    NOT EXISTS (SELECT 1 FROM information_schema.table_privileges WHERE table_schema = 'public' AND table_name = 'package_supplier_costs' AND grantee IN ('anon','authenticated')),
    COALESCE((SELECT string_agg(grantee || ':' || privilege_type, ', ' ORDER BY grantee, privilege_type) FROM information_schema.table_privileges WHERE table_schema = 'public' AND table_name = 'package_supplier_costs' AND grantee IN ('anon','authenticated')), 'no anon/authenticated grants'),
    'No anon/authenticated table grants'
  UNION ALL
  SELECT 'private admin helper',
    to_regprocedure('private.is_admin()') IS NOT NULL,
    COALESCE(to_regprocedure('private.is_admin()')::text, 'missing'),
    'private.is_admin() exists'
  UNION ALL
  SELECT 'atomic package save RPC',
    to_regprocedure('public.admin_save_package(uuid,uuid,text,text,numeric,integer,boolean,numeric)') IS NOT NULL,
    COALESCE(to_regprocedure('public.admin_save_package(uuid,uuid,text,text,numeric,integer,boolean,numeric)')::text, 'missing'),
    'admin_save_package(...) exists'
  UNION ALL
  SELECT 'Phase 58 supplier-to-sale RPC',
    to_regprocedure('public.admin_update_supplier_cost_and_price(uuid,numeric)') IS NOT NULL,
    COALESCE(to_regprocedure('public.admin_update_supplier_cost_and_price(uuid,numeric)')::text, 'missing'),
    'admin_update_supplier_cost_and_price(...) exists'
  UNION ALL
  SELECT 'Phase 60 atomic batch RPC',
    to_regprocedure('public.admin_apply_package_pricing_batch(jsonb)') IS NOT NULL,
    COALESCE(to_regprocedure('public.admin_apply_package_pricing_batch(jsonb)')::text, 'missing'),
    'admin_apply_package_pricing_batch(jsonb) exists'
  UNION ALL
  SELECT 'order RPC blocks zero sale price',
    CASE WHEN to_regprocedure('public.create_topup_order(uuid,uuid,uuid,text,text,text,uuid)') IS NULL THEN false
      ELSE position('v_price <= 0' IN pg_get_functiondef(to_regprocedure('public.create_topup_order(uuid,uuid,uuid,text,text,text,uuid)'))) > 0 END,
    CASE WHEN to_regprocedure('public.create_topup_order(uuid,uuid,uuid,text,text,text,uuid)') IS NULL THEN 'missing'
      ELSE CASE WHEN position('v_price <= 0' IN pg_get_functiondef(to_regprocedure('public.create_topup_order(uuid,uuid,uuid,text,text,text,uuid)'))) > 0 THEN 'guard found' ELSE 'guard not found' END END,
    'Zero-price packages cannot be ordered'
  UNION ALL
  SELECT 'order unique-code range',
    CASE WHEN to_regprocedure('public.create_topup_order(uuid,uuid,uuid,text,text,text,uuid)') IS NULL THEN false
      ELSE position('v_start_offset' IN pg_get_functiondef(to_regprocedure('public.create_topup_order(uuid,uuid,uuid,text,text,text,uuid)'))) > 0 END,
    CASE WHEN to_regprocedure('public.create_topup_order(uuid,uuid,uuid,text,text,text,uuid)') IS NULL THEN 'missing'
      ELSE CASE WHEN position('v_start_offset' IN pg_get_functiondef(to_regprocedure('public.create_topup_order(uuid,uuid,uuid,text,text,text,uuid)'))) > 0 THEN '200–999 allocator present' ELSE 'legacy allocator' END END,
    'Rp200–Rp999 allocator'
  UNION ALL
  SELECT 'lookup order RPC',
    to_regprocedure('public.lookup_order(text)') IS NOT NULL,
    COALESCE(to_regprocedure('public.lookup_order(text)')::text, 'missing'),
    'Guest order lookup function exists'
  UNION ALL
  SELECT 'supplier cost count',
    true,
    (SELECT count(*)::text FROM public.package_supplier_costs),
    'Read-only row count; no catalogue values inserted by migrations'
)
SELECT check_name, CASE WHEN passed THEN 'PASS' ELSE 'REVIEW / PENDING' END AS status, observed, expected
FROM checks
ORDER BY CASE WHEN passed THEN 1 ELSE 0 END, check_name;
