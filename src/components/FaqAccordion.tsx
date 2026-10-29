import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { supabase, type Faq } from '@/lib/supabase';

export default function FaqAccordion() {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('faqs').select('*').order('sort_order');
      setFaqs((data as Faq[]) ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass rounded-2xl h-16 animate-pulse" />
        ))}
      </div>
    );
  }
  if (faqs.length === 0) return null;

  const categories = Array.from(new Set(faqs.map((f) => f.category)));

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex flex-wrap justify-center gap-2 mb-6">
        {categories.map((c) => (
          <span key={c} className="px-3 py-1 rounded-full glass-soft text-xs text-slate-300">
            {c}
          </span>
        ))}
      </div>
      <div className="space-y-3">
        {faqs.map((f, i) => {
          const isOpen = open === f.id;
          return (
            <div
              key={f.id}
              className="glass rounded-2xl overflow-hidden animate-fade-up"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <button
                onClick={() => setOpen(isOpen ? null : f.id)}
                className="w-full flex items-center justify-between gap-4 p-5 text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/20 shrink-0">
                    {f.category}
                  </span>
                  <span className="font-medium text-sm sm:text-base">{f.question}</span>
                </div>
                <ChevronDown
                  className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>
              <div
                className="grid transition-all duration-300"
                style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
              >
                <div className="overflow-hidden">
                  <p className="px-5 pb-5 text-sm text-slate-300 leading-relaxed">{f.answer}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
