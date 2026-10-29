-- FityoraStore live-project patch.
-- Review and back up before running. Does not delete existing user or order data.
-- This is also shipped as supabase/migrations/20261026020000_disable_vip_membership.sql.

-- FityoraStore: disable VIP membership while keeping historical data intact.
-- Safe to apply after reviewing the existing schema. No rows or tables are deleted.

-- Enforce staff-only management of catalogue/content tables. This also supports
-- create/edit actions in the Admin UI when only read policies previously existed.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'topup_categories', 'brands', 'packages',
    'promo_banners', 'testimonials', 'faqs'
  ] LOOP
    EXECUTE format(
      'REVOKE INSERT, UPDATE, DELETE ON TABLE public.%I FROM PUBLIC, anon, authenticated', t
    );
    EXECUTE format(
      'GRANT INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', t
    );
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS staff_manage_%I ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY staff_manage_%I ON public.%I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())',
      t, t
    );
  END LOOP;
END $$;

-- Remove old VIP marketing copy from public banners and testimonials without
-- deleting those content records. New generic copy keeps the homepage usable.
UPDATE public.promo_banners
SET title = 'Promo Top-Up Pilihan',
    subtitle = 'Temukan pilihan top-up game dan layanan favoritmu di FityoraStore.',
    cta_label = 'Lihat Katalog',
    cta_link = '#/topup/game'
WHERE concat_ws(' ', title, subtitle, cta_label, cta_link) ILIKE '%vip%';

UPDATE public.testimonials
SET message = 'Top-up game di FityoraStore praktis. Admin responsif dan siap membantu melalui WhatsApp.'
WHERE message ILIKE '%vip%';

-- Pricing is based only on the selected package price. VIP status is ignored.
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
  v_order_id uuid;
  v_code text;
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
    FROM public.brands b
    WHERE b.id = p_brand_id;
  IF NOT FOUND OR v_actual_category IS DISTINCT FROM p_category_id THEN
    RAISE EXCEPTION 'Brand tidak valid untuk kategori ini.';
  END IF;
  IF v_requires_server AND length(trim(coalesce(p_server, ''))) = 0 THEN
    RAISE EXCEPTION 'Server wajib diisi untuk brand ini.';
  END IF;

  SELECT p.price
    INTO v_price
    FROM public.packages p
    WHERE p.id = p_package_id AND p.brand_id = p_brand_id;
  IF NOT FOUND OR v_price IS NULL OR v_price < 0 THEN
    RAISE EXCEPTION 'Paket tidak valid.';
  END IF;

  v_code := 'FS' || to_char(now(), 'YYMMDD')
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  INSERT INTO public.orders (
    code, user_id, category_id, brand_id, package_id,
    target, server, price, payment_method,
    total_amount, unique_code, status
  )
  VALUES (
    v_code, v_user_id, p_category_id, p_brand_id, p_package_id,
    trim(p_target), nullif(trim(coalesce(p_server, '')), ''),
    v_price, p_payment_method, v_price + 500 + 225, 225, 'pending'
  )
  RETURNING orders.id INTO v_order_id;

  RETURN QUERY
    SELECT o.id, o.code, o.price, o.total_amount, o.unique_code,
           o.payment_method, o.status, o.created_at
    FROM public.orders o
    WHERE o.id = v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_topup_order(uuid, uuid, uuid, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_topup_order(uuid, uuid, uuid, text, text, text)
  TO authenticated;

-- Use SECURITY DEFINER for the guarded admin RPC because direct UPDATE access
-- to orders is intentionally revoked from browser clients. DROP first so this
-- patch is compatible with installations where the RPC previously returned
-- void rather than boolean.
DROP FUNCTION IF EXISTS public.admin_update_order_status(uuid, text);
CREATE FUNCTION public.admin_update_order_status(p_order_id uuid, p_status text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak: hanya admin/author yang dapat mengubah status pesanan.';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('pending', 'processing', 'success', 'failed') THEN
    RAISE EXCEPTION 'Status pesanan tidak valid.';
  END IF;

  UPDATE public.orders SET status = p_status WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pesanan tidak ditemukan.';
  END IF;
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_update_order_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_order_status(uuid, text) TO authenticated;

-- Stop creating or processing new VIP requests. Keep existing request/profile
-- columns for audit/history; do not delete customer transaction data.
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('create_vip_order', 'admin_update_vip_order')
  LOOP
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      fn.signature
    );
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
