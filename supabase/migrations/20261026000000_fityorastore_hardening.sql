-- FityoraStore hardening and manual-payment workflow.
-- Existing payment destinations and the Virtual Account maintenance state are unchanged.

-- Prevent members from editing their own role/VIP flag through the profiles table.
REVOKE UPDATE ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT UPDATE (display_name, bio, avatar_url) ON TABLE public.profiles TO authenticated;
-- Let members create only a safe profile row; role and VIP columns retain database defaults.
REVOKE INSERT ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT INSERT (id, display_name, bio, avatar_url) ON TABLE public.profiles TO authenticated;
DROP POLICY IF EXISTS insert_own_profile ON public.profiles;
CREATE POLICY insert_own_profile ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Staff-only catalogue/content management policies used by AdminPage.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['topup_categories', 'brands', 'packages', 'promo_banners', 'testimonials', 'faqs'] LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON TABLE public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', t);
    EXECUTE format('DROP POLICY IF EXISTS staff_manage_%I ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY staff_manage_%I ON public.%I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())',
      t, t
    );
  END LOOP;
END $$;

-- Members can read their own orders; store staff can see all orders.
DROP POLICY IF EXISTS staff_read_orders ON public.orders;
CREATE POLICY staff_read_orders ON public.orders
  FOR SELECT TO authenticated USING (public.is_admin());

