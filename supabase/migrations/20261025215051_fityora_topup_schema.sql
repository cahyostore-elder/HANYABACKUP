/*
# FityoraStore Top-Up — Reschema

## Overview
Pivot the marketplace into a top-up website for:
- Game top-up (Mobile Legends, Free Fire, Genshin Impact, Valorant, PUBG, Higgs Domino)
- Pulsa all operators (Telkomsel, Indosat, XL, Axis, Tri, Smartfren)
- Token PLN (listrik prabayar)

## Changes
1. Drop old marketplace tables (categories, products, purchases, reviews, vip_memberships, increment_sales fn).
   Keep `profiles` (auth) and add `is_vip` already exists.
2. New tables:
   - `topup_categories` — jenis top-up: game / pulsa / pln (slug, label, icon, accent color).
   - `brands` — brand/operator: nama, slug, logo url, category_id.
   - `packages` — produk nominal: nama, harga, deskripsi, brand_id, server_label (opsional, untuk game), sort_order.
   - `orders` — pesanan: kode unik, user, category, brand, package, target (user_id server / nomor / id pelanggan), harga, status, created_at.
3. RLS:
   - categories/brands/packages: public read (anon + authenticated), no public write.
   - orders: authenticated read/insert own only.
4. Seed data:
   - 3 categories: game, pulsa, pln.
   - Brands for each.
   - Packages per brand (common denominations).

## Security
- `orders` only reachable by authenticated users; SELECT/INSERT scoped to own user_id.
- No UPDATE/DELETE granted (orders immutable once created).
- `profiles` unchanged; `is_vip` flag reused for loyalty perks.
*/

-- DROP OLD MARKETPLACE OBJECTS (user data in profiles is preserved)
DROP POLICY IF EXISTS "read_reviews" ON reviews;
DROP POLICY IF EXISTS "insert_own_reviews" ON reviews;
DROP POLICY IF EXISTS "update_own_reviews" ON reviews;
DROP POLICY IF EXISTS "delete_own_reviews" ON reviews;
DROP POLICY IF EXISTS "read_products" ON products;
DROP POLICY IF EXISTS "insert_own_products" ON products;
DROP POLICY IF EXISTS "update_own_products" ON products;
DROP POLICY IF EXISTS "delete_own_products" ON products;
DROP POLICY IF EXISTS "select_own_purchases" ON purchases;
DROP POLICY IF EXISTS "insert_own_purchases" ON purchases;
DROP POLICY IF EXISTS "author_view_own_product_purchases" ON purchases;
DROP POLICY IF EXISTS "read_categories" ON categories;
DROP POLICY IF EXISTS "select_own_vip" ON vip_memberships;
DROP POLICY IF EXISTS "insert_own_vip" ON vip_memberships;
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
DROP POLICY IF EXISTS "read_public_profile" ON profiles;

REVOKE EXECUTE ON FUNCTION increment_sales(uuid) FROM authenticated;
DROP FUNCTION IF EXISTS increment_sales(uuid);

DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS purchases CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS vip_memberships CASCADE;

-- Re-grant + re-policy profiles (auth-scoped)
GRANT SELECT, UPDATE ON profiles TO authenticated;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "read_public_profile" ON profiles FOR SELECT
  TO authenticated USING (true);

-- New: topup_categories
CREATE TABLE IF NOT EXISTS topup_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  icon text NOT NULL DEFAULT 'Gamepad2',
  accent text NOT NULL DEFAULT '#f5b301',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE topup_categories ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON topup_categories TO anon, authenticated;
CREATE POLICY "read_topup_categories" ON topup_categories FOR SELECT
  TO anon, authenticated USING (true);

-- New: brands
CREATE TABLE IF NOT EXISTS brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  category_id uuid NOT NULL REFERENCES topup_categories(id) ON DELETE CASCADE,
  image_url text DEFAULT '',
  requires_server boolean NOT NULL DEFAULT false,
  server_label text DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON brands TO anon, authenticated;
