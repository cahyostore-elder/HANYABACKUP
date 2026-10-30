-- Phase 63: clearly separate illustrative supplier-cost samples from verified costs.
-- Sample costs never update selling prices. Author input through guarded RPCs marks costs verified.
-- For packages with a positive selling price, examples are reverse-calculated using the
-- current 7% markup rule. For zero-price packages, Rp0 is a visible placeholder only.

BEGIN;

ALTER TABLE public.package_supplier_costs
  ADD COLUMN IF NOT EXISTS supplier_cost_status text NOT NULL DEFAULT 'verified',
  ADD COLUMN IF NOT EXISTS supplier_cost_source text NOT NULL DEFAULT 'author_manual';

ALTER TABLE public.package_supplier_costs
  DROP CONSTRAINT IF EXISTS package_supplier_costs_supplier_cost_check;
ALTER TABLE public.package_supplier_costs
  ADD CONSTRAINT package_supplier_costs_supplier_cost_check
  CHECK (supplier_cost >= 0);

ALTER TABLE public.package_supplier_costs
  DROP CONSTRAINT IF EXISTS package_supplier_costs_supplier_cost_status_check;
ALTER TABLE public.package_supplier_costs
  ADD CONSTRAINT package_supplier_costs_supplier_cost_status_check
  CHECK (supplier_cost_status IN ('sample', 'verified'));

ALTER TABLE public.package_supplier_costs
  DROP CONSTRAINT IF EXISTS package_supplier_costs_supplier_cost_source_check;
ALTER TABLE public.package_supplier_costs
  ADD CONSTRAINT package_supplier_costs_supplier_cost_source_check
  CHECK (supplier_cost_source IN (
    'derived_example_7_percent',
    'placeholder_unpriced_package',
    'author_manual',
    'author_import'
  ));

-- Seed only packages that do not yet have any supplier-cost row.
-- Existing supplier entries are never overwritten.
INSERT INTO public.package_supplier_costs (
  package_id, supplier_cost, updated_at, updated_by,
  supplier_cost_status, supplier_cost_source
)
SELECT
  p.id,
  CASE
    WHEN COALESCE(p.price, 0) > 0 THEN round(p.price / 1.07, 0)
    ELSE 0
  END,
  now(),
  NULL,
  'sample',
  CASE
    WHEN COALESCE(p.price, 0) > 0 THEN 'derived_example_7_percent'
    ELSE 'placeholder_unpriced_package'
  END
FROM public.packages AS p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.package_supplier_costs AS existing
  WHERE existing.package_id = p.id
);

