import { Star, Quote } from 'lucide-react';
import { supabase, type Testimonial } from '@/lib/supabase';
import { avatarGradient, initials } from '@/lib/format';
import { useEffect, useState } from 'react';

export default function Testimonials() {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('testimonials').select('*').order('sort_order');
      setItems((data as Testimonial[]) ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="glass rounded-2xl p-6 h-48 animate-pulse" />
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return <div className="glass rounded-2xl p-6 text-center text-sm text-slate-400">Belum ada ulasan pelanggan yang dipublikasikan.</div>;
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((t, i) => (
        <div
          key={t.id}
          className="glass rounded-2xl p-6 card-hover animate-fade-up relative overflow-hidden"
          style={{ animationDelay: `${i * 0.08}s` }}
        >
          <Quote className="absolute -top-2 -right-2 w-16 h-16 text-white/5" />
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-white text-sm shrink-0"
              style={{ background: avatarGradient(t.name) }}
            >
              {initials(t.name)}
            </div>
            <div className="min-w-0">
              <div className="font-display font-semibold truncate">{t.name}</div>
              <div className="text-xs text-slate-400 truncate">{t.role}</div>
            </div>
          </div>
          <div className="flex gap-0.5 mb-2.5">
            {Array.from({ length: 5 }).map((_, s) => (
              <Star
                key={s}
                className={`w-3.5 h-3.5 ${s < t.rating ? 'text-amber-400' : 'text-white/15'}`}
                fill="currentColor"
              />
            ))}
          </div>
          <p className="text-sm text-slate-300 leading-relaxed relative">{t.message}</p>
        </div>
      ))}
    </div>
  );
}
