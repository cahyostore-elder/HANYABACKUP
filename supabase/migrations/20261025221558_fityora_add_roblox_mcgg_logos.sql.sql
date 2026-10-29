/*
-- FityoraStore — Add Roblox & MCGG games + online brand artwork
-- Remote artwork is sourced from App Store / public asset platforms. Avoid the retired Clearbit Logo API.

## New brands
- Roblox (slug: roblox) — Robux top-up
- Magic Chess Go Go (slug: magic-chess-go-go) — MCGG diamonds

## Security
- No schema changes. brands/packages already have public read policies.
  The admin INSERT policies added previously cover adding these rows.
- image_url is a public, read-only display field.
*/

-- Existing brands are updated again by 20261026010000_remote_brand_icons.sql.
-- Seed these rows with known working online asset hosts; the newer migration remains
-- responsible for the full operator/game icon set on both fresh and existing projects.
UPDATE brands SET image_url = 'https://is4-ssl.mzstatic.com/image/thumb/Purple116/v4/72/a0/16/72a0160b-4954-5314-2ab9-cad5c0a8ede8/source/512x512bb.jpg' WHERE slug = 'mobile-legends';
UPDATE brands SET image_url = 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/dc/bf/97/dcbf97dc-5ddd-b7ff-7412-6a90acec45be/AppIcon-1724779650-1x_U007emarketing-0-7-0-85-220-0.png/512x512bb.jpg' WHERE slug = 'free-fire';
UPDATE brands SET image_url = 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/d3/f5/2a/d3f52a60-8dd5-e433-226a-5468f9bcfd0f/AppIcon-0-0-1x_U007epad-0-1-85-220.png/512x512bb.png' WHERE slug = 'genshin-impact';
UPDATE brands SET image_url = 'https://www.citypng.com/public/uploads/preview/hd-valorant-official-logo-with-symbol-png-701751694788091hltdwppaqx.png?v=2026032705' WHERE slug = 'valorant';
UPDATE brands SET image_url = 'https://st.downzen.com/dzni/photos/pubg-mobile-iphone-430-f8ed8b.jpg' WHERE slug = 'pubg-mobile';
UPDATE brands SET image_url = '' WHERE slug = 'higgs-domino';

UPDATE brands SET image_url = 'https://zonalogo.com/assets/logo-telkomsel.webp?asset=1110' WHERE slug = 'telkomsel';
UPDATE brands SET image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Logo%20IM3.svg' WHERE slug = 'indosat';
UPDATE brands SET image_url = 'https://cdn.kibrispdr.org/data/111/download-logo-operator-seluler-indonesia-vector-26.png' WHERE slug = 'xl';
UPDATE brands SET image_url = 'https://assets.zonalogo.com/telecommunications/axis.co.id/logo-1773735618824-376.svg' WHERE slug = 'axis';
UPDATE brands SET image_url = 'https://zonalogo.com/assets/logo-tri-3.webp' WHERE slug = 'tri';
UPDATE brands SET image_url = 'https://101internet.id/cdn/shop/files/smartfren_grande.png?v=1672778229' WHERE slug = 'smartfren';
UPDATE brands SET image_url = 'https://zonalogo.com/assets/logo-pln.webp?asset=887' WHERE slug = 'pln-prabayar';

-- Add new game brands: Roblox and Magic Chess Go Go
INSERT INTO brands (slug, name, category_id, image_url, requires_server, server_label, sort_order) VALUES
  ('roblox', 'Roblox', (SELECT id FROM topup_categories WHERE slug='game'), 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/9e/e8/7d/9ee87de6-bc7f-11b8-6abe-4c5e1da495d1/AppIcon-0-0-1x_U007epad-0-1-0-85-220.png/512x512bb.jpg', false, '', 7),
  ('magic-chess-go-go', 'Magic Chess Go Go', (SELECT id FROM topup_categories WHERE slug='game'), 'https://cdn.donatov.net/cover/good-287-1767946519.webp', true, 'Server ID', 8)
ON CONFLICT (slug) DO UPDATE SET image_url = EXCLUDED.image_url;

-- Packages: Roblox (Robux)
INSERT INTO packages (brand_id, name, description, price, sort_order, featured) VALUES
  ((SELECT id FROM brands WHERE slug='roblox'), '80 Robux', '', 12000, 1, false),
  ((SELECT id FROM brands WHERE slug='roblox'), '400 Robux', '', 55000, 2, true),
  ((SELECT id FROM brands WHERE slug='roblox'), '800 Robux', '', 105000, 3, false),
  ((SELECT id FROM brands WHERE slug='roblox'), '1700 Robux', '', 210000, 4, false),
  ((SELECT id FROM brands WHERE slug='roblox'), '4500 Robux', '', 525000, 5, true),
  ((SELECT id FROM brands WHERE slug='roblox'), '10000 Robux', '', 1150000, 6, false)
ON CONFLICT DO NOTHING;

-- Packages: Magic Chess Go Go (MCGG)
INSERT INTO packages (brand_id, name, description, price, sort_order, featured) VALUES
  ((SELECT id FROM brands WHERE slug='magic-chess-go-go'), '50 Diamonds', '', 15000, 1, false),
  ((SELECT id FROM brands WHERE slug='magic-chess-go-go'), '150 Diamonds', '', 42000, 2, true),
  ((SELECT id FROM brands WHERE slug='magic-chess-go-go'), '300 Diamonds', '', 82000, 3, false),
  ((SELECT id FROM brands WHERE slug='magic-chess-go-go'), '500 Diamonds', '', 135000, 4, false),
  ((SELECT id FROM brands WHERE slug='magic-chess-go-go'), '1000 Diamonds', '', 265000, 5, true),
  ((SELECT id FROM brands WHERE slug='magic-chess-go-go'), 'Weekly Pass', '', 35000, 6, false)
ON CONFLICT DO NOTHING;

SELECT 'roblox + mcgg added, logos updated' AS status;