CREATE POLICY "read_brands" ON brands FOR SELECT
  TO anon, authenticated USING (true);

-- New: packages
CREATE TABLE IF NOT EXISTS packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  price numeric(10,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON packages TO anon, authenticated;
CREATE POLICY "read_packages" ON packages FOR SELECT
  TO anon, authenticated USING (true);

-- New: orders
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES topup_categories(id) ON DELETE RESTRICT,
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  package_id uuid NOT NULL REFERENCES packages(id) ON DELETE RESTRICT,
  target text NOT NULL,
  server text DEFAULT '',
  price numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','success','failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON orders TO authenticated;

CREATE POLICY "select_own_orders" ON orders FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_orders" ON orders FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- Auto-generate human-readable order code
CREATE OR REPLACE FUNCTION generate_order_code() RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  c text;
BEGIN
  c := 'FS' || to_char(now(), 'YYMMDD') || lpad(floor(random()*10000)::text, 4, '0');
  RETURN c;
END;
$$;
REVOKE EXECUTE ON FUNCTION generate_order_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION generate_order_code() TO authenticated;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_brands_category ON brands(category_id);
CREATE INDEX IF NOT EXISTS idx_packages_brand ON packages(brand_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

-- SEED: categories
INSERT INTO topup_categories (slug, label, icon, accent, sort_order) VALUES
  ('game', 'Top-Up Game', 'Gamepad2', '#f5b301', 1),
  ('pulsa', 'Pulsa & Paket Data', 'Smartphone', '#22d3ee', 2),
  ('pln', 'Token PLN', 'Zap', '#34d399', 3)
ON CONFLICT (slug) DO NOTHING;

-- SEED: brands (game)
INSERT INTO brands (slug, name, category_id, requires_server, server_label, sort_order) VALUES
  ('mobile-legends', 'Mobile Legends', (SELECT id FROM topup_categories WHERE slug='game'), true, 'Server ID', 1),
  ('free-fire', 'Free Fire', (SELECT id FROM topup_categories WHERE slug='game'), true, 'Server ID', 2),
  ('genshin-impact', 'Genshin Impact', (SELECT id FROM topup_categories WHERE slug='game'), false, '', 3),
  ('valorant', 'Valorant', (SELECT id FROM topup_categories WHERE slug='game'), false, '', 4),
  ('pubg-mobile', 'PUBG Mobile', (SELECT id FROM topup_categories WHERE slug='game'), false, '', 5),
  ('higgs-domino', 'Higgs Domino', (SELECT id FROM topup_categories WHERE slug='game'), false, '', 6)
ON CONFLICT (slug) DO NOTHING;

-- SEED: brands (pulsa)
INSERT INTO brands (slug, name, category_id, requires_server, server_label, sort_order) VALUES
  ('telkomsel', 'Telkomsel', (SELECT id FROM topup_categories WHERE slug='pulsa'), false, '', 1),
  ('indosat', 'Indosat IM3', (SELECT id FROM topup_categories WHERE slug='pulsa'), false, '', 2),
  ('xl', 'XL Axiata', (SELECT id FROM topup_categories WHERE slug='pulsa'), false, '', 3),
  ('axis', 'Axis', (SELECT id FROM topup_categories WHERE slug='pulsa'), false, '', 4),
  ('tri', 'Tri (3)', (SELECT id FROM topup_categories WHERE slug='pulsa'), false, '', 5),
  ('smartfren', 'Smartfren', (SELECT id FROM topup_categories WHERE slug='pulsa'), false, '', 6)
ON CONFLICT (slug) DO NOTHING;

-- SEED: brands (pln)
INSERT INTO brands (slug, name, category_id, requires_server, server_label, sort_order) VALUES
  ('pln-prabayar', 'PLN Prabayar', (SELECT id FROM topup_categories WHERE slug='pln'), false, '', 1)
ON CONFLICT (slug) DO NOTHING;

-- SEED: packages — Mobile Legends
INSERT INTO packages (brand_id, name, description, price, sort_order, featured) VALUES
  ((SELECT id FROM brands WHERE slug='mobile-legends'), '5 Diamonds', '', 1500, 1, false),
  ((SELECT id FROM brands WHERE slug='mobile-legends'), '12 Diamonds', '', 3500, 2, false),
  ((SELECT id FROM brands WHERE slug='mobile-legends'), '28 Diamonds', '', 7500, 3, false),
  ((SELECT id FROM brands WHERE slug='mobile-legends'), '59 Diamonds', '', 14500, 4, true),
  ((SELECT id FROM brands WHERE slug='mobile-legends'), '86 Diamonds', '', 21000, 5, false),
  ((SELECT id FROM brands WHERE slug='mobile-legends'), '172 Diamonds', '', 41500, 6, false),
  ((SELECT id FROM brands WHERE slug='mobile-legends'), '257 Diamonds', '', 62000, 7, false),
  ((SELECT id FROM brands WHERE slug='mobile-legends'), '344 Diamonds', '', 83000, 8, false),
  ((SELECT id FROM brands WHERE slug='mobile-legends'), '429 Diamonds', '', 103000, 9, false),
  ((SELECT id FROM brands WHERE slug='mobile-legends'), '514 Diamonds', '', 124000, 10, false),
  ((SELECT id FROM brands WHERE slug='mobile-legends'), 'Weekly Diamond Pass', '', 28000, 11, true),
  ((SELECT id FROM brands WHERE slug='mobile-legends'), 'Monthly Diamond Pass', '', 150000, 12, true)
ON CONFLICT DO NOTHING;

-- SEED: Free Fire
INSERT INTO packages (brand_id, name, description, price, sort_order, featured) VALUES
  ((SELECT id FROM brands WHERE slug='free-fire'), '5 Diamonds', '', 1000, 1, false),
  ((SELECT id FROM brands WHERE slug='free-fire'), '12 Diamonds', '', 2000, 2, false),
  ((SELECT id FROM brands WHERE slug='free-fire'), '50 Diamonds', '', 7000, 3, true),
  ((SELECT id FROM brands WHERE slug='free-fire'), '70 Diamonds', '', 10000, 4, false),
  ((SELECT id FROM brands WHERE slug='free-fire'), '140 Diamonds', '', 20000, 5, false),
  ((SELECT id FROM brands WHERE slug='free-fire'), '210 Diamonds', '', 29000, 6, false),
  ((SELECT id FROM brands WHERE slug='free-fire'), '355 Diamonds', '', 49000, 7, false),
  ((SELECT id FROM brands WHERE slug='free-fire'), '720 Diamonds', '', 99000, 8, false),
  ((SELECT id FROM brands WHERE slug='free-fire'), 'Membership Mingguan', '', 30000, 9, true)
ON CONFLICT DO NOTHING;

-- SEED: Genshin Impact
INSERT INTO packages (brand_id, name, description, price, sort_order, featured) VALUES
  ((SELECT id FROM brands WHERE slug='genshin-impact'), '60 Genesis Crystals', '', 16000, 1, false),
  ((SELECT id FROM brands WHERE slug='genshin-impact'), '300 + 30 Genesis Crystals', '', 79000, 2, true),
  ((SELECT id FROM brands WHERE slug='genshin-impact'), '980 + 110 Genesis Crystals', '', 249000, 3, false),
  ((SELECT id FROM brands WHERE slug='genshin-impact'), '1980 + 260 Genesis Crystals', '', 479000, 4, false),
  ((SELECT id FROM brands WHERE slug='genshin-impact'), '3280 + 600 Genesis Crystals', '', 799000, 5, false),
  ((SELECT id FROM brands WHERE slug='genshin-impact'), 'Blessing of the Welkin Moon', '', 79000, 6, true)
ON CONFLICT DO NOTHING;

-- SEED: Valorant
INSERT INTO packages (brand_id, name, description, price, sort_order, featured) VALUES
  ((SELECT id FROM brands WHERE slug='valorant'), '125 VP', '', 18000, 1, false),
  ((SELECT id FROM brands WHERE slug='valorant'), '420 VP', '', 55000, 2, true),
  ((SELECT id FROM brands WHERE slug='valorant'), '700 VP', '', 89000, 3, false),
  ((SELECT id FROM brands WHERE slug='valorant'), '1375 VP', '', 169000, 4, false),
  ((SELECT id FROM brands WHERE slug='valorant'), '2400 VP', '', 289000, 5, false),
  ((SELECT id FROM brands WHERE slug='valorant'), '4000 VP', '', 469000, 6, false)
ON CONFLICT DO NOTHING;

-- SEED: PUBG Mobile
INSERT INTO packages (brand_id, name, description, price, sort_order, featured) VALUES
  ((SELECT id FROM brands WHERE slug='pubg-mobile'), '60 UC', '', 15000, 1, false),
  ((SELECT id FROM brands WHERE slug='pubg-mobile'), '325 UC', '', 75000, 2, true),
  ((SELECT id FROM brands WHERE slug='pubg-mobile'), '660 UC', '', 149000, 3, false),
  ((SELECT id FROM brands WHERE slug='pubg-mobile'), '1800 UC', '', 369000, 4, false),
  ((SELECT id FROM brands WHERE slug='pubg-mobile'), '3850 UC', '', 749000, 5, false),
  ((SELECT id FROM brands WHERE slug='pubg-mobile'), 'Royale Pass (RP)', '', 145000, 6, true)
ON CONFLICT DO NOTHING;

-- SEED: Higgs Domino
INSERT INTO packages (brand_id, name, description, price, sort_order, featured) VALUES
  ((SELECT id FROM brands WHERE slug='higgs-domino'), '1M Coins', '', 5000, 1, false),
  ((SELECT id FROM brands WHERE slug='higgs-domino'), '5M Coins', '', 24000, 2, true),
  ((SELECT id FROM brands WHERE slug='higgs-domino'), '10M Coins', '', 48000, 3, false),
  ((SELECT id FROM brands WHERE slug='higgs-domino'), '50M Coins', '', 235000, 4, false),
  ((SELECT id FROM brands WHERE slug='higgs-domino'), '100M Coins', '', 469000, 5, false)
ON CONFLICT DO NOTHING;

-- SEED: Pulsa (each operator common denominations)
DO $$
DECLARE
  op record;
  denoms int[] := ARRAY[5000,10000,15000,20000,25000,30000,50000,75000,100000,150000,200000];
  d int;
  so int;
  v_id uuid;
BEGIN
  FOR op IN SELECT id, slug FROM brands WHERE category_id = (SELECT id FROM topup_categories WHERE slug='pulsa') LOOP
    so := 1;
    FOREACH d IN ARRAY denoms LOOP
      v_id := gen_random_uuid();
      INSERT INTO packages (id, brand_id, name, description, price, sort_order, featured)
      VALUES (v_id, op.id, 'Pulsa ' || d, '', d + 1500, so, d IN (50000, 100000));
      so := so + 1;
    END LOOP;
  END LOOP;
END $$;

-- SEED: PLN token
INSERT INTO packages (brand_id, name, description, price, sort_order, featured) VALUES
  ((SELECT id FROM brands WHERE slug='pln-prabayar'), 'Token 20.000', '', 21000, 1, false),
  ((SELECT id FROM brands WHERE slug='pln-prabayar'), 'Token 50.000', '', 51000, 2, true),
  ((SELECT id FROM brands WHERE slug='pln-prabayar'), 'Token 100.000', '', 101000, 3, true),
  ((SELECT id FROM brands WHERE slug='pln-prabayar'), 'Token 200.000', '', 201000, 4, false),
  ((SELECT id FROM brands WHERE slug='pln-prabayar'), 'Token 500.000', '', 501000, 5, false),
  ((SELECT id FROM brands WHERE slug='pln-prabayar'), 'Token 1.000.000', '', 1001000, 6, false)
ON CONFLICT DO NOTHING;

SELECT 'seeded' AS status;
