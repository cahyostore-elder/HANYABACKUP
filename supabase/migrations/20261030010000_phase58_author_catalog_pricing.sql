-- Phase 58: Author catalog workflow for late supplier-cost entry.
-- Rp0 is valid. Automatic price recalculation uses the existing 7% markup rule and logs audit.
BEGIN;

CREATE OR REPLACE FUNCTION public.admin_update_package_pricing(
  p_package_id uuid, p_price numeric, p_supplier_cost numeric DEFAULT NULL
)
RETURNS TABLE(package_id uuid, price numeric, supplier_cost numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $function$
DECLARE v_old_price numeric(10,2); v_package_name text; v_cost numeric(10,2);
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Akses ditolak: Author/Admin diperlukan.' USING ERRCODE = '42501'; END IF;
  IF p_package_id IS NULL OR p_price IS NULL OR p_price < 0 OR p_price > 99999999 OR p_price <> trunc(p_price) THEN RAISE EXCEPTION 'Paket atau harga jual tidak valid.' USING ERRCODE = '22023'; END IF;
  IF p_supplier_cost IS NOT NULL AND (p_supplier_cost < 0 OR p_supplier_cost > 99999999 OR p_supplier_cost <> trunc(p_supplier_cost)) THEN RAISE EXCEPTION 'Harga modal supplier harus angka bulat Rp0–Rp99.999.999.' USING ERRCODE = '22023'; END IF;
  SELECT p.price, p.name INTO v_old_price, v_package_name FROM public.packages AS p WHERE p.id = p_package_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paket tidak ditemukan.' USING ERRCODE = '22023'; END IF;
  IF p_supplier_cost IS NOT NULL THEN
    INSERT INTO public.package_supplier_costs AS existing (package_id, supplier_cost, updated_at, updated_by) VALUES (p_package_id, p_supplier_cost, now(), auth.uid())
    ON CONFLICT (package_id) DO UPDATE SET supplier_cost = EXCLUDED.supplier_cost, updated_at = now(), updated_by = auth.uid();
  END IF;
  SELECT s.supplier_cost INTO v_cost FROM public.package_supplier_costs AS s WHERE s.package_id = p_package_id;
  UPDATE public.packages AS p SET price = p_price WHERE p.id = p_package_id;
  IF v_cost IS NOT NULL AND v_old_price IS DISTINCT FROM p_price THEN
    INSERT INTO public.package_pricing_audit (package_id, package_name, supplier_cost, old_price, new_price, margin_percent, applied_by)
    VALUES (p_package_id, v_package_name, v_cost, v_old_price, p_price, CASE WHEN p_price = 0 THEN 0.00 ELSE round(((p_price - v_cost) / p_price) * 100, 2) END, auth.uid());
  END IF;
  RETURN QUERY SELECT p_package_id, p_price, v_cost;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_update_package_pricing(uuid, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_package_pricing(uuid, numeric, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_supplier_cost_and_price(p_package_id uuid, p_supplier_cost numeric)
RETURNS TABLE(package_id uuid, old_price numeric, new_price numeric, supplier_cost numeric, margin_percent numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $function$
DECLARE v_old_price numeric(10,2); v_new_price numeric(10,2); v_package_name text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Akses ditolak: Author/Admin diperlukan.' USING ERRCODE = '42501'; END IF;
  IF p_package_id IS NULL OR p_supplier_cost IS NULL OR p_supplier_cost < 0 OR p_supplier_cost > 99999999 OR p_supplier_cost <> trunc(p_supplier_cost) THEN RAISE EXCEPTION 'Harga modal supplier harus angka bulat Rp0–Rp99.999.999.' USING ERRCODE = '22023'; END IF;
  SELECT p.price, p.name INTO v_old_price, v_package_name FROM public.packages AS p WHERE p.id = p_package_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paket tidak ditemukan.' USING ERRCODE = '22023'; END IF;
  v_new_price := round(p_supplier_cost * 1.07, 0);
  IF v_new_price < 0 OR v_new_price > 99999999 THEN RAISE EXCEPTION 'Hasil harga jual melewati batas maksimum.' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.package_supplier_costs AS existing (package_id, supplier_cost, updated_at, updated_by) VALUES (p_package_id, p_supplier_cost, now(), auth.uid())
  ON CONFLICT (package_id) DO UPDATE SET supplier_cost = EXCLUDED.supplier_cost, updated_at = now(), updated_by = auth.uid();
  UPDATE public.packages AS p SET price = v_new_price WHERE p.id = p_package_id;
  IF v_old_price IS DISTINCT FROM v_new_price THEN
    INSERT INTO public.package_pricing_audit (package_id, package_name, supplier_cost, old_price, new_price, margin_percent, applied_by) VALUES (p_package_id, v_package_name, p_supplier_cost, v_old_price, v_new_price, CASE WHEN v_new_price = 0 THEN 0.00 ELSE round(((v_new_price - p_supplier_cost) / v_new_price) * 100, 2) END, auth.uid());
  END IF;
  RETURN QUERY SELECT p_package_id, v_old_price, v_new_price, p_supplier_cost, CASE WHEN v_new_price = 0 THEN 0.00 ELSE round(((v_new_price - p_supplier_cost) / v_new_price) * 100, 2) END;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_update_supplier_cost_and_price(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_supplier_cost_and_price(uuid, numeric) TO authenticated;

-- Audit normal package-editor price changes when a supplier cost is available.
CREATE OR REPLACE FUNCTION public.admin_save_package(
  p_package_id uuid, p_brand_id uuid, p_name text, p_description text,
  p_price numeric, p_sort_order integer, p_featured boolean, p_supplier_cost numeric
)
RETURNS TABLE(saved_package_id uuid, saved_price numeric, saved_supplier_cost numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_package_id uuid;
  v_old_price numeric(10,2) := 0;
  v_package_name text;
  v_supplier_cost numeric(10,2);
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Hanya admin/author yang dapat menyimpan paket.' USING ERRCODE = '42501';
  END IF;
  IF p_brand_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.brands AS b WHERE b.id = p_brand_id) THEN
    RAISE EXCEPTION 'Brand/operator tidak ditemukan.' USING ERRCODE = '22023';
  END IF;
  IF p_name IS NULL OR length(btrim(p_name)) = 0 OR length(btrim(p_name)) > 160 THEN
    RAISE EXCEPTION 'Nama paket wajib diisi dan maksimal 160 karakter.' USING ERRCODE = '22023';
  END IF;
  IF p_price IS NULL OR p_price < 0 OR p_price > 99999999 OR p_price <> trunc(p_price) THEN
    RAISE EXCEPTION 'Harga jual harus berupa angka bulat Rp0–Rp99.999.999.' USING ERRCODE = '22023';
  END IF;
  IF p_supplier_cost IS NOT NULL AND (p_supplier_cost < 0 OR p_supplier_cost > 99999999 OR p_supplier_cost <> trunc(p_supplier_cost)) THEN
    RAISE EXCEPTION 'Harga modal supplier harus berupa angka bulat Rp0–Rp99.999.999.' USING ERRCODE = '22023';
  END IF;
  IF p_sort_order IS NULL OR p_sort_order < 0 THEN
    RAISE EXCEPTION 'Urutan paket tidak valid.' USING ERRCODE = '22023';
  END IF;

  IF p_package_id IS NULL THEN
    INSERT INTO public.packages (brand_id, name, description, price, sort_order, featured)
    VALUES (p_brand_id, btrim(p_name), COALESCE(btrim(p_description), ''), p_price, p_sort_order, COALESCE(p_featured, false))
    RETURNING id INTO v_package_id;
    v_old_price := 0;
    v_package_name := btrim(p_name);
  ELSE
    SELECT p.price, p.name INTO v_old_price, v_package_name
    FROM public.packages AS p WHERE p.id = p_package_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Paket tidak ditemukan. Muat ulang katalog lalu coba lagi.' USING ERRCODE = '22023'; END IF;
    UPDATE public.packages AS p
    SET brand_id = p_brand_id, name = btrim(p_name), description = COALESCE(btrim(p_description), ''),
        price = p_price, sort_order = p_sort_order, featured = COALESCE(p_featured, false)
    WHERE p.id = p_package_id
    RETURNING p.id INTO v_package_id;
  END IF;

  IF p_supplier_cost IS NOT NULL THEN
    INSERT INTO public.package_supplier_costs AS existing (package_id, supplier_cost, updated_at, updated_by)
    VALUES (v_package_id, p_supplier_cost, now(), auth.uid())
    ON CONFLICT (package_id) DO UPDATE
      SET supplier_cost = EXCLUDED.supplier_cost, updated_at = now(), updated_by = auth.uid();
  END IF;

  SELECT s.supplier_cost INTO v_supplier_cost
  FROM public.package_supplier_costs AS s WHERE s.package_id = v_package_id;
  IF v_supplier_cost IS NOT NULL AND v_old_price IS DISTINCT FROM p_price THEN
    INSERT INTO public.package_pricing_audit (package_id, package_name, supplier_cost, old_price, new_price, margin_percent, applied_by)
    VALUES (v_package_id, v_package_name, v_supplier_cost, v_old_price, p_price,
      CASE WHEN p_price = 0 THEN 0.00 ELSE round(((p_price - v_supplier_cost) / p_price) * 100, 2) END, auth.uid());
  END IF;
  RETURN QUERY SELECT v_package_id, p_price, v_supplier_cost;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_save_package(uuid, uuid, text, text, numeric, integer, boolean, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_package(uuid, uuid, text, text, numeric, integer, boolean, numeric) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
