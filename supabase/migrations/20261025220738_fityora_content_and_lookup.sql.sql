/*
# FityoraStore — Content tables + public order lookup

## Overview
Adds three public content tables (promos, testimonials, FAQs) plus a
SECURITY DEFINER function that lets anyone look up a single order by its
human-readable code without exposing the orders table to anon.

## New tables
1. `promo_banners` — homepage promo slider. Columns: title, subtitle, cta_label,
   cta_link, image_url, accent (hex), active, sort_order, created_at.
2. `testimonials` — customer reviews shown on homepage. Columns: name, role,
   avatar_url, rating (1-5), message, sort_order, created_at.
3. `faqs` — FAQ entries. Columns: question, answer, category, sort_order,
   created_at.

## New function
- `lookup_order(code text)` SECURITY DEFINER — returns a single row
  (code, status, total_amount, payment_method, brand_name, package_name,
   target, created_at) for a given order code. No user_id / email is
  returned. Callable by anon + authenticated so the order-status page works
  for guests. REVOKE from PUBLIC then GRANT to anon, authenticated.

## Security
- promo_banners / testimonials / faqs: public read (anon + authenticated),
  no public write. RLS enabled; SELECT only granted.
- `lookup_order` runs as the table owner and bypasses RLS intentionally so
  an unauthenticated visitor can look up an order by code. It returns only
  the minimal public-safe fields needed to render a status card. No PII
  beyond the target field (which the customer themselves typed in).
*/

-- ============ promo_banners ============
CREATE TABLE IF NOT EXISTS promo_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text DEFAULT '',
  cta_label text DEFAULT '',
  cta_link text DEFAULT '',
  image_url text DEFAULT '',
  accent text NOT NULL DEFAULT '#f5b301',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE promo_banners ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON promo_banners TO anon, authenticated;
DROP POLICY IF EXISTS "read_promo_banners" ON promo_banners;
CREATE POLICY "read_promo_banners" ON promo_banners FOR SELECT
  TO anon, authenticated USING (true);

-- ============ testimonials ============
CREATE TABLE IF NOT EXISTS testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text DEFAULT '',
  avatar_url text DEFAULT '',
  rating integer NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  message text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON testimonials TO anon, authenticated;
DROP POLICY IF EXISTS "read_testimonials" ON testimonials;
CREATE POLICY "read_testimonials" ON testimonials FOR SELECT
  TO anon, authenticated USING (true);

-- ============ faqs ============
CREATE TABLE IF NOT EXISTS faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  category text NOT NULL DEFAULT 'Umum',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON faqs TO anon, authenticated;
DROP POLICY IF EXISTS "read_faqs" ON faqs;
CREATE POLICY "read_faqs" ON faqs FOR SELECT
  TO anon, authenticated USING (true);

