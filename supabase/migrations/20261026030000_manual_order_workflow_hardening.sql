-- FityoraStore Phase 1: manual payment/order workflow hardening.
-- Apply only after reviewing the SQL and backing up the production database.
-- Existing orders are preserved; new orders receive a variable collision-avoiding code.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fulfillment_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS fulfillment_completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_pending_amount
  ON public.orders (total_amount, status)
  WHERE status IN ('pending', 'processing');

-- Fixed admin fee remains Rp500. A random 3-digit unique code is selected at
-- order creation, avoiding the same transfer total among active orders of the
-- same package price. The advisory lock serializes allocations for that price.
CREATE OR REPLACE FUNCTION public.create_topup_order(
  p_category_id uuid,
  p_brand_id uuid,
  p_package_id uuid,
  p_target text,
  p_server text,
  p_payment_method text
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
  v_order_id uuid;
  v_code text;
  v_attempt integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Silakan masuk sebelum membuat pesanan.';
  END IF;
  IF length(trim(coalesce(p_target, ''))) = 0 THEN
    RAISE EXCEPTION 'Tujuan top-up wajib diisi.';
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
  IF v_requires_server AND length(trim(coalesce(p_server, ''))) = 0 THEN
    RAISE EXCEPTION 'Server wajib diisi untuk brand ini.';
  END IF;

  SELECT p.price INTO v_price
    FROM public.packages p
    WHERE p.id = p_package_id AND p.brand_id = p_brand_id;
  IF NOT FOUND OR v_price IS NULL OR v_price < 0 THEN
    RAISE EXCEPTION 'Paket tidak valid.';
  END IF;

  -- Serialize code allocation for a given base price to reduce collisions.
  PERFORM pg_advisory_xact_lock(hashtext('fityorastore-order-unique-code'));
  LOOP
    v_attempt := v_attempt + 1;
    v_unique_code := floor(random() * 900)::integer + 100;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.total_amount = v_price + 500 + v_unique_code
        AND o.status IN ('pending', 'processing')
    );
    IF v_attempt >= 900 THEN
      RAISE EXCEPTION 'Tidak dapat membuat kode pembayaran unik saat ini. Coba lagi nanti.';
    END IF;
  END LOOP;

  v_code := 'FS' || to_char(now(), 'YYMMDD')
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  INSERT INTO public.orders (
    code, user_id, category_id, brand_id, package_id,
    target, server, price, payment_method, total_amount, unique_code, status
  ) VALUES (
    v_code, v_user_id, p_category_id, p_brand_id, p_package_id,
    trim(p_target), nullif(trim(coalesce(p_server, '')), ''),
    v_price, p_payment_method, v_price + 500 + v_unique_code, v_unique_code, 'pending'
  ) RETURNING orders.id INTO v_order_id;

  RETURN QUERY
    SELECT o.id, o.code, o.price, o.total_amount, o.unique_code,
           o.payment_method, o.status, o.created_at
    FROM public.orders o WHERE o.id = v_order_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_topup_order(uuid, uuid, uuid, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_topup_order(uuid, uuid, uuid, text, text, text)
  TO authenticated;

-- Enforce a deliberate manual workflow:
-- pending -> processing means staff has checked the transfer and fulfillment starts;
-- processing -> success means fulfillment is actually complete;
-- pending/processing -> failed is allowed; success/failed are terminal.
DROP FUNCTION IF EXISTS public.admin_update_order_status(uuid, text);
CREATE FUNCTION public.admin_update_order_status(p_order_id uuid, p_status text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak: hanya admin/author yang dapat mengubah status pesanan.';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('pending', 'processing', 'success', 'failed') THEN
    RAISE EXCEPTION 'Status pesanan tidak valid.';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pesanan tidak ditemukan.';
  END IF;
  IF v_order.status = p_status THEN
    RETURN TRUE;
  END IF;
  IF v_order.status IN ('success', 'failed') THEN
    RAISE EXCEPTION 'Pesanan final tidak dapat diubah lagi. Periksa transaksi sebelum menghubungi dukungan.';
  END IF;
  IF v_order.status = 'pending' AND p_status = 'success' THEN
    RAISE EXCEPTION 'Verifikasi pembayaran dan mulai proses terlebih dahulu sebelum menandai berhasil.';
  END IF;
  IF v_order.status = 'processing' AND p_status = 'pending' THEN
    RAISE EXCEPTION 'Pesanan yang sudah diproses tidak dapat dikembalikan ke status menunggu.';
  END IF;

  IF v_order.status = 'pending' AND p_status = 'processing' THEN
    UPDATE public.orders
      SET status = p_status, payment_verified_at = now(), payment_verified_by = auth.uid()
      WHERE id = p_order_id;
  ELSIF v_order.status = 'processing' AND p_status = 'success' THEN
    UPDATE public.orders
      SET status = p_status, fulfillment_completed_at = now(), fulfillment_completed_by = auth.uid()
      WHERE id = p_order_id;
  ELSE
    UPDATE public.orders SET status = p_status WHERE id = p_order_id;
  END IF;
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_update_order_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_order_status(uuid, text) TO authenticated;