-- Recreate the list RPC with explicit sample/verified status.
DROP FUNCTION IF EXISTS public.admin_list_package_supplier_costs();
CREATE FUNCTION public.admin_list_package_supplier_costs()
RETURNS TABLE (
  package_id uuid,
  supplier_cost numeric,
  updated_at timestamptz,
  updated_by uuid,
  supplier_cost_status text,
  supplier_cost_source text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: login Author/Admin diperlukan.'
      USING ERRCODE = '42501';
  END IF;

  SELECT pr.role INTO v_role
  FROM public.profiles AS pr
  WHERE pr.id = (SELECT auth.uid());

  IF COALESCE(v_role, '') NOT IN ('admin', 'author') THEN
    RAISE EXCEPTION 'Akses ditolak: hanya Author/Admin yang dapat melihat modal supplier.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    s.package_id,
    s.supplier_cost,
    s.updated_at,
    s.updated_by,
    s.supplier_cost_status,
    s.supplier_cost_source
  FROM public.package_supplier_costs AS s
  ORDER BY s.updated_at DESC;
END;
$function$;
REVOKE ALL ON FUNCTION public.admin_list_package_supplier_costs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_package_supplier_costs() TO authenticated;

-- Any explicit value submitted from the Author editor replaces the sample and becomes verified.
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
SET search_path = ''
AS $function$
DECLARE
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: login Author/Admin diperlukan.' USING ERRCODE = '42501';
  END IF;

  SELECT pr.role INTO v_role
  FROM public.profiles AS pr
  WHERE pr.id = (SELECT auth.uid());

  IF COALESCE(v_role, '') NOT IN ('admin', 'author') THEN
    RAISE EXCEPTION 'Akses ditolak: hanya Author/Admin yang dapat mengubah modal supplier.' USING ERRCODE = '42501';
  END IF;

  IF p_package_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.packages AS p WHERE p.id = p_package_id
  ) THEN
    RAISE EXCEPTION 'Paket tidak ditemukan.' USING ERRCODE = '22023';
  END IF;

  IF p_supplier_cost IS NULL OR p_supplier_cost < 0
    OR p_supplier_cost > 99999999 OR p_supplier_cost <> trunc(p_supplier_cost, 0)
  THEN
    RAISE EXCEPTION 'Harga modal supplier harus angka bulat Rp0–Rp99.999.999.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.package_supplier_costs AS existing (
    package_id, supplier_cost, updated_at, updated_by,
    supplier_cost_status, supplier_cost_source
  ) VALUES (
    p_package_id, p_supplier_cost, now(), auth.uid(),
    'verified', 'author_manual'
  )
  ON CONFLICT (package_id) DO UPDATE
    SET supplier_cost = EXCLUDED.supplier_cost,
        updated_at = now(),
        updated_by = auth.uid(),
        supplier_cost_status = 'verified',
        supplier_cost_source = 'author_manual';

  RETURN QUERY
  SELECT s.package_id, s.supplier_cost, s.updated_at, s.updated_by
  FROM public.package_supplier_costs AS s
  WHERE s.package_id = p_package_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.admin_upsert_package_supplier_cost(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_package_supplier_cost(uuid, numeric) TO authenticated;

-- Atomic package metadata/selling-price save. NULL supplier cost preserves the current sample
-- or verified value; a non-NULL Author-entered value is explicitly marked verified.
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
SET search_path = ''
AS $function$
DECLARE
  v_role text;
  v_package_id uuid;
  v_old_price numeric(10,2);
  v_package_name text;
  v_supplier_cost numeric(10,2);
  v_supplier_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: login Author/Admin diperlukan.' USING ERRCODE = '42501';
  END IF;
  SELECT pr.role INTO v_role
  FROM public.profiles AS pr
  WHERE pr.id = (SELECT auth.uid());
  IF COALESCE(v_role, '') NOT IN ('admin', 'author') THEN
    RAISE EXCEPTION 'Hanya Author/Admin yang dapat menyimpan paket.' USING ERRCODE = '42501';
  END IF;

  IF p_brand_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.brands AS b WHERE b.id = p_brand_id
  ) THEN
    RAISE EXCEPTION 'Brand/operator tidak ditemukan.' USING ERRCODE = '22023';
  END IF;
  IF p_name IS NULL OR length(btrim(p_name)) = 0 OR length(btrim(p_name)) > 160 THEN
    RAISE EXCEPTION 'Nama paket wajib diisi dan maksimal 160 karakter.' USING ERRCODE = '22023';
  END IF;
  IF p_price IS NULL OR p_price < 0 OR p_price > 99999999 OR p_price <> trunc(p_price, 0) THEN
    RAISE EXCEPTION 'Harga jual harus angka bulat Rp0–Rp99.999.999.' USING ERRCODE = '22023';
  END IF;
  IF p_supplier_cost IS NOT NULL AND (
    p_supplier_cost < 0 OR p_supplier_cost > 99999999 OR p_supplier_cost <> trunc(p_supplier_cost, 0)
  ) THEN
    RAISE EXCEPTION 'Harga modal supplier harus angka bulat Rp0–Rp99.999.999.' USING ERRCODE = '22023';
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
    v_old_price := 0;
    v_package_name := btrim(p_name);
  ELSE
    SELECT p.price, p.name
      INTO v_old_price, v_package_name
    FROM public.packages AS p
    WHERE p.id = p_package_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Paket tidak ditemukan.' USING ERRCODE = '22023';
    END IF;

    UPDATE public.packages AS p
    SET brand_id = p_brand_id,
        name = btrim(p_name),
        description = COALESCE(btrim(p_description), ''),
        price = p_price,
        sort_order = p_sort_order,
        featured = COALESCE(p_featured, false)
    WHERE p.id = p_package_id
    RETURNING p.id INTO v_package_id;
  END IF;

  IF p_supplier_cost IS NOT NULL THEN
    INSERT INTO public.package_supplier_costs AS existing (
      package_id, supplier_cost, updated_at, updated_by,
      supplier_cost_status, supplier_cost_source
    ) VALUES (
      v_package_id, p_supplier_cost, now(), auth.uid(),
      'verified', 'author_manual'
    )
    ON CONFLICT (package_id) DO UPDATE
      SET supplier_cost = EXCLUDED.supplier_cost,
          updated_at = now(),
          updated_by = auth.uid(),
          supplier_cost_status = 'verified',
          supplier_cost_source = 'author_manual';
  END IF;

  SELECT s.supplier_cost, s.supplier_cost_status
    INTO v_supplier_cost, v_supplier_status
  FROM public.package_supplier_costs AS s
  WHERE s.package_id = v_package_id;

  IF v_supplier_status = 'verified' AND v_supplier_cost IS NOT NULL
    AND v_old_price IS DISTINCT FROM p_price
  THEN
    INSERT INTO public.package_pricing_audit (
      package_id, package_name, supplier_cost, old_price, new_price,
      margin_percent, applied_by
    ) VALUES (
      v_package_id, v_package_name, v_supplier_cost, v_old_price, p_price,
      CASE WHEN p_price = 0 THEN 0.00
           ELSE round(((p_price - v_supplier_cost) / p_price) * 100, 2) END,
      auth.uid()
    );
  END IF;

  RETURN QUERY SELECT v_package_id, p_price, v_supplier_cost;
