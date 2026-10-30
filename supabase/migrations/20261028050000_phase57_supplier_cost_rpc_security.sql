-- Phase 57: narrow, admin-only RPCs for supplier-cost reads and writes.
-- Adds audit attribution without changing existing supplier costs or selling prices.
-- Blank supplier cost stays absent; it is never inferred from the selling price.
BEGIN;

-- The profile role lookup must bypass profiles RLS to avoid policy recursion.
-- Keep the privileged helper in a non-exposed schema; the public wrapper is invoker-only.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'author')
  );
$function$;
REVOKE ALL ON FUNCTION private.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
  SELECT private.is_admin();
$function$;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

ALTER TABLE public.package_supplier_costs
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Rp0 is a valid supplier cost; an absent row still means not configured.
ALTER TABLE public.package_supplier_costs
  DROP CONSTRAINT IF EXISTS package_supplier_costs_supplier_cost_check;
ALTER TABLE public.package_supplier_costs
  ADD CONSTRAINT package_supplier_costs_supplier_cost_check
  CHECK (supplier_cost >= 0);


-- Read supplier cost only through this admin-gated RPC; no direct browser SELECT.
CREATE OR REPLACE FUNCTION public.admin_list_package_supplier_costs()
RETURNS TABLE (
  package_id uuid,
  supplier_cost numeric,
  updated_at timestamptz,
  updated_by uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT s.package_id, s.supplier_cost, s.updated_at, s.updated_by
  FROM public.package_supplier_costs AS s
  ORDER BY s.updated_at DESC;
END;
$function$;

-- Update only the supplier cost. This RPC never changes public.packages.price.
CREATE OR REPLACE FUNCTION public.admin_upsert_package_supplier_cost(
  p_package_id uuid,
  p_supplier_cost numeric
)
RETURNS TABLE (
  package_id uuid,
  supplier_cost numeric,
  updated_at timestamptz,
  updated_by uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = '42501';
  END IF;

  IF p_package_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.packages AS p WHERE p.id = p_package_id
  ) THEN
    RAISE EXCEPTION 'Paket tidak ditemukan.' USING ERRCODE = '22023';
  END IF;

  IF p_supplier_cost IS NULL
    OR p_supplier_cost < 0
    OR p_supplier_cost > 99999999
    OR p_supplier_cost <> trunc(p_supplier_cost)
  THEN
    RAISE EXCEPTION 'Harga modal supplier harus berupa angka bulat Rp0–Rp99.999.999.'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.package_supplier_costs AS existing (
    package_id, supplier_cost, updated_at, updated_by
  ) VALUES (
    p_package_id, p_supplier_cost, now(), auth.uid()
  )
  ON CONFLICT (package_id) DO UPDATE
    SET supplier_cost = EXCLUDED.supplier_cost,
        updated_at = now(),
        updated_by = auth.uid();

  RETURN QUERY
  SELECT s.package_id, s.supplier_cost, s.updated_at, s.updated_by
  FROM public.package_supplier_costs AS s
  WHERE s.package_id = p_package_id;
END;
$function$;

-- Maintain audit identity when the bulk-price RPC also saves a supplier cost.
CREATE OR REPLACE FUNCTION public.admin_update_package_pricing(
  p_package_id uuid,
  p_price numeric,
  p_supplier_cost numeric DEFAULT NULL
)
RETURNS TABLE(package_id uuid, price numeric, supplier_cost numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_cost numeric(10,2);
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Hanya admin/staf toko yang dapat mengubah harga.' USING ERRCODE = '42501';
  END IF;
  IF p_price IS NULL OR p_price < 0 OR p_price > 99999999 OR p_price <> trunc(p_price) THEN
    RAISE EXCEPTION 'Harga jual harus berupa angka bulat Rp0–Rp99.999.999.' USING ERRCODE = '22023';
  END IF;
  IF p_supplier_cost IS NOT NULL AND (
    p_supplier_cost < 0 OR p_supplier_cost > 99999999 OR p_supplier_cost <> trunc(p_supplier_cost)
  ) THEN
    RAISE EXCEPTION 'Harga modal supplier harus berupa angka bulat Rp0–Rp99.999.999.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.packages AS p SET price = p_price WHERE p.id = p_package_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produk tidak ditemukan.' USING ERRCODE = '22023';
  END IF;

  IF p_supplier_cost IS NOT NULL THEN
    INSERT INTO public.package_supplier_costs AS existing (
      package_id, supplier_cost, updated_at, updated_by
    ) VALUES (
      p_package_id, p_supplier_cost, now(), auth.uid()
    )
    ON CONFLICT (package_id) DO UPDATE
      SET supplier_cost = EXCLUDED.supplier_cost,
          updated_at = now(),
          updated_by = auth.uid();
  END IF;

  SELECT c.supplier_cost INTO v_cost
  FROM public.package_supplier_costs AS c
  WHERE c.package_id = p_package_id;

  RETURN QUERY SELECT p_package_id, p_price, v_cost;
END;
$function$;

-- Phase 56 package save stays atomic. A NULL modal means "not entered":
-- preserve the existing cost (or leave it absent), never create an Rp0 cost row.
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
AS $function$
DECLARE
  v_package_id uuid;
  v_supplier_cost numeric(10,2);
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Hanya admin/author yang dapat menyimpan paket.' USING ERRCODE = '42501';
  END IF;

  IF p_brand_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.brands AS b WHERE b.id = p_brand_id
  ) THEN
    RAISE EXCEPTION 'Brand/operator tidak ditemukan.' USING ERRCODE = '22023';
  END IF;

  IF p_name IS NULL OR length(btrim(p_name)) = 0 OR length(btrim(p_name)) > 160 THEN
    RAISE EXCEPTION 'Nama paket wajib diisi dan maksimal 160 karakter.' USING ERRCODE = '22023';
  END IF;

  IF p_price IS NULL OR p_price < 0 OR p_price > 99999999 OR p_price <> trunc(p_price) THEN
    RAISE EXCEPTION 'Harga jual harus berupa angka bulat Rp0–Rp99.999.999.' USING ERRCODE = '22023';
  END IF;

  IF p_supplier_cost IS NOT NULL AND (
    p_supplier_cost < 0 OR p_supplier_cost > 99999999 OR p_supplier_cost <> trunc(p_supplier_cost)
  ) THEN
    RAISE EXCEPTION 'Harga modal supplier harus berupa angka bulat Rp0–Rp99.999.999.' USING ERRCODE = '22023';
  END IF;

  IF p_sort_order IS NULL OR p_sort_order < 0 THEN
    RAISE EXCEPTION 'Urutan paket tidak valid.' USING ERRCODE = '22023';
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
      RAISE EXCEPTION 'Paket tidak ditemukan. Muat ulang katalog lalu coba lagi.' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_supplier_cost IS NOT NULL THEN
    INSERT INTO public.package_supplier_costs AS existing (
      package_id, supplier_cost, updated_at, updated_by
    ) VALUES (
      v_package_id, p_supplier_cost, now(), auth.uid()
    )
    ON CONFLICT (package_id) DO UPDATE
      SET supplier_cost = EXCLUDED.supplier_cost,
          updated_at = now(),
          updated_by = auth.uid();
  END IF;

  SELECT s.supplier_cost INTO v_supplier_cost
  FROM public.package_supplier_costs AS s
  WHERE s.package_id = v_package_id;

  RETURN QUERY SELECT v_package_id, p_price, v_supplier_cost;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_list_package_supplier_costs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_package_supplier_costs() TO authenticated;
REVOKE ALL ON FUNCTION public.admin_upsert_package_supplier_cost(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_package_supplier_cost(uuid, numeric) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_update_package_pricing(uuid, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_package_pricing(uuid, numeric, numeric) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_save_package(uuid, uuid, text, text, numeric, integer, boolean, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_package(uuid, uuid, text, text, numeric, integer, boolean, numeric) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
