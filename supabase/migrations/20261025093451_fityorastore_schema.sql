/*
# FityoraStore — Initial Schema

## Overview
FityoraStore is a premium digital products marketplace. Members browse, buy, review
products, and can become VIP. Authors publish and manage their own products and view stats.

## New Tables
1. `profiles` — extends auth.users (display name, bio, avatar, role, vip flag, vip expiry).
2. `categories` — product categories (name, slug, icon).
3. `products` — digital products (title, description, price, image, file, category, author).
4. `purchases` — purchase records (user, product, price, created_at).
5. `reviews` — member reviews (rating 1-5, comment).
6. `vip_memberships` — VIP records (user, plan, started/expires).

## Security
- RLS on every table.
- profiles: a user reads/updates own; also public read so author names show on products.
- categories: public read.
- products: public read; authors insert/update/delete own.
- purchases: user reads/inserts own; authors read purchases of their own products (stats).
- reviews: public read; authenticated insert/update/delete own.
- vip_memberships: user reads/inserts own.
*/

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  bio text DEFAULT '',
  avatar_url text DEFAULT '',
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member','author','admin')),
  is_vip boolean NOT NULL DEFAULT false,
  vip_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE ON profiles TO authenticated;

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "read_public_profile" ON profiles;
CREATE POLICY "read_public_profile" ON profiles FOR SELECT
  TO authenticated USING (true);

-- CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  icon text NOT NULL DEFAULT 'Package',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON categories TO anon, authenticated;

DROP POLICY IF EXISTS "read_categories" ON categories;
CREATE POLICY "read_categories" ON categories FOR SELECT
  TO anon, authenticated USING (true);

-- PRODUCTS
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  price numeric(10,2) NOT NULL DEFAULT 0,
  image_url text DEFAULT '',
  file_url text DEFAULT '',
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  featured boolean NOT NULL DEFAULT false,
  sales_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON products TO authenticated;

DROP POLICY IF EXISTS "read_products" ON products;
CREATE POLICY "read_products" ON products FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_products" ON products;
CREATE POLICY "insert_own_products" ON products FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "update_own_products" ON products;
CREATE POLICY "update_own_products" ON products FOR UPDATE
  TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "delete_own_products" ON products;
CREATE POLICY "delete_own_products" ON products FOR DELETE
  TO authenticated USING (auth.uid() = author_id);

-- PURCHASES
CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price_paid numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON purchases TO authenticated;

DROP POLICY IF EXISTS "select_own_purchases" ON purchases;
CREATE POLICY "select_own_purchases" ON purchases FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_purchases" ON purchases;
CREATE POLICY "insert_own_purchases" ON purchases FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "author_view_own_product_purchases" ON purchases;
CREATE POLICY "author_view_own_product_purchases" ON purchases FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM products p WHERE p.id = purchases.product_id AND p.author_id = auth.uid())
  );

-- REVIEWS
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON reviews TO authenticated;

DROP POLICY IF EXISTS "read_reviews" ON reviews;
CREATE POLICY "read_reviews" ON reviews FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_reviews" ON reviews;
CREATE POLICY "insert_own_reviews" ON reviews FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_reviews" ON reviews;
CREATE POLICY "update_own_reviews" ON reviews FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_reviews" ON reviews;
CREATE POLICY "delete_own_reviews" ON reviews FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- VIP MEMBERSHIPS
CREATE TABLE IF NOT EXISTS vip_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'monthly' CHECK (plan IN ('monthly','yearly','lifetime')),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vip_memberships ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON vip_memberships TO authenticated;

DROP POLICY IF EXISTS "select_own_vip" ON vip_memberships;
CREATE POLICY "select_own_vip" ON vip_memberships FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_vip" ON vip_memberships;
CREATE POLICY "insert_own_vip" ON vip_memberships FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_author ON products(author_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_product ON purchases(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_vip_user ON vip_memberships(user_id);
