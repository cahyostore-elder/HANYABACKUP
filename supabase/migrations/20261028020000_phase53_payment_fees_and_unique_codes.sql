-- Phase 53: server-authoritative method fees and unique payment codes Rp101-Rp999.
-- Apply after Phase 33. Existing orders and their totals are preserved.
-- Review and back up the target database before applying this migration.
-- Existing orders are preserved; the key is nullable for historical rows.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS client_request_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_user_client_request_id
  ON public.orders (user_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

-- Replace the six-argument client RPC with a seven-argument, required-key form.
-- Existing UI should be deployed alongside this migration because the RPC signature changes.
DROP FUNCTION IF EXISTS public.create_topup_order(uuid, uuid, uuid, text, text, text);
DROP FUNCTION IF EXISTS public.create_topup_order(uuid, uuid, uuid, text, text, text, uuid);

CREATE FUNCTION public.create_topup_order(
  p_category_id uuid,
  p_brand_id uuid,
  p_package_id uuid,
  p_target text,
  p_server text,
  p_payment_method text,
  p_request_id uuid
)
RETURNS TABLE (
  id uuid,
  code text,
  price numeric,
  total_amount numeric,
  unique_code integer,
  payment_method text,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_actual_category uuid;
  v_requires_server boolean;
  v_price numeric(10,2);
  v_unique_code integer;
  v_payment_fee integer;
  v_order_id uuid;
  v_code text;
  v_attempt integer := 0;
  v_existing public.orders%ROWTYPE;
  v_target text := trim(coalesce(p_target, ''));
  v_server text := nullif(trim(coalesce(p_server, '')), '');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Silakan masuk sebelum membuat pesanan.';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Kunci permintaan pesanan tidak valid. Muat ulang halaman dan coba lagi.';
  END IF;
  IF length(v_target) = 0 THEN
    RAISE EXCEPTION 'Tujuan top-up wajib diisi.';
  END IF;
  IF length(v_target) > 100 OR length(coalesce(v_server, '')) > 32 THEN
    RAISE EXCEPTION 'Data tujuan pesanan terlalu panjang.';
  END IF;

  -- Serialize retries with the same key, then return the original order when
  -- the payload matches. This covers the case where the server committed but
  -- the browser lost the response and the user retries.
  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text), hashtext(p_request_id::text));
  SELECT * INTO v_existing
    FROM public.orders o
    WHERE o.user_id = v_user_id AND o.client_request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.category_id IS DISTINCT FROM p_category_id
      OR v_existing.brand_id IS DISTINCT FROM p_brand_id
      OR v_existing.package_id IS DISTINCT FROM p_package_id
      OR v_existing.target IS DISTINCT FROM v_target
      OR v_existing.server IS DISTINCT FROM v_server
      OR v_existing.payment_method IS DISTINCT FROM p_payment_method THEN
      RAISE EXCEPTION 'Kunci permintaan sudah digunakan untuk data pesanan berbeda. Muat ulang dan buat pesanan baru.';
    END IF;
    RETURN QUERY
      SELECT o.id, o.code, o.price, o.total_amount, o.unique_code,
             o.payment_method, o.status, o.created_at
      FROM public.orders o WHERE o.id = v_existing.id;
    RETURN;
  END IF;

  IF p_payment_method IS NULL OR p_payment_method NOT IN
    ('dana', 'gopay', 'ovo', 'shopeepay', 'seabank', 'qris') THEN
    RAISE EXCEPTION 'Metode pembayaran tidak tersedia.';
  END IF;

  SELECT b.category_id, b.requires_server
    INTO v_actual_category, v_requires_server
    FROM public.brands b WHERE b.id = p_brand_id;
  IF NOT FOUND OR v_actual_category IS DISTINCT FROM p_category_id THEN
    RAISE EXCEPTION 'Brand tidak valid untuk kategori ini.';
  END IF;
  IF v_requires_server AND length(coalesce(v_server, '')) = 0 THEN
    RAISE EXCEPTION 'Server wajib diisi untuk brand ini.';
  END IF;

  SELECT p.price INTO v_price
    FROM public.packages p
    WHERE p.id = p_package_id AND p.brand_id = p_brand_id;
  IF NOT FOUND OR v_price IS NULL OR v_price < 0 THEN
    RAISE EXCEPTION 'Paket tidak valid.';
  END IF;

  -- Fees are authoritative here; client-side values are display-only.
  v_payment_fee := CASE p_payment_method
    WHEN 'qris' THEN 300
    WHEN 'seabank' THEN 1000
    WHEN 'dana' THEN 500
    WHEN 'gopay' THEN 500
    WHEN 'ovo' THEN 500
    WHEN 'shopeepay' THEN 500
    ELSE NULL
  END;
  IF v_payment_fee IS NULL THEN
    RAISE EXCEPTION 'Biaya admin metode pembayaran tidak valid.';
  END IF;

  -- Serialize allocation and avoid duplicate final transfer amounts among active orders.
  PERFORM pg_advisory_xact_lock(hashtext('fityorastore-order-unique-code'));
  LOOP
    v_attempt := v_attempt + 1;
    v_unique_code := floor(random() * 899)::integer + 101; -- inclusive Rp101-Rp999
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.total_amount = v_price + v_payment_fee + v_unique_code
        AND o.status IN ('pending', 'processing')
    );
    IF v_attempt >= 899 THEN
      RAISE EXCEPTION 'Tidak dapat membuat kode pembayaran unik saat ini. Coba lagi nanti.';
    END IF;
  END LOOP;

  v_code := 'FS' || to_char(now(), 'YYMMDD')
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  INSERT INTO public.orders (
    code, user_id, category_id, brand_id, package_id,
    target, server, price, payment_method, total_amount, unique_code, status, client_request_id
  ) VALUES (
    v_code, v_user_id, p_category_id, p_brand_id, p_package_id,
    v_target, v_server, v_price, p_payment_method, v_price + v_payment_fee + v_unique_code, v_unique_code, 'pending', p_request_id
  ) RETURNING orders.id INTO v_order_id;

  RETURN QUERY
    SELECT o.id, o.code, o.price, o.total_amount, o.unique_code,
           o.payment_method, o.status, o.created_at
    FROM public.orders o WHERE o.id = v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_topup_order(uuid, uuid, uuid, text, text, text, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_topup_order(uuid, uuid, uuid, text, text, text, uuid)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