-- No direct INSERT/UPDATE from a browser: creation and status changes go through guarded RPCs.
DROP POLICY IF EXISTS update_own_orders ON public.orders;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.orders FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.orders TO authenticated;

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
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_actual_category uuid;
  v_requires_server boolean;
  v_price numeric(10,2);
  v_is_vip boolean := false;
  v_order_id uuid;
  v_code text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Silakan masuk sebelum membuat pesanan.';
  END IF;
  IF length(trim(coalesce(p_target, ''))) = 0 THEN
    RAISE EXCEPTION 'Tujuan top-up wajib diisi.';
  END IF;
  IF p_payment_method NOT IN ('dana', 'gopay', 'ovo', 'shopeepay', 'seabank', 'qris') THEN
    RAISE EXCEPTION 'Metode pembayaran tidak tersedia.';
  END IF;

  SELECT b.category_id, b.requires_server
    INTO v_actual_category, v_requires_server
    FROM public.brands b WHERE b.id = p_brand_id;
  IF NOT FOUND OR v_actual_category <> p_category_id THEN
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

  SELECT coalesce(pr.is_vip, false) AND
         (pr.vip_expires_at IS NULL OR pr.vip_expires_at > now())
    INTO v_is_vip
    FROM public.profiles pr WHERE pr.id = v_user_id;
  v_is_vip := coalesce(v_is_vip, false);
  IF v_is_vip THEN
    v_price := round(v_price * 0.9, 0);
  END IF;

  v_code := 'FS' || to_char(now(), 'YYMMDD') || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  INSERT INTO public.orders (
    code, user_id, category_id, brand_id, package_id, target, server,
    price, payment_method, total_amount, unique_code, status
  ) VALUES (
    v_code, v_user_id, p_category_id, p_brand_id, p_package_id, trim(p_target),
    trim(coalesce(p_server, '')), v_price, p_payment_method, v_price + 500 + 225, 225, 'pending'
  ) RETURNING orders.id INTO v_order_id;

  RETURN QUERY
    SELECT o.id, o.code, o.price, o.total_amount, o.unique_code,
           o.payment_method, o.status, o.created_at
    FROM public.orders o WHERE o.id = v_order_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_topup_order(uuid, uuid, uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_topup_order(uuid, uuid, uuid, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_order_status(p_order_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Hanya admin/staf toko yang dapat mengubah status pesanan.';
  END IF;
  IF p_status NOT IN ('pending', 'processing', 'success', 'failed') THEN
    RAISE EXCEPTION 'Status pesanan tidak valid.';
  END IF;
  UPDATE public.orders SET status = p_status WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pesanan tidak ditemukan.';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_update_order_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_order_status(uuid, text) TO authenticated;

-- Persistent VIP requests, activated only by staff after payment verification.
CREATE TABLE IF NOT EXISTS public.vip_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id text NOT NULL CHECK (plan_id IN ('monthly', 'yearly', 'lifetime')),
  plan_name text NOT NULL,
  price numeric(10,2) NOT NULL CHECK (price >= 0),
  duration_days integer CHECK (duration_days IS NULL OR duration_days > 0),
  payment_method text NOT NULL CHECK (payment_method IN ('dana', 'gopay', 'ovo', 'shopeepay', 'seabank', 'qris')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.vip_orders ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.vip_orders FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.vip_orders TO authenticated;
DROP POLICY IF EXISTS select_own_vip_orders ON public.vip_orders;
CREATE POLICY select_own_vip_orders ON public.vip_orders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS staff_read_vip_orders ON public.vip_orders;
CREATE POLICY staff_read_vip_orders ON public.vip_orders
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE INDEX IF NOT EXISTS idx_vip_orders_user_created ON public.vip_orders(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.create_vip_order(p_plan_id text, p_payment_method text)
RETURNS TABLE (id uuid, code text, plan_id text, plan_name text, price numeric, duration_days integer, payment_method text, status text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_plan_name text;
  v_price numeric(10,2);
  v_duration integer;
  v_code text;
  v_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Silakan masuk untuk mengajukan VIP.';
  END IF;
  IF p_payment_method NOT IN ('dana', 'gopay', 'ovo', 'shopeepay', 'seabank', 'qris') THEN
    RAISE EXCEPTION 'Metode pembayaran tidak tersedia.';
  END IF;
  CASE p_plan_id
    WHEN 'monthly' THEN v_plan_name := 'Monthly'; v_price := 25000; v_duration := 30;
    WHEN 'yearly' THEN v_plan_name := 'Yearly'; v_price := 199000; v_duration := 365;
    WHEN 'lifetime' THEN v_plan_name := 'Lifetime'; v_price := 499000; v_duration := NULL;
    ELSE RAISE EXCEPTION 'Paket VIP tidak valid.';
  END CASE;
  v_code := 'FV' || to_char(now(), 'YYMMDD') || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  INSERT INTO public.vip_orders (code, user_id, plan_id, plan_name, price, duration_days, payment_method)
    VALUES (v_code, v_user_id, p_plan_id, v_plan_name, v_price, v_duration, p_payment_method)
    RETURNING vip_orders.id INTO v_id;
  RETURN QUERY SELECT vo.id, vo.code, vo.plan_id, vo.plan_name, vo.price,
                      vo.duration_days, vo.payment_method, vo.status, vo.created_at
    FROM public.vip_orders vo WHERE vo.id = v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_vip_order(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_vip_order(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_vip_order(p_order_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.vip_orders%ROWTYPE;
  v_current_expiry timestamptz;
  v_current_is_vip boolean := false;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Hanya admin/staf toko yang dapat memproses permintaan VIP.';
  END IF;
  IF p_status NOT IN ('pending', 'processing', 'success', 'failed') THEN
    RAISE EXCEPTION 'Status permintaan VIP tidak valid.';
  END IF;
  SELECT * INTO v_order FROM public.vip_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Permintaan VIP tidak ditemukan.';
  END IF;
  IF v_order.status = 'success' AND p_status <> 'success' THEN
    RAISE EXCEPTION 'Permintaan VIP yang sudah aktif tidak dapat dibatalkan lewat perubahan status.';
  END IF;

  UPDATE public.vip_orders
    SET status = p_status, processed_at = now(), processed_by = auth.uid()
    WHERE id = p_order_id;

  IF p_status = 'success' AND v_order.status <> 'success' THEN
    SELECT is_vip, vip_expires_at INTO v_current_is_vip, v_current_expiry
      FROM public.profiles WHERE id = v_order.user_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Profil pengguna tidak ditemukan; VIP belum dapat diaktifkan.';
    END IF;

    IF v_order.duration_days IS NULL THEN
      -- Lifetime is stored as a VIP membership without an expiry timestamp.
      UPDATE public.profiles SET is_vip = true, vip_expires_at = NULL WHERE id = v_order.user_id;
    ELSE
      -- Do not shorten an existing lifetime membership when a shorter plan is purchased.
      IF coalesce(v_current_is_vip, false) AND v_current_expiry IS NULL THEN
        UPDATE public.profiles SET is_vip = true, vip_expires_at = NULL WHERE id = v_order.user_id;
      ELSE
        UPDATE public.profiles
          SET is_vip = true,
              vip_expires_at = greatest(coalesce(v_current_expiry, now()), now()) + (v_order.duration_days * interval '1 day')
          WHERE id = v_order.user_id;
      END IF;
    END IF;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_update_vip_order(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_vip_order(uuid, text) TO authenticated;

-- Keep writes to role/is_vip controlled by the database workflow, not by member profile edits.


-- Replace seeded marketing statements that described unimplemented automatic fulfilment/cashback.
UPDATE public.promo_banners
  SET title = 'Diskon 10% untuk Member VIP',
      subtitle = 'Ajukan VIP dan nikmati diskon top-up setelah pembayaran diverifikasi admin.'
  WHERE title = 'Cashback 5% untuk Member VIP';

UPDATE public.promo_banners
  SET title = 'Top-Up Game',
      subtitle = 'Pilih nominal yang tersedia, bayar sesuai total, lalu tunggu verifikasi admin.'
  WHERE title = 'Top-Up Game Termurah';
UPDATE public.promo_banners
  SET title = 'Pulsa & Paket Data',
      subtitle = 'Pilih operator dan nominal, lalu konfirmasi pembayaran melalui WhatsApp admin.'
  WHERE title = 'Pulsa Semua Operator';

UPDATE public.faqs
  SET answer = 'Pesanan baru diproses setelah pembayaran dikonfirmasi dan status diperbarui admin. Waktu penyelesaian bergantung pada metode pembayaran dan layanan yang dipilih.'
  WHERE question = 'Berapa lama proses top-up?';
UPDATE public.faqs
  SET answer = 'Metode pembayaran aktif: DANA, GoPay, OVO, ShopeePay, QRIS, dan transfer SeaBank. Virtual Account sedang dalam maintenance. Simpan kode order dan konfirmasi pembayaran ke admin.'
  WHERE question = 'Metode pembayaran apa saja yang didukung?';
UPDATE public.faqs
  SET answer = 'Member VIP yang aktif mendapat diskon 10% untuk top-up yang memenuhi syarat dan badge VIP di profil. Keanggotaan hanya aktif atau diperpanjang setelah pembayaran diverifikasi admin.'
  WHERE question = 'Apa keuntungan menjadi member VIP?';
UPDATE public.faqs
  SET answer = 'Biaya layanan Rp500 dan kode unik Rp225 ditambahkan ke total pembayaran top-up. Nominal akhir ditampilkan sebelum order dibuat; transfer harus sesuai nominal tersebut.'
  WHERE question = 'Apakah ada biaya tambahan saat top-up?';
UPDATE public.faqs
  SET answer = 'Jika pesanan gagal, hubungi admin dengan menyertakan kode order dan bukti pembayaran untuk pemeriksaan serta penyelesaian manual.'
  WHERE question = 'Bagaimana jika top-up saya gagal?';

UPDATE public.faqs
  SET answer = 'Gunakan situs ini hanya melalui alamat resmi toko, simpan kode order, dan jangan bagikan kata sandi atau kode OTP kepada siapa pun. Pembayaran dan pengiriman layanan diperiksa secara manual oleh admin.'
  WHERE question = 'Apakah aman bertransaksi di FityoraStore?';
UPDATE public.faqs
  SET answer = 'Hubungi admin melalui WhatsApp, Telegram, atau email yang tercantum di situs. Waktu respons bisa bervariasi, terutama saat antrean ramai.'
  WHERE question = 'Bagaimana cara menghubungi admin?';

-- The migration template included placeholder testimonials. Remove only untouched seed rows;
-- any testimonials the store owner edited or replaced are retained.
DELETE FROM public.testimonials
WHERE (name, message) IN (
  ('Raka Pratama', 'Top-up Mobile Legends masuknya cuma hitungan detik. Pelayanan ramah, harga paling murah dibanding tempat lain.'),
  ('Siti Nuraini', 'Beli pulsa dan token PLN jadi satu di sini. Praktis banget buat yang sibuk kayak aku. Recommended!'),
  ('Dimas Anggara', 'Sudah langganan VIP dan cashback-nya beneran works. Admin fast response di WhatsApp. Mantap FityoraStore.'),
  ('Putri Lestari', 'Beli token PLN dari rumah, langsung masuk. Gak perlu antri di gerai. Terima kasih!'),
  ('Bagus Wijaya', 'Prosesnya cepat dan aman. Semoga makin banyak promo game lainnya ke depan.'),
  ('Anisa Rahma', 'Top-up Genshin Impact lancar tiap bulan. Harga fair, sistem terpercaya.')
);
