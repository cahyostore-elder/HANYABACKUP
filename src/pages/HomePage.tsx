import { useEffect, useState } from 'react';
import {
  Zap, Gamepad2, Smartphone, ArrowRight, ShieldCheck, Clock, Headphones, Sparkles, Flame, Mail, MessageCircle, Send, Search, RotateCcw, UserRound,
} from 'lucide-react';
import { supabase, supabaseConfigured, type TopupCategory, type Brand } from '@/lib/supabase';
import { useRoute } from '@/lib/router';
import { useAuth } from '@/context/AuthContext';
import BrandLogo from '@/components/BrandLogo';
import { STORE_CONTACT } from '@/lib/contact';
import PromoSlider from '@/components/PromoSlider';
import PaymentMethodsSection from '@/components/PaymentMethodsSection';
import Testimonials from '@/components/Testimonials';
import FaqAccordion from '@/components/FaqAccordion';

export default function HomePage() {
  const { navigate } = useRoute();
  const { session, profile } = useAuth();
  const [categories, setCategories] = useState<TopupCategory[]>([]);
  const [gameBrands, setGameBrands] = useState<Brand[]>([]);
  const [pulsaBrands, setPulsaBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [gameSearch, setGameSearch] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setCatalogError('');
      try {
        const cats = await supabase
          .from('topup_categories')
          .select('*')
          .order('sort_order')
          .abortSignal(AbortSignal.timeout(12000));
        if (cats.error) throw cats.error;
        const categoryRows = (cats.data as TopupCategory[]) ?? [];
        const gameCategory = categoryRows.find((item) => item.slug === 'game');
        const pulsaCategory = categoryRows.find((item) => item.slug === 'pulsa');
        const [games, pulsa] = await Promise.all([
          gameCategory
            ? supabase.from('brands').select('*').eq('category_id', gameCategory.id).order('sort_order').abortSignal(AbortSignal.timeout(12000))
            : Promise.resolve({ data: [], error: null }),
          pulsaCategory
            ? supabase.from('brands').select('*').eq('category_id', pulsaCategory.id).order('sort_order').abortSignal(AbortSignal.timeout(12000))
            : Promise.resolve({ data: [], error: null }),
        ]);
        if (games.error) throw games.error;
        if (pulsa.error) throw pulsa.error;
        if (!active) return;
        setCategories(categoryRows);
        setGameBrands((games.data as Brand[]) ?? []);
        setPulsaBrands((pulsa.data as Brand[]) ?? []);
      } catch (error) {
        if (active) {
          const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
          setCatalogError(timedOut
            ? 'Koneksi katalog terlalu lama merespons. Periksa internet lalu coba lagi.'
            : 'Katalog belum berhasil dimuat. Periksa konfigurasi Supabase dan izin baca tabel, lalu coba lagi.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [catalogAttempt]);

  const filteredGameBrands = gameBrands.filter((brand) =>
    brand.name.toLowerCase().includes(gameSearch.trim().toLowerCase())
  );

  // Use live catalog counts and configuration state rather than hard-coded marketing numbers.
  const catalogStatus = !supabaseConfigured
    ? 'Setup'
    : loading
      ? 'Memuat'
      : catalogError
        ? 'Periksa'
        : 'Terhubung';
  const stats = [
    { label: 'Game tersedia', value: loading ? '…' : catalogError ? '—' : String(gameBrands.length), icon: Gamepad2 },
    { label: 'Operator tersedia', value: loading ? '…' : catalogError ? '—' : String(pulsaBrands.length), icon: Smartphone },
    { label: 'Status katalog', value: catalogStatus, icon: ShieldCheck },
  ];

  const perks = [
    { icon: Clock, title: 'Status Transparan', desc: 'Lihat status pesanan setelah dibuat dan diverifikasi admin.' },
    { icon: ShieldCheck, title: 'Alur Terjaga', desc: 'Pesanan tidak otomatis dinyatakan berhasil sebelum diverifikasi.' },
    { icon: Flame, title: 'Harga Jelas', desc: 'Harga, biaya admin, dan kode unik tampil sebelum checkout.' },
    { icon: Headphones, title: 'Bantuan Admin', desc: 'Konfirmasi pembayaran melalui WhatsApp toko.' },
  ];

  const categoryCards: Record<string, { icon: typeof Zap; desc: string; cta: string }> = {
    game: { icon: Gamepad2, desc: 'Mobile Legends, Free Fire, Genshin, Valorant, PUBG, Higgs Domino', cta: 'Top-Up Game' },
    pulsa: { icon: Smartphone, desc: 'Telkomsel, Indosat, XL, Axis, Tri, Smartfren', cta: 'Beli Pulsa' },
    pln: { icon: Zap, desc: 'Token listrik prabayar untuk semua wilayah PLN', cta: 'Beli Token' },
  };

  return (
    <div className="pt-24">
      {/* HERO — storefront intro and fast service shortcuts */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-10 sm:pb-14">
        <div className="grid lg:grid-cols-[1.08fr_.92fr] gap-8 lg:gap-12 items-center">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-soft text-xs text-amber-300 mb-6 animate-fade-up">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              FITYORASTORE <span className="text-slate-600">/</span> TOP-UP DIGITAL
            </div>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold leading-[1.04] tracking-tight animate-fade-up delay-100">
              Semua kebutuhan
              <br />
              <span className="shimmer-text">Game, Pulsa &amp; PLN</span>
              <br />dalam satu tempat.
            </h1>
            <p className="mt-5 sm:mt-6 text-slate-300 text-base sm:text-lg max-w-2xl leading-relaxed animate-fade-up delay-200">
              Pilih layanan favorit, periksa rincian biaya sebelum membuat pesanan, lalu pantau statusnya sampai selesai.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 animate-fade-up delay-300">
              <button
                onClick={() => navigate('/topup/game')}
                className="btn-primary px-6 py-3.5 rounded-xl flex items-center gap-2 w-full sm:w-auto justify-center"
              >
                <Gamepad2 className="w-4 h-4" aria-hidden="true" /> Mulai Top-Up <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                onClick={() => navigate('/order-status')}
                className="btn-ghost px-6 py-3.5 rounded-xl flex items-center gap-2 w-full sm:w-auto justify-center"
              >
                <Clock className="w-4 h-4 text-cyan-300" aria-hidden="true" /> Cek Status Pesanan
              </button>
              {session && (
                <button
                  onClick={() => navigate('/dashboard')}
                  className="btn-ghost px-5 py-3.5 rounded-xl flex items-center gap-2 w-full sm:w-auto justify-center"
                >
                  <UserRound className="w-4 h-4 text-violet-200" aria-hidden="true" /> {profile?.display_name ? `Halo, ${profile.display_name}` : 'Dashboard Saya'}
                </button>
              )}
            </div>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs sm:text-sm text-slate-400">
              <span className="inline-flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-300" aria-hidden="true" /> Rincian biaya transparan</span>
              <span className="inline-flex items-center gap-2"><Clock className="w-4 h-4 text-cyan-300" aria-hidden="true" /> Status pesanan dapat dilacak</span>
            </div>
          </div>

          <div className="storefront-hero-panel glass rounded-3xl p-5 sm:p-7 relative overflow-hidden animate-fade-up delay-200">
            <div className="storefront-hero-glow" aria-hidden="true" />
            <div className="relative z-10">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div>
                  <p className="text-[10px] sm:text-xs tracking-[.2em] text-amber-300 font-semibold">PILIH LAYANAN</p>
                  <h2 className="font-display text-xl sm:text-2xl font-bold mt-1">Mulai dari sini</h2>
                </div>
                <div className={`storefront-status ${catalogStatus === 'Terhubung' ? 'storefront-status--ok' : catalogStatus === 'Periksa' ? 'storefront-status--warn' : ''}`} aria-live="polite">
                  <span className="storefront-status-dot" aria-hidden="true" />
                  {catalogStatus}
                </div>
              </div>

              <div className="grid gap-3">
                <button onClick={() => navigate('/topup/game')} className="storefront-quick-link group" aria-label="Pilih layanan top-up game">
                  <span className="storefront-quick-icon storefront-quick-icon--gold"><Gamepad2 className="w-5 h-5" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1 text-left"><span className="block font-semibold text-sm sm:text-base">Top-Up Game</span><span className="block text-xs text-slate-400 mt-0.5">Diamond, UC, dan item game</span></span>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-300 group-hover:translate-x-0.5 transition" aria-hidden="true" />
                </button>
                <button onClick={() => navigate('/topup/pulsa')} className="storefront-quick-link group" aria-label="Pilih layanan pulsa dan paket data">
                  <span className="storefront-quick-icon storefront-quick-icon--cyan"><Smartphone className="w-5 h-5" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1 text-left"><span className="block font-semibold text-sm sm:text-base">Pulsa &amp; Data</span><span className="block text-xs text-slate-400 mt-0.5">Isi ulang operator seluler</span></span>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-300 group-hover:translate-x-0.5 transition" aria-hidden="true" />
                </button>
                <button onClick={() => navigate('/topup/pln')} className="storefront-quick-link group" aria-label="Pilih layanan token listrik PLN">
                  <span className="storefront-quick-icon storefront-quick-icon--violet"><Zap className="w-5 h-5" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1 text-left"><span className="block font-semibold text-sm sm:text-base">Token PLN</span><span className="block text-xs text-slate-400 mt-0.5">Token listrik prabayar</span></span>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-violet-300 group-hover:translate-x-0.5 transition" aria-hidden="true" />
                </button>
              </div>

              <div className="mt-5 pt-4 border-t border-white/[.08] flex items-start gap-2.5 text-xs leading-relaxed text-slate-400">
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-300 mt-0.5" aria-hidden="true" />
                Pembayaran mengikuti metode yang tersedia. Pesanan diverifikasi admin; status berhasil hanya setelah proses selesai.
              </div>
            </div>
          </div>
        </div>

        {/* Live, truthful storefront indicators */}
        <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-3 sm:gap-4 mt-7 sm:mt-9 max-w-5xl mx-auto">
          {stats.map((s, i) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className="storefront-stat-card glass rounded-2xl px-4 py-4 sm:px-5 sm:py-5 animate-fade-up"
                style={{ animationDelay: `${0.25 + i * 0.08}s` }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="storefront-stat-icon"><Icon className="w-5 h-5 text-amber-300" aria-hidden="true" /></span>
                  <div className="min-w-0">
                    <div className="font-display text-xl sm:text-2xl font-bold text-gradient-gold tabular-nums truncate" aria-live="polite">{s.value}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{s.label}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* PROMO SLIDER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <PromoSlider />
      </section>

      {/* SERVICE CARDS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid md:grid-cols-3 gap-5">
          {loading && Array.from({ length: 3 }).map((_, i) => (
            <div key={`category-skeleton-${i}`} className="glass rounded-3xl p-7 min-h-56 animate-pulse" aria-hidden="true">
              <div className="w-14 h-14 rounded-2xl bg-white/[.06] mb-5" />
              <div className="h-5 w-2/3 rounded bg-white/[.06] mb-3" />
              <div className="h-3 w-full rounded bg-white/[.05] mb-2" />
              <div className="h-3 w-4/5 rounded bg-white/[.05]" />
            </div>
          ))}
          {categories.map((c, i) => {
            const cfg = categoryCards[c.slug] ?? categoryCards.game;
            const Icon = cfg.icon;
            return (
              <button
                key={c.id}
                onClick={() => navigate(`/topup/${c.slug}`)}
                className="group relative overflow-hidden rounded-3xl p-7 text-left glass card-hover animate-fade-up"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div
                  className="absolute -right-12 -top-12 w-40 h-40 rounded-full blur-3xl opacity-30 group-hover:opacity-50 transition"
                  style={{ background: c.accent }}
                />
                <div
                  className="relative w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                  style={{ background: `${c.accent}22`, border: `1px solid ${c.accent}55` }}
                >
                  <Icon className="w-7 h-7" style={{ color: c.accent }} />
                </div>
                <h3 className="font-display text-xl font-bold">{c.label}</h3>
                <p className="text-sm text-slate-400 mt-2 leading-relaxed">{cfg.desc}</p>
                <span
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium"
                  style={{ color: c.accent }}
                >
                  {cfg.cta} <ArrowRight className="w-4 h-4" />
                </span>
              </button>
            );
          })}
          {!loading && !catalogError && categories.length === 0 && (
            <div className="col-span-full glass rounded-2xl p-6 text-center">
              <Zap className="w-7 h-7 mx-auto text-amber-300 mb-2" aria-hidden="true" />
              <p className="font-semibold">Kategori belum tersedia</p>
              <p className="text-sm text-slate-400 mt-1">Katalog layanan belum memiliki kategori aktif.</p>
            </div>
          )}
          {!loading && catalogError && (
            <div className="col-span-full glass rounded-2xl p-6 text-center" role="status">
              <p className="font-semibold">Katalog sedang tidak dapat ditampilkan</p>
              <p className="text-sm text-slate-400 mt-1">Gunakan tombol coba lagi pada bagian Game Populer untuk memuat ulang katalog.</p>
            </div>
          )}
        </div>
      </section>

      {/* PERKS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {perks.map((b, i) => {
            const Icon = b.icon;
            return (
              <div
                key={b.title}
                className="glass rounded-2xl p-6 card-hover animate-fade-up"
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4 border border-amber-400/20">
                  <Icon className="w-5 h-5 text-amber-400" />
                </div>
                <h3 className="font-display font-semibold text-lg">{b.title}</h3>
                <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">{b.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* PAYMENT METHODS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <PaymentMethodsSection />
      </section>

      {/* POPULAR GAMES */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Flame className="w-6 h-6 text-amber-400" /> Game Populer
            </h2>
            <p className="text-slate-400 text-sm mt-1">Top-up langsung ke game favoritmu.</p>
          </div>
          <button
            onClick={() => navigate('/topup/game')}
            className="text-sm text-amber-300 hover:text-amber-200 flex items-center gap-1"
          >
            Lihat semua <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <div className="mb-5 flex flex-col sm:flex-row gap-3">
          <label className="glass-soft rounded-xl px-4 py-3 flex items-center gap-3 flex-1 border border-white/10 focus-within:border-amber-400/50">
            <Search className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
            <span className="sr-only">Cari game</span>
            <input
              value={gameSearch}
              onChange={(event) => setGameSearch(event.target.value)}
              placeholder="Cari game favorit…"
              className="w-full bg-transparent outline-none text-sm text-slate-100 placeholder:text-slate-500"
              aria-label="Cari game"
            />
            {gameSearch && <button type="button" onClick={() => setGameSearch('')} className="text-xs text-slate-400 hover:text-white">Hapus</button>}
          </label>
          <div className="glass-soft rounded-xl px-4 py-3 text-xs text-slate-400 flex items-center">
            {loading ? 'Memuat katalog…' : `${filteredGameBrands.length} game tersedia`}
          </div>
        </div>
        {catalogError && (
          <div role="alert" className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-rose-400/25 bg-rose-500/10 p-4 text-sm text-rose-100">
            <span>{catalogError}</span>
            <button onClick={() => setCatalogAttempt((attempt) => attempt + 1)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-300/30 px-3 py-2 hover:bg-rose-500/10">
              <RotateCcw className="w-4 h-4" /> Coba lagi
            </button>
          </div>
        )}
        <div className="grid grid-cols-2 min-[420px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-2xl glass animate-pulse" />
              ))
            : filteredGameBrands.map((b, i) => (
                <button
                  key={b.id}
                  onClick={() => navigate(`/topup/game?brand=${b.slug}`)}
                  className="group aspect-square rounded-2xl overflow-hidden relative card-hover animate-fade-up glass"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-white/0" />
                  <div className="absolute inset-0 flex items-center justify-center p-5">
                    <BrandLogo brand={b} size="lg" className="w-20 h-20 rounded-2xl" />
                  </div>
                  <div className="absolute bottom-2 inset-x-2 text-xs text-slate-200 font-medium text-center truncate">
                    {b.name}
                  </div>
                </button>
              ))}
          {!loading && !catalogError && filteredGameBrands.length === 0 && (
            <div className="col-span-full glass rounded-2xl p-8 text-center">
              <Search className="w-8 h-8 mx-auto text-slate-500 mb-3" />
              <p className="font-medium text-slate-200">Game tidak ditemukan</p>
              <p className="text-sm text-slate-400 mt-1">Coba kata kunci lain atau lihat seluruh katalog.</p>
              <button onClick={() => { setGameSearch(''); navigate('/topup/game'); }} className="btn-primary mt-4 rounded-lg px-4 py-2 text-sm">Lihat semua game</button>
            </div>
          )}
        </div>
      </section>

      {/* PULSA OPERATORS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Smartphone className="w-6 h-6 text-cyan-400" /> Semua Operator
            </h2>
            <p className="text-slate-400 text-sm mt-1">Pulsa & paket data untuk semua operator.</p>
          </div>
          <button
            onClick={() => navigate('/topup/pulsa')}
            className="text-sm text-cyan-300 hover:text-cyan-200 flex items-center gap-1"
          >
            Beli Pulsa <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {loading && Array.from({ length: 6 }).map((_, i) => (
            <div key={`operator-skeleton-${i}`} className="glass rounded-xl p-4 min-h-28 animate-pulse" aria-hidden="true">
              <div className="w-10 h-10 mx-auto rounded-xl bg-white/[.06] mb-2" />
              <div className="h-3 w-4/5 mx-auto rounded bg-white/[.06]" />
            </div>
          ))}
          {pulsaBrands.map((b, i) => (
            <button
              key={b.id}
              onClick={() => navigate(`/topup/pulsa?brand=${b.slug}`)}
              className="glass rounded-xl p-4 flex flex-col items-center gap-2 card-hover animate-fade-up"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <BrandLogo brand={b} size="sm" />
              <span className="text-xs text-slate-300 text-center font-medium">{b.name}</span>
            </button>
          ))}
          {!loading && !catalogError && pulsaBrands.length === 0 && (
            <div className="col-span-full glass rounded-2xl p-6 text-center">
              <Smartphone className="w-7 h-7 mx-auto text-cyan-300 mb-2" aria-hidden="true" />
              <p className="font-semibold">Operator belum tersedia</p>
              <p className="text-sm text-slate-400 mt-1">Silakan kembali lagi setelah katalog operator diaktifkan.</p>
            </div>
          )}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          <h2 className="font-display text-2xl sm:text-3xl font-bold">
            Apa Kata <span className="text-gradient-gold">Pelanggan</span>
          </h2>
          <p className="text-slate-400 text-sm mt-2">Ulasan ditampilkan dari data pelanggan yang tersimpan di sistem.</p>
        </div>
        <Testimonials />
      </section>

      {/* FAQ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          <h2 className="font-display text-2xl sm:text-3xl font-bold">
            Pertanyaan <span className="text-gradient-gold">Umum</span>
          </h2>
          <p className="text-slate-400 text-sm mt-2">Jawaban atas pertanyaan yang sering ditanyakan.</p>
        </div>
        <FaqAccordion />
      </section>

      {/* CONTACT */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="glass rounded-3xl p-8 sm:p-10">
          <div className="text-center mb-8">
            <h2 className="font-display text-2xl sm:text-3xl font-bold">
              Butuh <span className="text-gradient-gold">Bantuan?</span>
            </h2>
            <p className="text-slate-400 text-sm mt-2">
              Hubungi admin via WhatsApp, Telegram, atau email. Sertakan kode pesanan agar pengecekan lebih mudah.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            <a
              href={STORE_CONTACT.whatsappLink}
              target="_blank"
              rel="noreferrer"
              className="group glass-soft rounded-2xl p-6 text-center card-hover"
            >
              <div className="w-12 h-12 mx-auto rounded-xl bg-emerald-500/15 flex items-center justify-center mb-3 border border-emerald-400/30">
                <MessageCircle className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="font-display font-semibold">WhatsApp</div>
              <div className="text-xs text-slate-400 mt-1">{STORE_CONTACT.whatsappDisplay}</div>
              <div className="mt-3 text-xs text-emerald-300 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition">
                Chat sekarang <ArrowRight className="w-3 h-3" />
              </div>
            </a>
            <a
              href={STORE_CONTACT.telegramLink}
              target="_blank"
              rel="noreferrer"
              className="group glass-soft rounded-2xl p-6 text-center card-hover"
            >
              <div className="w-12 h-12 mx-auto rounded-xl bg-cyan-500/15 flex items-center justify-center mb-3 border border-cyan-400/30">
                <Send className="w-6 h-6 text-cyan-400" />
              </div>
              <div className="font-display font-semibold">Telegram</div>
              <div className="text-xs text-slate-400 mt-1">@{STORE_CONTACT.telegramUsername}</div>
              <div className="mt-3 text-xs text-cyan-300 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition">
                Buka Telegram <ArrowRight className="w-3 h-3" />
              </div>
            </a>
            <a
              href={`mailto:${STORE_CONTACT.email}`}
              className="group glass-soft rounded-2xl p-6 text-center card-hover"
            >
              <div className="w-12 h-12 mx-auto rounded-xl bg-amber-500/15 flex items-center justify-center mb-3 border border-amber-400/30">
                <Mail className="w-6 h-6 text-amber-400" />
              </div>
              <div className="font-display font-semibold">Email</div>
              <div className="text-xs text-slate-400 mt-1 break-all">{STORE_CONTACT.email}</div>
              <div className="mt-3 text-xs text-amber-300 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition">
                Kirim email <ArrowRight className="w-3 h-3" />
              </div>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
