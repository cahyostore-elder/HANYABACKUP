-- FityoraStore Phase 21: harden the public order-status lookup RPC.
-- Keeps the current order-status experience and response fields unchanged.
-- Apply through the normal Supabase migration process after reviewing/backing up.

CREATE OR REPLACE FUNCTION public.lookup_order(code text)
RETURNS TABLE (
  o_code text,
  o_status text,
  o_total_amount numeric,
  o_payment_method text,
  o_brand_name text,
  o_package_name text,
  o_target text,
  o_created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.code,
    o.status,
    o.total_amount,
    o.payment_method,
    b.name,
    p.name,
    o.target,
    o.created_at
  FROM public.orders AS o
  LEFT JOIN public.brands AS b ON b.id = o.brand_id
  LEFT JOIN public.packages AS p ON p.id = o.package_id
  WHERE o.code = lookup_order.code
  LIMIT 1;
END;
$$;

-- Order-status lookup remains available to signed-out customers who possess
-- the high-entropy order code; all table references above are schema-qualified.
REVOKE ALL ON FUNCTION public.lookup_order(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lookup_order(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
