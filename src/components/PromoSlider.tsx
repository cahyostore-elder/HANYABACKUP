import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase, type PromoBanner } from '@/lib/supabase';
import { useRoute } from '@/lib/router';
import { parsePromoDestination } from '@/lib/promoDestination.mjs';

export default function PromoSlider() {
  const { navigate } = useRoute();
  const [banners, setBanners] = useState<PromoBanner[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [ctaFeedback, setCtaFeedback] = useState('');

  const loadBanners = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const { data, error } = await supabase
        .from('promo_banners')
        .select('*')
        .eq('active', true)
        .order('sort_order');
      if (error) throw error;
      if (!data) throw new Error('Data promo tidak tersedia.');
      setBanners((data as PromoBanner[]) ?? []);
      setIndex(0);
      setCtaFeedback('');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Koneksi promo gagal.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadBanners(); }, [loadBanners]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % banners.length);
      setCtaFeedback('');
    }, 5000);
    return () => clearInterval(t);
  }, [banners.length]);

  if (loading) {
    return <div className="h-40 sm:h-52 rounded-3xl glass animate-pulse" />;
  }
  if (loadError) {
    return (
      <div className="rounded-3xl glass border border-white/10 px-5 py-6 text-center" role="status">
        <p className="text-sm text-slate-300">Banner promo belum dapat dimuat.</p>
        <p className="mt-1 text-xs text-slate-500">{loadError}</p>
        <button type="button" onClick={() => void loadBanners()} className="btn-ghost mt-3 rounded-lg px-4 py-2 text-sm">Coba lagi</button>
      </div>
    );
  }
  if (banners.length === 0) return null;

  const go = (delta: number) => {
    setCtaFeedback('');
    setIndex((i) => (i + delta + banners.length) % banners.length);
  };

  const handleCta = (link: string) => {
    const destination = parsePromoDestination(link);
    if (!destination) {
      setCtaFeedback('Tautan promo tidak valid atau tidak aman. Hubungi admin toko.');
      return;
    }

    setCtaFeedback('');
    if (destination.type === 'internal') {
      navigate(destination.href);
      return;
    }

    // With `noopener`, browsers may intentionally return `null` even when the tab opened.
    // Do not misreport that normal security behavior as a blocked popup.
    window.open(destination.href, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="relative rounded-3xl overflow-hidden h-44 sm:h-56 group">
      {banners.map((b, i) => (
        <div
          key={b.id}
          className="absolute inset-0 transition-opacity duration-700"
          style={{ opacity: i === index ? 1 : 0 }}
        >
          <div className="absolute inset-0 gradient-pan" style={{ background: `linear-gradient(120deg, ${b.accent}22, ${b.accent}06 40%, ${b.accent}22)` }} />
          <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full blur-3xl opacity-40" style={{ background: b.accent }} />
          <div className="absolute inset-0 gold-border rounded-3xl" />
          <div className="relative h-full flex flex-col justify-center px-7 sm:px-10">
            <div className="inline-flex w-fit items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium mb-2" style={{ background: `${b.accent}22`, color: b.accent }}>
              Promo
            </div>
            <h3 className="font-display text-xl sm:text-2xl font-bold max-w-md leading-tight">{b.title}</h3>
            {b.subtitle && <p className="text-sm text-slate-300 mt-1.5 max-w-lg">{b.subtitle}</p>}
            {b.cta_label && (
              <button
                onClick={() => handleCta(b.cta_link)}
                className="mt-4 w-fit inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg transition hover:scale-[1.02]"
                style={{ background: `${b.accent}22`, color: b.accent, border: `1px solid ${b.accent}55` }}
              >
                {b.cta_label} <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            {ctaFeedback && i === index && <p role="status" className="mt-2 max-w-md text-xs text-rose-200">{ctaFeedback}</p>}
          </div>
        </div>
      ))}

      {banners.length > 1 && (
        <>
          <button
            onClick={() => go(-1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full glass-soft flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition"
            aria-label="Sebelumnya"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => go(1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full glass-soft flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition"
            aria-label="Berikutnya"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => { setCtaFeedback(''); setIndex(i); }}
                className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-amber-400' : 'w-1.5 bg-white/30'}`}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
