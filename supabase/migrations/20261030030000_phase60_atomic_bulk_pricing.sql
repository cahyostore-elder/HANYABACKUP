-- Phase 60: one-call, all-or-nothing bulk catalog pricing for Author dashboard.
-- Validates all rows before committing; any error rolls back the entire batch.
BEGIN;

CREATE OR REPLACE FUNCTION public.admin_apply_package_pricing_batch(p_items jsonb)
RETURNS TABLE(package_id uuid, price numeric, supplier_cost numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_item jsonb;
  v_package_id uuid;
  v_price numeric;
  v_supplier_cost numeric;
  v_old_price numeric(10,2);
  v_package_name text;
  v_current_cost numeric(10,2);
  v_seen_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak: Author/Admin diperlukan.' USING ERRCODE = '42501';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'Data batch harus berupa array JSON.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_items) < 1 OR jsonb_array_length(p_items) > 2000 THEN
    RAISE EXCEPTION 'Batch harus berisi 1–2000 produk.' USING ERRCODE = '22023';
  END IF;

  -- Validate and lock each package before writing. The transaction is all-or-nothing.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) AS item(value)
  LOOP
    IF jsonb_typeof(v_item) <> 'object' OR NOT (v_item ? 'id') OR NOT (v_item ? 'price') THEN
      RAISE EXCEPTION 'Setiap baris harus memiliki id dan price.' USING ERRCODE = '22023';
    END IF;
    BEGIN
      v_package_id := (v_item->>'id')::uuid;
      v_price := (v_item->>'price')::numeric;
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'ID atau harga jual pada batch tidak valid.' USING ERRCODE = '22023';
    END;
    IF v_package_id IS NULL OR v_price IS NULL OR v_price < 0 OR v_price > 99999999 OR v_price <> trunc(v_price) THEN
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
      IF v_supplier_cost < 0 OR v_supplier_cost > 99999999 OR v_supplier_cost <> trunc(v_supplier_cost) THEN
        RAISE EXCEPTION 'Harga modal supplier harus angka bulat Rp0–Rp99.999.999.' USING ERRCODE = '22023';
      END IF;
    END IF;

    SELECT p.price, p.name INTO v_old_price, v_package_name
    FROM public.packages AS p WHERE p.id = v_package_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Paket tidak ditemukan: %.', v_package_id USING ERRCODE = '22023';
    END IF;

    IF v_item ? 'supplier_cost' AND jsonb_typeof(v_item->'supplier_cost') = 'number' THEN
      INSERT INTO public.package_supplier_costs AS existing (package_id, supplier_cost, updated_at, updated_by)
      VALUES (v_package_id, v_supplier_cost, now(), auth.uid())
      ON CONFLICT (package_id) DO UPDATE
        SET supplier_cost = EXCLUDED.supplier_cost, updated_at = now(), updated_by = auth.uid();
    END IF;

    SELECT s.supplier_cost INTO v_current_cost
    FROM public.package_supplier_costs AS s WHERE s.package_id = v_package_id;
    UPDATE public.packages AS p SET price = v_price WHERE p.id = v_package_id;

    IF v_current_cost IS NOT NULL AND v_old_price IS DISTINCT FROM v_price THEN
      INSERT INTO public.package_pricing_audit (package_id, package_name, supplier_cost, old_price, new_price, margin_percent, applied_by)
      VALUES (v_package_id, v_package_name, v_current_cost, v_old_price, v_price,
        CASE WHEN v_price = 0 THEN 0.00 ELSE round(((v_price - v_current_cost) / v_price) * 100, 2) END,
        auth.uid());
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

NOTIFY pgrst, 'reload schema';
COMMIT;
