-- FITYORA TOPUP Phase 36: read-only diagnostics for Supabase SQL Editor.
-- Run AFTER the Phase 33 migration has been reviewed/applied to a TEST project.
-- These statements inspect schema/function permissions only; they do not mutate data.

-- 1) Confirm the idempotency column exists and is nullable for historical orders.
SELECT table_schema, table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'orders'
  AND column_name IN ('user_id', 'total_amount', 'client_request_id')
ORDER BY column_name;

-- 2) Confirm the unique partial index exists and is valid.
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'orders'
  AND indexname = 'idx_orders_user_client_request_id';

-- 3) Confirm the deployed function signature and security settings.
SELECT n.nspname AS schema_name,
       p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS identity_arguments,
       p.prosecdef AS security_definer,
       p.proconfig AS function_settings
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'create_topup_order';

-- 4) Confirm role execute privileges. Expected: authenticated=true; anon=false.
SELECT CASE WHEN to_regprocedure('public.create_topup_order(uuid,uuid,uuid,text,text,text,uuid)') IS NULL
              THEN false
              ELSE has_function_privilege('authenticated', to_regprocedure('public.create_topup_order(uuid,uuid,uuid,text,text,text,uuid)'), 'EXECUTE')
         END AS authenticated_can_execute,
       CASE WHEN to_regprocedure('public.create_topup_order(uuid,uuid,uuid,text,text,text,uuid)') IS NULL
              THEN false
              ELSE has_function_privilege('anon', to_regprocedure('public.create_topup_order(uuid,uuid,uuid,text,text,text,uuid)'), 'EXECUTE')
         END AS anon_can_execute;

-- Expected result summary:
-- - orders.client_request_id is nullable (old rows are preserved).
-- - idx_orders_user_client_request_id exists and is unique with a non-null predicate.
-- - Exactly one intended 7-argument create_topup_order function is active.
-- - authenticated_can_execute = true; anon_can_execute = false.
-- Stop and investigate if the actual results differ. Do not run a production checkout
-- until the function signature, grants, and frontend version are aligned.
