-- Phase 57B: remove direct browser access after the RPC-based frontend is deployed and verified.
-- Keep this separate from Phase 57A to avoid breaking the currently deployed frontend.
-- Selling prices and supplier-cost values are not modified by this migration.

BEGIN;

ALTER TABLE public.package_supplier_costs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.package_supplier_costs
  FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.package_supplier_costs TO service_role;

DROP POLICY IF EXISTS staff_manage_package_supplier_costs
  ON public.package_supplier_costs;

COMMIT;