-- ============ lookup_order function ============
CREATE OR REPLACE FUNCTION lookup_order(code text)
RETURNS TABLE (
  o_code text,
  o_status text,
  o_total_amount numeric,
  o_payment_method text,
  o_brand_name text,
  o_package_name text,
  o_target text,
  o_created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.code,
    o.status,
    o.total_amount,
    o.payment_method,
    b.name,
    p.name,
    o.target,
    o.created_at
  FROM orders o
  LEFT JOIN brands b ON b.id = o.brand_id
  LEFT JOIN packages p ON p.id = o.package_id
  WHERE o.code = lookup_order.code
  LIMIT 1;
END;
$$;
REVOKE EXECUTE ON FUNCTION lookup_order(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION lookup_order(text) TO anon, authenticated;

-- ============ Seed: promo banners ============
INSERT INTO promo_banners (title, subtitle, cta_label, cta_link, image_url, accent, active, sort_order) VALUES
  ('Cashback 5% untuk Member VIP', 'Gabung VIP sekarang dan hemat di setiap transaksi top-up.', 'Lihat VIP', '#/vip', '', '#f5b301', true, 1),
  ('Top-Up Game Termurah', 'Mobile Legends, Free Fire, Genshin — harga bersaing, proses instan.', 'Top-Up Game', '#/topup/game', '', '#22d3ee', true, 2),
  ('Pulsa Semua Operator', 'Telkomsel, Indosat, XL, Axis, Tri, Smartfren — tanpa antri.', 'Beli Pulsa', '#/topup/pulsa', '', '#34d399', true, 3)
ON CONFLICT DO NOTHING;

-- ============ Seed: testimonials ============
INSERT INTO testimonials (name, role, avatar_url, rating, message, sort_order) VALUES
  ('Raka Pratama', 'Gamer', '', 5, 'Top-up Mobile Legends masuknya cuma hitungan detik. Pelayanan ramah, harga paling murah dibanding tempat lain.', 1),
  ('Siti Nuraini', 'Mahasiswa', '', 5, 'Beli pulsa dan token PLN jadi satu di sini. Praktis banget buat yang sibuk kayak aku. Recommended!', 2),
  ('Dimas Anggara', 'Streamer', '', 5, 'Sudah langganan VIP dan cashback-nya beneran works. Admin fast response di WhatsApp. Mantap FityoraStore.', 3),
  ('Putri Lestari', 'Ibu Rumah Tangga', '', 5, 'Beli token PLN dari rumah, langsung masuk. Gak perlu antri di gerai. Terima kasih!', 4),
  ('Bagus Wijaya', 'Gamer Kompetitif', '', 4, 'Prosesnya cepat dan aman. Semoga makin banyak promo game lainnya ke depan.', 5),
  ('Anisa Rahma', 'Pekerja Kantor', '', 5, 'Top-up Genshin Impact lancar tiap bulan. Harga fair, sistem terpercaya.', 6)
ON CONFLICT DO NOTHING;

-- ============ Seed: FAQs ============
INSERT INTO faqs (question, answer, category, sort_order) VALUES
  ('Berapa lama proses top-up?', 'Sebagian besar transaksi top-up diproses otomatis dalam hitungan detik setelah pembayaran dikonfirmasi. Untuk metode transfer manual, verifikasi membutuhkan 1–5 menit.', 'Transaksi', 1),
  ('Metode pembayaran apa saja yang didukung?', 'Kami menerima DANA, GoPay, OVO, ShopeePay, dan transfer bank SeaBank. Semua pembayaran dilengkapi kode unik untuk mempermudah verifikasi.', 'Pembayaran', 1),
  ('Apakah aman bertransaksi di FityoraStore?', 'Ya. Sistem pembayaran terenkripsi dan data akun kamu tidak disimpan. Kami hanya memerlukan User ID / nomor tujuan untuk memproses top-up.', 'Keamanan', 1),
  ('Bagaimana cara mengetahui status pesanan saya?', 'Kamu bisa mengecek status pesanan melalui halaman Cek Status Order di situs kami. Masukkan kode order yang kamu dapat setelah checkout.', 'Transaksi', 2),
  ('Apa keuntungan menjadi member VIP?', 'Member VIP mendapat cashback 5% setiap transaksi, diskon 10% khusus, prioritas antrian saat ramai, dan badge premium di profil.', 'VIP', 1),
  ('Bagaimana cara menghubungi admin?', 'Kamu bisa menghubungi admin via WhatsApp di 0813-9525-985, Telegram @fityoraa, atau email fityorastoreoffice@gmail.com. Tim kami siap membantu 24 jam.', 'Bantuan', 1),
  ('Apakah ada biaya tambahan saat top-up?', 'Terdapat biaya layanan Rp500 dan kode unik Rp225 yang ditambahkan ke total pembayaran. Kode unik digunakan untuk verifikasi otomatis transfermu.', 'Pembayaran', 2),
  ('Bagaimana jika top-up saya gagal?', 'Jika transaksi gagal, dana akan dikembalikan otomatis atau dapat dikoordinasikan via WhatsApp admin. Sertakan kode order agar proses lebih cepat.', 'Transaksi', 3)
ON CONFLICT DO NOTHING;

SELECT 'seeded' AS status;
