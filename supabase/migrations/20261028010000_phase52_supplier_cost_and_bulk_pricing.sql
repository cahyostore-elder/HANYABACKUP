-- Phase 52: Keep supplier cost private while adding safe bulk price management.
-- Existing selling prices are preserved. Safe to re-run.
BEGIN;

CREATE TABLE IF NOT EXISTS public.package_supplier_costs (
  package_id uuid PRIMARY KEY REFERENCES public.packages(id) ON DELETE CASCADE,
  supplier_cost numeric(10,2) NOT NULL DEFAULT 0 CHECK (supplier_cost >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.package_supplier_costs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.package_supplier_costs FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.package_supplier_costs TO authenticated;
DROP POLICY IF EXISTS staff_manage_package_supplier_costs ON public.package_supplier_costs;
CREATE POLICY staff_manage_package_supplier_costs
  ON public.package_supplier_costs
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.admin_update_package_pricing(
  p_package_id uuid,
  p_price numeric,
  p_supplier_cost numeric DEFAULT NULL
)
RETURNS TABLE(package_id uuid, price numeric, supplier_cost numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_cost numeric(10,2);
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Hanya admin/staf toko yang dapat mengubah harga.';
  END IF;
  IF p_price IS NULL OR p_price < 0 OR p_price > 99999999.99 OR p_price <> trunc(p_price) THEN
    RAISE EXCEPTION 'Harga jual harus antara Rp0 dan Rp99.999.999,99.';
  END IF;
  IF p_supplier_cost IS NOT NULL AND (p_supplier_cost < 0 OR p_supplier_cost > 99999999.99 OR p_supplier_cost <> trunc(p_supplier_cost)) THEN
    RAISE EXCEPTION 'Harga modal supplier tidak valid.';
  END IF;

  UPDATE public.packages AS p
    SET price = p_price
    WHERE p.id = p_package_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produk tidak ditemukan.';
  END IF;

  IF p_supplier_cost IS NOT NULL THEN
    INSERT INTO public.package_supplier_costs AS existing (package_id, supplier_cost, updated_at)
    VALUES (p_package_id, p_supplier_cost, now())
    ON CONFLICT (package_id) DO UPDATE
      SET supplier_cost = EXCLUDED.supplier_cost, updated_at = now();
  END IF;

  SELECT c.supplier_cost INTO v_cost
  FROM public.package_supplier_costs AS c
  WHERE c.package_id = p_package_id;
  RETURN QUERY SELECT p_package_id, p_price, COALESCE(v_cost, 0::numeric);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_package_pricing(uuid, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_package_pricing(uuid, numeric, numeric) TO authenticated;

COMMIT;
