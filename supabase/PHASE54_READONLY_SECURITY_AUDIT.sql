-- Phase 54 read-only security audit. Run in Supabase SQL Editor after migration.
-- This file does not change data or schema.

-- 1) RLS status for public tables.
SELECT n.nspname AS schema_name, c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
ORDER BY c.relname;

-- 2) Policies currently defined in public schema.
SELECT schemaname, tablename, policyname, permissive, roles,
       cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3) SECURITY DEFINER functions and their configured search_path.
SELECT n.nspname AS schema_name, p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer,
       p.proconfig AS function_settings,
       pg_get_userbyid(p.proowner) AS owner
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef
ORDER BY p.proname;

-- 4) Execute grants for the order-creation RPC.
SELECT routine_schema, routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public' AND routine_name = 'create_topup_order'
ORDER BY grantee, privilege_type;

-- 5) Order amount and code sanity check; review results, do not auto-correct historical orders.
SELECT id, code, status, price, total_amount, unique_code, payment_method, created_at
FROM public.orders
WHERE price IS NULL OR total_amount IS NULL OR price < 0 OR total_amount < price
   OR unique_code < 0
ORDER BY created_at DESC
LIMIT 200;
