import { useEffect, useMemo, useState } from 'react';
import { Receipt, User as UserIcon, Save, Wallet, Zap, Smartphone, Gamepad2, Clock, Check, CheckCircle2, Loader2, XCircle, Sparkles, Search, RefreshCw, Copy, ChevronDown, ChevronUp, CalendarDays, ArrowRight, Mail, ShieldCheck } from 'lucide-react';
import { supabase, type Order, type TopupCategory } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useRoute } from '@/lib/router';
import { formatPrice, timeAgo, initials, avatarGradient, statusLabel } from '@/lib/format';
import { methodById } from '@/lib/payment';

export default function DashboardPage() {
  const { profile, session, refreshProfile } = useAuth();
  const { navigate } = useRoute();
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<TopupCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersError, setOrdersError] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatus, setOrderStatus] = useState('all');
  const [reloadOrders, setReloadOrders] = useState(0);
  const [orderPage, setOrderPage] = useState(1);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [saveError, setSaveError] = useState('');
  const [profileDirty, setProfileDirty] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const [o, c] = await Promise.all([
          supabase
            .from('orders')
            .select('*, category:topup_categories(*), brand:brands(*), package:packages(*)')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false }),
          supabase.from('topup_categories').select('*').order('sort_order'),
        ]);
        if (!active) return;
        if (o.error) {
          setOrdersError('Riwayat transaksi gagal dimuat. Periksa koneksi lalu coba lagi.');
        } else {
          setOrdersError('');
          setOrders((o.data as Order[]) ?? []);
        }
        if (!c.error) setCategories((c.data as TopupCategory[]) ?? []);
      } catch {
        if (active) setOrdersError('Koneksi bermasalah saat memuat transaksi. Coba lagi.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [session?.user?.id, reloadOrders]);

  useEffect(() => {
    // Do not overwrite an in-progress profile edit when auth/profile data refreshes.
    if (profile && !profileDirty) {
      setDisplayName(profile.display_name ?? '');
      setBio(profile.bio ?? '');
    }
  }, [profile, profileDirty]);

  // Keep hooks unconditional: AuthContext can resolve the session after the first render.
  const visibleOrders = useMemo(() => {
    const query = orderSearch.trim().toLocaleLowerCase('id-ID');
    return orders.filter((order) => {
      const matchesStatus = orderStatus === 'all' || order.status === orderStatus;
      const searchable = [order.code, order.target, order.brand?.name, order.package?.name]
        .filter(Boolean).join(' ').toLocaleLowerCase('id-ID');
      return matchesStatus && (!query || searchable.includes(query));
    });
  }, [orders, orderSearch, orderStatus]);
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(visibleOrders.length / pageSize));
  const safeOrderPage = Math.min(orderPage, pageCount);
  const pagedOrders = useMemo(
    () => visibleOrders.slice((safeOrderPage - 1) * pageSize, safeOrderPage * pageSize),
    [visibleOrders, safeOrderPage],
  );
  const successfulOrders = orders.filter((order) => order.status === 'success');
  const activeOrdersCount = orders.filter((order) => order.status === 'pending' || order.status === 'processing').length;
  const totalSpent = successfulOrders.reduce((sum, order) => sum + Number(order.total_amount || order.price), 0);

  if (!session) {
    return (
      <div className="pt-24 max-w-md mx-auto px-4 text-center py-20">
        <h2 className="font-display text-2xl font-bold">Masuk dulu</h2>
        <p className="text-slate-400 mt-2 text-sm">Dashboard hanya untuk member yang sudah login.</p>
        <button onClick={() => navigate('/login')} className="btn-primary mt-5 px-5 py-2.5 rounded-lg">Masuk</button>
      </div>
    );
  }

  const saveProfile = async () => {
    const cleanName = displayName.trim();
    const cleanBio = bio.trim();
    if (!cleanName) {
      setSaveError('Nama tampilan wajib diisi.');
      setSavedMsg('');
      return;
    }
    if (cleanName.length > 40 || cleanBio.length > 160) {
      setSaveError('Nama maksimal 40 karakter dan bio maksimal 160 karakter.');
      setSavedMsg('');
      return;
    }

    setSaving(true);
    setSaveError('');
    setSavedMsg('');
    try {
      // Select the updated row so an RLS-filtered zero-row update is not mistaken for success.
      const { data, error } = await supabase.from('profiles')
        .update({ display_name: cleanName, bio: cleanBio })
        .eq('id', session.user.id)
        .select('id')
        .maybeSingle();
      if (error || !data) {
        setSaveError('Profil belum berhasil disimpan. Pastikan koneksi aktif, lalu coba lagi.');
        return;
      }
      setDisplayName(cleanName);
      setBio(cleanBio);
      await refreshProfile();
      setProfileDirty(false);
      setSavedMsg('Profil berhasil disimpan.');
      window.setTimeout(() => setSavedMsg(''), 2800);
    } catch {
      setSaveError('Terjadi gangguan saat menyimpan profil. Coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  const successCount = successfulOrders.length;

  const copyOrderCode = async (orderId: string, orderCode: string) => {
    setCopyError('');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API tidak tersedia');
      await navigator.clipboard.writeText(orderCode);
      setCopiedOrderId(orderId);
      window.setTimeout(() => setCopiedOrderId((current) => current === orderId ? null : current), 1800);
    } catch {
      setCopyError('Kode tidak dapat disalin otomatis. Tekan lama kode order untuk menyalinnya secara manual.');
    }
  };

  const catIcon = (slug: string) =>
    slug === 'pulsa' ? Smartphone : slug === 'pln' ? Zap : Gamepad2;

  const statusColor = (s: Order['status']) =>
    s === 'success' ? 'text-emerald-400' : s === 'failed' ? 'text-rose-400' : 'text-amber-300';
  const StatusIcon = ({ s }: { s: Order['status'] }) =>
    s === 'success' ? <CheckCircle2 className="w-4 h-4" /> : s === 'failed' ? <XCircle className="w-4 h-4" /> : s === 'processing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />;

  return (
    <div className="dashboard-page pt-24 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
      <section className="dashboard-hero glass rounded-3xl p-5 sm:p-7 lg:p-8 mb-6 animate-fade-up" aria-labelledby="dashboard-title">
        <div className="dashboard-hero-glow" aria-hidden="true" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <div className="dashboard-avatar shrink-0" style={{ background: avatarGradient(profile?.id ?? session.user.id) }} aria-hidden="true">
              {initials(profile?.display_name || session.user.email || 'Member')}
            </div>
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1 text-[10px] sm:text-xs uppercase tracking-[.18em] text-violet-100">
                <Sparkles className="w-3.5 h-3.5 text-cyan-200" /> Member space
              </div>
              <h1 id="dashboard-title" className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold mt-3 tracking-tight">
                Halo, <span className="text-gradient-gold">{profile?.display_name || 'Player'}</span>
              </h1>
              <p className="text-slate-300 text-sm mt-2 max-w-2xl">Semua aktivitas top-up, status pesanan, dan pengaturan akunmu dalam satu tempat.</p>
              <div className="flex flex-wrap items-center gap-2 mt-4 text-xs">
                <span className="dashboard-account-pill"><ShieldCheck className="w-3.5 h-3.5 text-emerald-300" /> Akun {profile?.role === 'admin' ? 'Admin' : profile?.role === 'author' ? 'Author' : 'Member'}</span>
                {session.user.email && <span className="dashboard-account-pill min-w-0"><Mail className="w-3.5 h-3.5 text-cyan-200 shrink-0" /><span className="truncate max-w-[17rem]">{session.user.email}</span></span>}
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row gap-2 lg:min-w-[190px]">
            <button type="button" onClick={() => navigate('/topup/game')} className="btn-primary px-4 py-3 rounded-xl text-sm flex items-center justify-center gap-2">
              <Zap className="w-4 h-4" /> Top-Up Baru <ArrowRight className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => document.getElementById('dashboard-orders')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="btn-ghost px-4 py-3 rounded-xl text-sm flex items-center justify-center gap-2">
              <Receipt className="w-4 h-4" /> Riwayat Pesanan
            </button>
          </div>
        </div>
      </section>

      {/* Real, account-scoped statistics */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-8" aria-label="Ringkasan transaksi akun">
        <div className="dashboard-stat-card glass rounded-2xl p-4 sm:p-5">
          <span className="dashboard-stat-icon dashboard-stat-icon--violet"><Receipt className="w-5 h-5" /></span>
          <div className="font-display text-2xl sm:text-3xl font-bold mt-3 tabular-nums">{loading ? '—' : orders.length}</div>
          <div className="text-xs text-slate-400 mt-1">Total Transaksi</div>
        </div>
        <div className="dashboard-stat-card glass rounded-2xl p-4 sm:p-5">
          <span className="dashboard-stat-icon dashboard-stat-icon--green"><CheckCircle2 className="w-5 h-5" /></span>
          <div className="font-display text-2xl sm:text-3xl font-bold mt-3 tabular-nums">{loading ? '—' : successCount}</div>
          <div className="text-xs text-slate-400 mt-1">Transaksi Berhasil</div>
        </div>
        <div className="dashboard-stat-card glass rounded-2xl p-4 sm:p-5">
          <span className="dashboard-stat-icon dashboard-stat-icon--cyan"><Clock className="w-5 h-5" /></span>
          <div className="font-display text-2xl sm:text-3xl font-bold mt-3 tabular-nums">{loading ? '—' : activeOrdersCount}</div>
          <div className="text-xs text-slate-400 mt-1">Menunggu / Diproses</div>
        </div>
        <div className="dashboard-stat-card glass rounded-2xl p-4 sm:p-5">
          <span className="dashboard-stat-icon dashboard-stat-icon--gold"><Wallet className="w-5 h-5" /></span>
          <div className="font-display text-xl sm:text-2xl font-bold mt-3 tabular-nums">{loading ? '—' : formatPrice(totalSpent)}</div>
          <div className="text-xs text-slate-400 mt-1">Total Belanja Berhasil</div>
        </div>
      </div>

      {/* Quick top-up shortcuts */}
      <div className="grid sm:grid-cols-3 gap-3 mb-8">
        {categories.map((c) => {
          const Icon = catIcon(c.slug);
          return (
            <button
              key={c.id}
              onClick={() => navigate(`/topup/${c.slug}`)}
              className="dashboard-action-card glass rounded-2xl p-5 flex items-center gap-3 card-hover"
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: `${c.accent}22`, border: `1px solid ${c.accent}55` }}
              >
                <Icon className="w-5 h-5" style={{ color: c.accent }} />
              </div>
              <div className="text-left">
                <div className="font-medium text-sm">{c.label}</div>
                <div className="text-xs text-slate-500">Top-up sekarang</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Order history */}
        <div id="dashboard-orders" className="lg:col-span-2 dashboard-anchor">
          <div className="glass rounded-2xl p-5 sm:p-6">
            <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-amber-400" /> Riwayat Transaksi
            </h2>
            {ordersError ? (
              <div className="text-center py-8" role="alert">
                <p className="text-rose-300 text-sm">{ordersError}</p>
                <button onClick={() => { setOrdersError(''); setLoading(true); setReloadOrders((value) => value + 1); }} className="btn-ghost mt-3 px-4 py-2 rounded-lg text-sm inline-flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" /> Coba lagi
                </button>
              </div>
            ) : loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-slate-400 text-sm">Belum ada transaksi.</p>
                <button onClick={() => navigate('/topup/game')} className="btn-primary mt-4 px-4 py-2 rounded-lg text-sm inline-flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> Mulai Top-Up
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input aria-label="Cari riwayat transaksi" value={orderSearch} onChange={(event) => { setOrderSearch(event.target.value); setOrderPage(1); }} placeholder="Cari kode, tujuan, atau produk…" className="w-full pl-9 pr-3 py-2.5 rounded-xl glass-soft text-sm" />
                  </div>
                  <select aria-label="Filter status transaksi" value={orderStatus} onChange={(event) => { setOrderStatus(event.target.value); setOrderPage(1); }} className="px-3 py-2.5 rounded-xl glass-soft text-sm">
                    <option value="all">Semua status</option><option value="pending">Menunggu</option><option value="processing">Diproses</option><option value="success">Berhasil</option><option value="failed">Gagal</option>
                  </select>
                </div>
                <p className="text-xs text-slate-500" aria-live="polite">Menampilkan {visibleOrders.length === 0 ? 0 : (safeOrderPage - 1) * pageSize + 1}–{Math.min(safeOrderPage * pageSize, visibleOrders.length)} dari {visibleOrders.length} transaksi yang cocok ({orders.length} total)</p>
                {visibleOrders.length === 0 ? <p className="text-slate-400 text-sm text-center py-8">Tidak ada transaksi yang cocok dengan filter.</p> : <div className="space-y-2">
                {pagedOrders.map((o) => {
                  const Icon = catIcon(o.category?.slug ?? 'game');
                  return (
                    <div key={o.id} className="space-y-2">
                    <div className="flex items-center gap-3 p-3 rounded-xl glass-soft hover:border-amber-400/30 transition">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: `${o.category?.accent ?? '#f5b301'}22`, border: `1px solid ${o.category?.accent ?? '#f5b301'}55` }}
                      >
                        <Icon className="w-5 h-5" style={{ color: o.category?.accent ?? '#f5b301' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {o.brand?.name} • {o.package?.name}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                          <span className="font-mono">{o.code}</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {timeAgo(o.created_at)}
                          </span>
                          <span className={`flex items-center gap-1 ${statusColor(o.status)}`}>
                            <StatusIcon s={o.status} /> {statusLabel(o.status)}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">Tujuan: <span className="font-mono">{o.target}</span></div>
                        {o.server && <div className="text-xs text-slate-500 mt-0.5">Server: <span className="font-mono">{o.server}</span></div>}
                        {o.payment_method && (
                          <div className="text-xs text-slate-500 mt-0.5">Bayar via {methodById(o.payment_method)?.name ?? o.payment_method}</div>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-semibold text-amber-300">{formatPrice(Number(o.total_amount) || o.price)}</div>
                        {Number(o.total_amount) > 0 && Number(o.total_amount) !== o.price && (
                          <div className="text-[10px] text-slate-500 font-normal line-through">{formatPrice(o.price)}</div>
                        )}
                        <div className="mt-2 flex flex-col items-end gap-1">
                          <button type="button" onClick={() => copyOrderCode(o.id, o.code)} className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 rounded" aria-label={`Salin kode order ${o.code}`}>
                            {copiedOrderId === o.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {copiedOrderId === o.id ? 'Tersalin' : 'Salin kode'}
                          </button>
                          <button type="button" onClick={() => setExpandedOrderId((current) => current === o.id ? null : o.id)} aria-expanded={expandedOrderId === o.id} className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 rounded">
                            {expandedOrderId === o.id ? 'Tutup detail' : 'Detail'}
                            {expandedOrderId === o.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                    </div>
                    {expandedOrderId === o.id && (
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl border border-white/10 bg-slate-950/30 p-3 text-xs">
                        <div><span className="text-slate-500">Tanggal order</span><div className="mt-1 text-slate-200 flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5 text-amber-300" />{new Date(o.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</div></div>
                        <div><span className="text-slate-500">Metode pembayaran</span><div className="mt-1 text-slate-200">{methodById(o.payment_method)?.name ?? o.payment_method ?? 'Belum tersedia'}</div></div>
                        <div><span className="text-slate-500">Status</span><div className={`mt-1 ${statusColor(o.status)}`}>{statusLabel(o.status)}</div></div>
                        <div><span className="text-slate-500">Nominal tercatat</span><div className="mt-1 text-slate-200">{formatPrice(Number(o.total_amount) || o.price)}</div></div>
                        <p className="sm:col-span-2 text-slate-400">{o.status === 'pending' ? 'Pesanan menunggu konfirmasi pembayaran dan belum dinyatakan berhasil.' : o.status === 'processing' ? 'Pesanan masih diproses. Status final menunggu pembaruan dari pengelola.' : o.status === 'success' ? 'Pesanan ditandai berhasil oleh pengelola.' : 'Pesanan ditandai gagal. Hubungi admin bila perlu pemeriksaan lebih lanjut.'}</p>
                      </div>
                    )}
                    </div>
                  );
                })}
                </div>}
                {visibleOrders.length > 0 && (
                  <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                    <button type="button" disabled={safeOrderPage <= 1} onClick={() => setOrderPage((page) => Math.max(1, page - 1))} className="btn-ghost px-3 py-2 rounded-lg text-xs disabled:opacity-40">Sebelumnya</button>
                    <span className="text-xs text-slate-400" aria-live="polite">Halaman {safeOrderPage} dari {pageCount}</span>
                    <button type="button" disabled={safeOrderPage >= pageCount} onClick={() => setOrderPage((page) => Math.min(pageCount, page + 1))} className="btn-ghost px-3 py-2 rounded-lg text-xs disabled:opacity-40">Berikutnya</button>
                  </div>
                )}
                {copyError && <p role="status" className="text-xs text-amber-200">{copyError}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Profile */}
        <div id="dashboard-profile" className="space-y-6 dashboard-anchor">
          <div className="glass rounded-2xl p-5 sm:p-6 dashboard-profile-card">
            <h2 className="font-display font-semibold mb-4 flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-amber-400" /> Profil
            </h2>
            <div className="flex items-center gap-3 mb-5 p-3 rounded-2xl border border-white/[.07] bg-white/[.025]">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white ring-1 ring-white/10" style={{ background: avatarGradient(profile?.id ?? session.user.id) }} aria-hidden="true">
                {initials(displayName || session.user.email || 'Member')}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">{displayName.trim() || 'Member FityoraStore'}</div>
                <div className="text-xs text-slate-500 mt-1">Bergabung {timeAgo(profile?.created_at ?? new Date().toISOString())}</div>
              </div>
              <span className="text-[10px] uppercase tracking-wider rounded-full border border-violet-300/20 bg-violet-300/[.07] px-2 py-1 text-violet-100">Akun Saya</span>
            </div>
            <label htmlFor="profile-email" className="text-xs text-slate-400 block mb-1.5">Email akun</label>
            <input id="profile-email" value={session.user.email ?? ''} readOnly className="w-full px-3 py-2.5 rounded-xl glass-soft text-sm mb-3 opacity-75 cursor-not-allowed" aria-describedby="profile-email-note" />
            <p id="profile-email-note" className="text-[11px] text-slate-500 -mt-1 mb-4">Email ditampilkan dari akun login dan tidak dapat diubah di formulir ini.</p>
            <label htmlFor="profile-display-name" className="text-xs text-slate-400 block mb-1.5">Nama Tampilan</label>
            <input
              id="profile-display-name"
              value={displayName}
              onChange={(e) => { setDisplayName(e.target.value); setProfileDirty(true); setSavedMsg(''); }}
              maxLength={40}
              required
              autoComplete="nickname"
              placeholder="Nama yang ingin ditampilkan"
              className="inp mb-1"
            />
            <div className="text-right text-[10px] text-slate-500 mb-3">{displayName.length}/40 karakter</div>
            <label htmlFor="profile-bio" className="text-xs text-slate-400 block mb-1.5">Bio singkat</label>
            <textarea
              id="profile-bio"
              value={bio}
              onChange={(e) => { setBio(e.target.value); setProfileDirty(true); setSavedMsg(''); }}
              rows={3}
              maxLength={160}
              placeholder="Ceritakan sedikit tentang dirimu (opsional)"
              className="inp resize-none"
            />
            <div className="text-right text-[10px] text-slate-500 mt-1">{bio.length}/160 karakter</div>
            <button
              onClick={saveProfile}
              type="button"
              disabled={saving || !profileDirty || !displayName.trim()}
              className="btn-primary mt-4 w-full px-4 py-3 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" /> {saving ? 'Menyimpan…' : profileDirty ? 'Simpan Perubahan' : 'Profil Tersimpan'}
            </button>
            {savedMsg && <p role="status" className="text-xs text-emerald-400 mt-2 text-center">{savedMsg}</p>}
            {saveError && <p role="alert" className="text-xs text-rose-300 mt-2 text-center">{saveError}</p>}
            <p className="text-[10px] text-slate-500 mt-4 leading-relaxed">Perubahan hanya menyentuh nama tampilan dan bio akun yang sedang login. Peran akun dan data transaksi tidak dapat diubah dari formulir ini.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
