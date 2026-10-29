-- Phase 56: Make package metadata, selling price and supplier cost an atomic save.
-- Safe to re-run. Does not change existing packages or prices until an admin saves one.
-- Apply this migration in Supabase SQL Editor before deploying the Phase 56 frontend.

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_save_package(
  p_package_id uuid,
  p_brand_id uuid,
  p_name text,
  p_description text,
  p_price numeric,
  p_sort_order integer,
  p_featured boolean,
  p_supplier_cost numeric
)
RETURNS TABLE (
  saved_package_id uuid,
  saved_price numeric,
  saved_supplier_cost numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_package_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Hanya admin/author yang dapat menyimpan paket.';
  END IF;

  IF p_brand_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.brands AS b WHERE b.id = p_brand_id
  ) THEN
    RAISE EXCEPTION 'Brand/operator tidak ditemukan.';
  END IF;

  IF p_name IS NULL OR length(btrim(p_name)) = 0 OR length(btrim(p_name)) > 160 THEN
    RAISE EXCEPTION 'Nama paket wajib diisi dan maksimal 160 karakter.';
  END IF;

  IF p_price IS NULL OR p_price < 0 OR p_price > 99999999 OR p_price <> trunc(p_price) THEN
    RAISE EXCEPTION 'Harga jual harus berupa angka bulat Rp0–Rp99.999.999.';
  END IF;

  IF p_supplier_cost IS NULL OR p_supplier_cost < 0 OR p_supplier_cost > 99999999 OR p_supplier_cost <> trunc(p_supplier_cost) THEN
    RAISE EXCEPTION 'Harga modal supplier harus berupa angka bulat Rp0–Rp99.999.999.';
  END IF;

  IF p_sort_order IS NULL OR p_sort_order < 0 THEN
    RAISE EXCEPTION 'Urutan paket tidak valid.';
  END IF;

  IF p_package_id IS NULL THEN
    INSERT INTO public.packages (
      brand_id, name, description, price, sort_order, featured
    ) VALUES (
      p_brand_id, btrim(p_name), COALESCE(btrim(p_description), ''),
      p_price, p_sort_order, COALESCE(p_featured, false)
    )
    RETURNING id INTO v_package_id;
  ELSE
    UPDATE public.packages AS p
    SET brand_id = p_brand_id,
        name = btrim(p_name),
        description = COALESCE(btrim(p_description), ''),
        price = p_price,
        sort_order = p_sort_order,
        featured = COALESCE(p_featured, false)
    WHERE p.id = p_package_id
    RETURNING p.id INTO v_package_id;

    IF v_package_id IS NULL THEN
      RAISE EXCEPTION 'Paket tidak ditemukan. Muat ulang katalog lalu coba lagi.';
    END IF;
  END IF;

  INSERT INTO public.package_supplier_costs AS existing (
    package_id, supplier_cost, updated_at
  ) VALUES (
    v_package_id, p_supplier_cost, now()
  )
  ON CONFLICT (package_id) DO UPDATE
    SET supplier_cost = EXCLUDED.supplier_cost,
        updated_at = now();

  RETURN QUERY
  SELECT v_package_id, p_price, p_supplier_cost;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_save_package(uuid, uuid, text, text, numeric, integer, boolean, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_package(uuid, uuid, text, text, numeric, integer, boolean, numeric) TO authenticated;

-- Ensure PostgREST discovers the newly-created RPC promptly.
NOTIFY pgrst, 'reload schema';

COMMIT;

-- Read-only verification after applying the migration:
SELECT routine_name, security_type
FROM information_schema.routines
WHERE specific_schema = 'public'
  AND routine_name = 'admin_save_package';
