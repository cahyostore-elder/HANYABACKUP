-- FityoraStore Phase 2: read-only Supabase security inspection
-- All statements below are SELECT-only. Run in SQL Editor after choosing the correct project.
-- Do not paste service-role keys into source code or chat.

-- 1) RLS state for the relevant tables
SELECT n.nspname AS schema_name, c.relname AS table_name,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('profiles','orders','topup_categories','brands','packages',
                    'promo_banners','testimonials','faqs')
ORDER BY c.relname;

-- 2) Policies: inspect USING and WITH CHECK expressions
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles','orders','topup_categories','brands','packages',
                    'promo_banners','testimonials','faqs')
ORDER BY tablename, policyname;

-- 3) Table grants for browser roles
SELECT table_schema, table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon','authenticated','PUBLIC')
  AND table_name IN ('profiles','orders','topup_categories','brands','packages',
                     'promo_banners','testimonials','faqs')
ORDER BY table_name, grantee, privilege_type;

-- 4) Function identity, security mode, and search_path settings
SELECT n.nspname AS schema_name, p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_get_userbyid(p.proowner) AS owner,
       p.prosecdef AS security_definer,
       p.proconfig AS function_settings,
       p.proacl AS explicit_acl
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('is_admin','create_topup_order','admin_update_order_status')
ORDER BY p.proname;

-- 5) Effective EXECUTE grants on sensitive RPCs
SELECT routine_schema, routine_name, specific_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN ('is_admin','create_topup_order','admin_update_order_status')
ORDER BY routine_name, grantee;

-- 6) Order status distribution and duplicate totals among active orders
-- This reveals data to investigate; it does not prove a payment collision occurred.
SELECT status, count(*) AS order_count
FROM public.orders
GROUP BY status
ORDER BY status;

SELECT total_amount, count(*) AS active_orders,
       array_agg(code ORDER BY created_at DESC) AS order_codes
FROM public.orders
WHERE status IN ('pending','processing')
GROUP BY total_amount
HAVING count(*) > 1
ORDER BY active_orders DESC, total_amount;
