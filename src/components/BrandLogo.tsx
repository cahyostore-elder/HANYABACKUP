import { useEffect, useMemo, useState } from 'react';
import { brandGradient, initials } from '@/lib/format';
import { APP_ICON_SLUGS, getBrandAssetCandidates } from '@/lib/brandAssets';
import type { Brand } from '@/lib/supabase';

type Size = 'sm' | 'md' | 'lg';

const SIZE_CLASS: Record<Size, string> = {
  sm: 'w-10 h-10 rounded-lg text-xs',
  md: 'w-12 h-12 rounded-xl text-sm',
  lg: 'w-14 h-14 rounded-2xl text-base',
};

export default function BrandLogo({
  brand,
  size = 'md',
  className = '',
}: {
  brand: Brand;
  size?: Size;
  className?: string;
}) {
  const candidates = useMemo(
    () => getBrandAssetCandidates(brand.slug, brand.image_url),
    [brand.slug, brand.image_url],
  );
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [brand.slug, brand.image_url]);

  const currentImage = candidates[candidateIndex];
  const showImage = Boolean(currentImage);
  const isAppIcon = APP_ICON_SLUGS.has(brand.slug);

  return (
    <div
      className={`relative shrink-0 flex items-center justify-center overflow-hidden font-bold text-white ${SIZE_CLASS[size]} ${className}`}
      style={!showImage ? { background: brandGradient(brand.slug) } : { background: isAppIcon ? '#101828' : 'rgba(255,255,255,0.98)' }}
      title={brand.name}
    >
      {showImage ? (
        <img
          key={currentImage}
          src={currentImage}
          alt={`${brand.name} logo`}
          loading="lazy"
          decoding="async"
          className={isAppIcon ? 'absolute inset-0 w-full h-full object-cover' : 'w-[84%] h-[84%] object-contain'}
          onError={() => setCandidateIndex((index) => index + 1)}
        />
      ) : (
        <span aria-hidden="true">{initials(brand.name)}</span>
      )}
    </div>
  );
}