END;
$function$;
REVOKE ALL ON FUNCTION public.admin_save_package(uuid, uuid, text, text, numeric, integer, boolean, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_package(uuid, uuid, text, text, numeric, integer, boolean, numeric) TO authenticated;

-- Explicit "supplier + selling price" action. This accepts only the price typed by the
-- Author (not an example row), marks it verified, and applies the existing +7% rule.
CREATE OR REPLACE FUNCTION public.admin_update_supplier_cost_and_price(
  p_package_id uuid,
  p_supplier_cost numeric
)
RETURNS TABLE (
  package_id uuid,
  old_price numeric,
  new_price numeric,
  supplier_cost numeric,
  margin_percent numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_role text;
  v_old_price numeric(10,2);
  v_new_price numeric(10,2);
  v_package_name text;
  v_margin numeric(10,2);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: login Author/Admin diperlukan.' USING ERRCODE = '42501';
  END IF;
  SELECT pr.role INTO v_role
  FROM public.profiles AS pr
  WHERE pr.id = (SELECT auth.uid());
  IF COALESCE(v_role, '') NOT IN ('admin', 'author') THEN
    RAISE EXCEPTION 'Hanya Author/Admin yang dapat memperbarui harga.' USING ERRCODE = '42501';
  END IF;

  IF p_package_id IS NULL OR p_supplier_cost IS NULL
    OR p_supplier_cost < 0 OR p_supplier_cost > 99999999
    OR p_supplier_cost <> trunc(p_supplier_cost, 0)
  THEN
    RAISE EXCEPTION 'Harga modal supplier harus angka bulat Rp0–Rp99.999.999.' USING ERRCODE = '22023';
  END IF;

  SELECT p.price, p.name
    INTO v_old_price, v_package_name
  FROM public.packages AS p
  WHERE p.id = p_package_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paket tidak ditemukan.' USING ERRCODE = '22023';
  END IF;

  v_new_price := round(p_supplier_cost * 1.07, 0);
  IF v_new_price < 0 OR v_new_price > 99999999 THEN
    RAISE EXCEPTION 'Hasil harga jual melewati batas maksimum.' USING ERRCODE = '22023';
  END IF;
  v_margin := CASE WHEN v_new_price = 0 THEN 0.00
                   ELSE round(((v_new_price - p_supplier_cost) / v_new_price) * 100, 2) END;

  INSERT INTO public.package_supplier_costs AS existing (
    package_id, supplier_cost, updated_at, updated_by,
    supplier_cost_status, supplier_cost_source
  ) VALUES (
    p_package_id, p_supplier_cost, now(), auth.uid(),
    'verified', 'author_manual'
  )
  ON CONFLICT (package_id) DO UPDATE
    SET supplier_cost = EXCLUDED.supplier_cost,
        updated_at = now(),
        updated_by = auth.uid(),
        supplier_cost_status = 'verified',
        supplier_cost_source = 'author_manual';

  UPDATE public.packages AS p
  SET price = v_new_price
  WHERE p.id = p_package_id;

  IF v_old_price IS DISTINCT FROM v_new_price THEN
    INSERT INTO public.package_pricing_audit (
      package_id, package_name, supplier_cost, old_price, new_price,
      margin_percent, applied_by
    ) VALUES (
      p_package_id, v_package_name, p_supplier_cost, v_old_price,
      v_new_price, v_margin, auth.uid()
    );
  END IF;

  RETURN QUERY SELECT p_package_id, v_old_price, v_new_price, p_supplier_cost, v_margin;
END;
$function$;
REVOKE ALL ON FUNCTION public.admin_update_supplier_cost_and_price(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_supplier_cost_and_price(uuid, numeric) TO authenticated;

-- Atomic bulk save. Costs supplied in this payload come from an explicit Author-confirmed
-- CSV preview and are recorded as verified. Omitted costs (including sample rows) stay untouched.
CREATE OR REPLACE FUNCTION public.admin_apply_package_pricing_batch(p_items jsonb)
RETURNS TABLE(package_id uuid, price numeric, supplier_cost numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_role text;
  v_item jsonb;
  v_package_id uuid;
  v_price numeric;
  v_supplier_cost numeric;
  v_current_cost numeric;
  v_current_status text;
  v_old_price numeric(10,2);
  v_package_name text;
  v_seen_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: login Author/Admin diperlukan.' USING ERRCODE = '42501';
  END IF;
  SELECT pr.role INTO v_role
  FROM public.profiles AS pr
  WHERE pr.id = (SELECT auth.uid());
  IF COALESCE(v_role, '') NOT IN ('admin', 'author') THEN
    RAISE EXCEPTION 'Akses ditolak: hanya Author/Admin yang dapat mengubah harga.' USING ERRCODE = '42501';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
    OR jsonb_array_length(p_items) < 1 OR jsonb_array_length(p_items) > 2000
  THEN
    RAISE EXCEPTION 'Batch harus berisi 1–2000 produk.' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) AS item(value)
  LOOP
    IF jsonb_typeof(v_item) <> 'object'
      OR NOT (v_item ? 'id')
      OR NOT (v_item ? 'price')
    THEN
      RAISE EXCEPTION 'Setiap baris harus memiliki id dan price.' USING ERRCODE = '22023';
    END IF;

    BEGIN
      v_package_id := (v_item->>'id')::uuid;
      v_price := (v_item->>'price')::numeric;
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'ID atau harga jual pada batch tidak valid.' USING ERRCODE = '22023';
    END;

    IF v_package_id IS NULL OR v_price IS NULL OR v_price < 0
      OR v_price > 99999999 OR v_price <> trunc(v_price, 0)
    THEN
      RAISE EXCEPTION 'Harga jual harus angka bulat Rp0–Rp99.999.999.' USING ERRCODE = '22023';
    END IF;
    IF v_package_id = ANY(v_seen_ids) THEN
      RAISE EXCEPTION 'Batch berisi ID produk duplikat: %.', v_package_id USING ERRCODE = '22023';
    END IF;
    v_seen_ids := array_append(v_seen_ids, v_package_id);

    v_supplier_cost := NULL;
    IF v_item ? 'supplier_cost' AND jsonb_typeof(v_item->'supplier_cost') <> 'null' THEN
      IF jsonb_typeof(v_item->'supplier_cost') <> 'number' THEN
        RAISE EXCEPTION 'Harga modal supplier harus berupa angka atau null.' USING ERRCODE = '22023';
      END IF;
      BEGIN
        v_supplier_cost := (v_item->>'supplier_cost')::numeric;
      EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
        RAISE EXCEPTION 'Harga modal supplier pada batch tidak valid.' USING ERRCODE = '22023';
      END;
      IF v_supplier_cost < 0 OR v_supplier_cost > 99999999
        OR v_supplier_cost <> trunc(v_supplier_cost, 0)
      THEN
        RAISE EXCEPTION 'Harga modal supplier harus angka bulat Rp0–Rp99.999.999.' USING ERRCODE = '22023';
      END IF;
    END IF;

    SELECT p.price, p.name
      INTO v_old_price, v_package_name
    FROM public.packages AS p
    WHERE p.id = v_package_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Paket tidak ditemukan: %.', v_package_id USING ERRCODE = '22023';
    END IF;

    IF v_supplier_cost IS NOT NULL THEN
      INSERT INTO public.package_supplier_costs AS existing (
        package_id, supplier_cost, updated_at, updated_by,
        supplier_cost_status, supplier_cost_source
      ) VALUES (
        v_package_id, v_supplier_cost, now(), auth.uid(),
        'verified', 'author_import'
      )
      ON CONFLICT (package_id) DO UPDATE
        SET supplier_cost = EXCLUDED.supplier_cost,
            updated_at = now(),
            updated_by = auth.uid(),
            supplier_cost_status = 'verified',
            supplier_cost_source = 'author_import';
    END IF;

    SELECT s.supplier_cost, s.supplier_cost_status
      INTO v_current_cost, v_current_status
    FROM public.package_supplier_costs AS s
    WHERE s.package_id = v_package_id;

    UPDATE public.packages AS p
    SET price = v_price
    WHERE p.id = v_package_id;

    IF v_current_status = 'verified' AND v_current_cost IS NOT NULL
      AND v_old_price IS DISTINCT FROM v_price
    THEN
      INSERT INTO public.package_pricing_audit (
        package_id, package_name, supplier_cost, old_price, new_price,
        margin_percent, applied_by
      ) VALUES (
        v_package_id, v_package_name, v_current_cost, v_old_price, v_price,
        CASE WHEN v_price = 0 THEN 0.00
             ELSE round(((v_price - v_current_cost) / v_price) * 100, 2) END,
        auth.uid()
      );
    END IF;

    package_id := v_package_id;
    price := v_price;
    supplier_cost := v_current_cost;
    RETURN NEXT;
  END LOOP;
END;
$function$;
REVOKE ALL ON FUNCTION public.admin_apply_package_pricing_batch(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_apply_package_pricing_batch(jsonb) TO authenticated;

-- Disable legacy pricing RPCs that cannot distinguish sample and verified costs.
-- Phase 63's status-aware RPCs above replace these entry points.
REVOKE ALL ON FUNCTION public.admin_preview_package_pricing()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_set_package_supplier_cost(uuid, numeric)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_apply_package_pricing(uuid[])
  FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
