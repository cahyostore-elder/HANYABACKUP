/**
 * Curated, remote brand artwork. Game/app art uses square high-resolution images;
 * operator logos use transparent/vector-friendly assets where available.
 *
 * These are intentionally remote URLs so the storefront can use sharp artwork
 * without bundling large duplicate raster images. Keep the UI fallback enabled
 * because remote hosts can occasionally rate-limit or change files.
 */
export const BRAND_ASSETS: Record<string, string[]> = {
  // Game/app icons: high-resolution assets discovered from App Store or icon platforms.
  'call-of-duty-mobile': [
    'https://is1-ssl.mzstatic.com/image/thumb/Purple126/v4/ce/8e/d7/ce8ed736-c2bd-2038-ddc4-313fb2ff7c02/AppIcon-1x_U007emarketing-0-9-0-85-220.png/512x512bb.jpg',
  ],
  'fc-mobile': [
    'https://cdn.now.gg/apps-content/com.ea.gp.fifamobile/icon/ea-sports-fc-mobile-24-soccer.png',
  ],
  'honor-of-kings': [
    'https://zenoapp.pro/img/Honor%20of%20Kings.png',
  ],
  'mobile-legends': [
    'https://is4-ssl.mzstatic.com/image/thumb/Purple116/v4/72/a0/16/72a0160b-4954-5314-2ab9-cad5c0a8ede8/source/512x512bb.jpg',
  ],
  'free-fire': [
    'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/dc/bf/97/dcbf97dc-5ddd-b7ff-7412-6a90acec45be/AppIcon-1724779650-1x_U007emarketing-0-7-0-85-220-0.png/512x512bb.jpg',
  ],
  'genshin-impact': [
    'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/d3/f5/2a/d3f52a60-8dd5-e433-226a-5468f9bcfd0f/AppIcon-0-0-1x_U007epad-0-1-85-220.png/512x512bb.png',
  ],
  valorant: [
    'https://www.citypng.com/public/uploads/preview/hd-valorant-official-logo-with-symbol-png-701751694788091hltdwppaqx.png?v=2026032705',
  ],
  'pubg-mobile': [
    'https://st.downzen.com/dzni/photos/pubg-mobile-iphone-430-f8ed8b.jpg',
  ],
  roblox: [
    'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/9e/e8/7d/9ee87de6-bc7f-11b8-6abe-4c5e1da495d1/AppIcon-0-0-1x_U007epad-0-1-0-85-220.png/512x512bb.jpg',
  ],
  'magic-chess-go-go': [
    'https://cdn.donatov.net/cover/good-287-1767946519.webp',
  ],
  'super-sus': [
    'https://img.utdstc.com/icon/65e/b62/65eb628ee83618ccbb3a55acf9a99539fe41095bb0329d9f0672d4df73dee2da%3A600',
  ],

  // Operator and utility logos: online asset hosts, with initials retained as fallback.
  telkomsel: ['https://zonalogo.com/assets/logo-telkomsel.webp?asset=1110'],
  indosat: ['https://commons.wikimedia.org/wiki/Special:FilePath/Logo%20IM3.svg'],
  xl: ['https://cdn.kibrispdr.org/data/111/download-logo-operator-seluler-indonesia-vector-26.png'],
  axis: ['https://assets.zonalogo.com/telecommunications/axis.co.id/logo-1773735618824-376.svg'],
  tri: ['https://zonalogo.com/assets/logo-tri-3.webp'],
  smartfren: ['https://101internet.id/cdn/shop/files/smartfren_grande.png?v=1672778229'],
  'pln-prabayar': ['https://zonalogo.com/assets/logo-pln.webp?asset=887'],
};

const isHttpUrl = (value: string) => /^https?:\/\//i.test(value);

/** Prefer an explicitly configured non-Clearbit URL, otherwise use our curated source. */
export function getBrandAssetCandidates(slug: string, databaseUrl?: string | null): string[] {
  const customUrl = (databaseUrl ?? '').trim();
  const isRetiredClearbit = /(^|\.)logo\.clearbit\.com\//i.test(customUrl.replace(/^https?:\/\//i, ''));
  const curated = BRAND_ASSETS[slug] ?? [];
  const candidates = [
    ...(customUrl && !isRetiredClearbit && isHttpUrl(customUrl) ? [customUrl] : []),
    ...curated,
  ];
  return [...new Set(candidates)];
}

/** App icons should fill the square; operator wordmarks should preserve their aspect ratio. */
export const APP_ICON_SLUGS = new Set([
  'call-of-duty-mobile', 'fc-mobile', 'honor-of-kings', 'mobile-legends', 'free-fire', 'genshin-impact', 'pubg-mobile', 'roblox',
  'magic-chess-go-go', 'super-sus',
]);
