-- FityoraStore: replace retired Clearbit links with online-hosted high-resolution assets.
-- No payment methods, payment account details, QRIS files, or maintenance flags are modified.
UPDATE public.brands AS b
SET image_url = v.image_url
FROM (VALUES
  ('mobile-legends', 'https://is4-ssl.mzstatic.com/image/thumb/Purple116/v4/72/a0/16/72a0160b-4954-5314-2ab9-cad5c0a8ede8/source/512x512bb.jpg'),
  ('free-fire', 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/dc/bf/97/dcbf97dc-5ddd-b7ff-7412-6a90acec45be/AppIcon-1724779650-1x_U007emarketing-0-7-0-85-220-0.png/512x512bb.jpg'),
  ('genshin-impact', 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/d3/f5/2a/d3f52a60-8dd5-e433-226a-5468f9bcfd0f/AppIcon-0-0-1x_U007epad-0-1-85-220.png/512x512bb.png'),
  ('valorant', 'https://www.citypng.com/public/uploads/preview/hd-valorant-official-logo-with-symbol-png-701751694788091hltdwppaqx.png?v=2026032705'),
  ('pubg-mobile', 'https://st.downzen.com/dzni/photos/pubg-mobile-iphone-430-f8ed8b.jpg'),
  ('roblox', 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/9e/e8/7d/9ee87de6-bc7f-11b8-6abe-4c5e1da495d1/AppIcon-0-0-1x_U007epad-0-1-0-85-220.png/512x512bb.jpg'),
  ('magic-chess-go-go', 'https://cdn.donatov.net/cover/good-287-1767946519.webp'),
  ('super-sus', 'https://img.utdstc.com/icon/65e/b62/65eb628ee83618ccbb3a55acf9a99539fe41095bb0329d9f0672d4df73dee2da%3A600'),
  ('telkomsel', 'https://zonalogo.com/assets/logo-telkomsel.webp?asset=1110'),
  ('indosat', 'https://commons.wikimedia.org/wiki/Special:FilePath/Logo%20IM3.svg'),
  ('xl', 'https://cdn.kibrispdr.org/data/111/download-logo-operator-seluler-indonesia-vector-26.png'),
  ('axis', 'https://assets.zonalogo.com/telecommunications/axis.co.id/logo-1773735618824-376.svg'),
  ('tri', 'https://zonalogo.com/assets/logo-tri-3.webp'),
  ('smartfren', 'https://101internet.id/cdn/shop/files/smartfren_grande.png?v=1672778229'),
  ('pln-prabayar', 'https://zonalogo.com/assets/logo-pln.webp?asset=887')
) AS v(slug, image_url)
WHERE b.slug = v.slug;

-- Clear retired Clearbit URLs even for brands without a curated remote icon.
-- BrandLogo then shows a clean, readable initial fallback instead of a broken image.
UPDATE public.brands
SET image_url = ''
WHERE image_url ILIKE 'https://logo.clearbit.com/%'
  AND slug NOT IN (
    'mobile-legends', 'free-fire', 'genshin-impact', 'valorant', 'pubg-mobile',
    'roblox', 'magic-chess-go-go', 'super-sus', 'telkomsel', 'indosat', 'xl',
    'axis', 'tri', 'smartfren', 'pln-prabayar'
  );
