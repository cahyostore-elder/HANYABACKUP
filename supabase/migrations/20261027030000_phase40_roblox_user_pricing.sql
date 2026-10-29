-- Phase 40: apply the Roblox Robux prices explicitly supplied by the store owner.
-- This migration is scoped to Roblox only and is idempotent by brand + package name.
INSERT INTO brands (slug, name, category_id, requires_server, server_label, sort_order)
SELECT 'roblox', 'Roblox', c.id, false, '', 28
FROM topup_categories c
WHERE c.slug = 'game'
ON CONFLICT (slug) DO NOTHING;

-- Update existing matching packages to the exact user-provided selling prices.
UPDATE packages p
SET price = v.price,
    description = 'Harga katalog FITYORA TOPUP — ditetapkan berdasarkan daftar harga yang diberikan pemilik toko.',
    sort_order = v.sort_order
FROM brands b
JOIN (VALUES
  ('50 Robux', 9500::numeric, 1),
  ('100 Robux', 18500::numeric, 2),
  ('200 Robux', 37000::numeric, 3),
  ('300 Robux', 55500::numeric, 4),
  ('400 Robux', 74000::numeric, 5),
  ('500 Robux', 92500::numeric, 6),
  ('1000 Robux', 185000::numeric, 7),
  ('1500 Robux', 277500::numeric, 8),
  ('2000 Robux', 370000::numeric, 9),
  ('2500 Robux', 462500::numeric, 10),
  ('5000 Robux', 904000::numeric, 11)
) AS v(name, price, sort_order) ON true
WHERE b.slug = 'roblox'
  AND p.brand_id = b.id
  AND lower(regexp_replace(p.name, '[[:space:]]+', ' ', 'g')) = lower(v.name);

-- Insert any missing Roblox package names without duplicating existing ones.
INSERT INTO packages (brand_id, name, description, price, sort_order, featured, provider_code)
SELECT b.id, v.name,
       'Harga katalog FITYORA TOPUP — ditetapkan berdasarkan daftar harga yang diberikan pemilik toko.',
       v.price, v.sort_order, false, ''
FROM brands b
JOIN (VALUES
  ('50 Robux', 9500::numeric, 1),
  ('100 Robux', 18500::numeric, 2),
  ('200 Robux', 37000::numeric, 3),
  ('300 Robux', 55500::numeric, 4),
  ('400 Robux', 74000::numeric, 5),
  ('500 Robux', 92500::numeric, 6),
  ('1000 Robux', 185000::numeric, 7),
  ('1500 Robux', 277500::numeric, 8),
  ('2000 Robux', 370000::numeric, 9),
  ('2500 Robux', 462500::numeric, 10),
  ('5000 Robux', 904000::numeric, 11)
) AS v(name, price, sort_order) ON true
WHERE b.slug = 'roblox'
  AND NOT EXISTS (
    SELECT 1 FROM packages p
    WHERE p.brand_id = b.id
      AND lower(regexp_replace(p.name, '[[:space:]]+', ' ', 'g')) = lower(v.name)
  );
