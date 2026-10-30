import { cloneElement, isValidElement, useEffect, useId, useState, useCallback, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  LayoutDashboard, Receipt, Package as PackageIcon, Image as ImageIcon, Star, HelpCircle,
  Plus, Pencil, Trash2, X, Save, Loader2, Search, TrendingUp, Wallet,
  Tag, Layers, Wrench, ShieldAlert, Trash, Download, Upload, CheckSquare, Square,
} from 'lucide-react';
import {
  supabase, type Order, type Brand, type Package, type PromoBanner,
  type Testimonial, type Faq, type TopupCategory,
} from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useRoute } from '@/lib/router';
import { formatPrice, initials, avatarGradient, statusLabel } from '@/lib/format';
import { methodById } from '@/lib/payment';
import BrandLogo from '@/components/BrandLogo';
import { parseCsv, parseRupiah, toCsv } from '@/lib/bulkPricing.mjs';
import { parsePromoDestination } from '@/lib/promoDestination.mjs';

type Tab = 'overview' | 'orders' | 'products' | 'promos' | 'testimonials' | 'faqs' | 'maintenance';

function readSortOrder(value: unknown): number | null {
  const parsed = Number(value ?? 0);
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= 2147483647 ? parsed : null;
}

function normalizeSlug(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120).replace(/-+$/g, '');
}

function isSafeMediaUrl(value: string): boolean {
  if (!value) return true;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

export default function AdminPage() {
  const { profile, session, loading: authLoading } = useAuth();
  const { navigate } = useRoute();
  const [tab, setTab] = useState<Tab>('overview');
  const [orders, setOrders] = useState<Order[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<TopupCategory[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [supplierCosts, setSupplierCosts] = useState<Record<string, number>>({});
  const [promos, setPromos] = useState<PromoBanner[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('Kami sedang melakukan pemeliharaan. Silakan kembali beberapa saat lagi.');
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);
  const [maintenanceSettingsAvailable, setMaintenanceSettingsAvailable] = useState(true);

  const loadAll = useCallback(async () => {
    try {
      const [o, b, c, p, pr, t, f, settings, costs] = await Promise.all([
        supabase.from('orders').select('*, category:topup_categories(*), brand:brands(*), package:packages(*)').order('created_at', { ascending: false }).limit(200),
        supabase.from('brands').select('*').order('sort_order'),
        supabase.from('topup_categories').select('*').order('sort_order'),
        supabase.from('packages').select('*').order('sort_order'),
        supabase.from('promo_banners').select('*').order('sort_order'),
        supabase.from('testimonials').select('*').order('sort_order'),
        supabase.from('faqs').select('*').order('sort_order'),
        supabase.from('site_settings').select('maintenance_enabled, maintenance_message').eq('id', true).maybeSingle(),
        supabase.rpc('admin_list_package_supplier_costs'),
      ]);
      // Maintenance settings are an optional Phase 44 database feature. Do not let a missing
      // site_settings table block the rest of the admin dashboard from loading.
      setMaintenanceSettingsAvailable(!settings.error);
      const firstError = [o, b, c, p, pr, t, f].find((result) => result.error)?.error;
      const costsError = costs.error;
      if (firstError || costsError) {
        const detail = firstError?.message ?? costsError?.message ?? 'Kesalahan tidak diketahui.';
        window.alert(`Sebagian data admin gagal dimuat: ${detail}${costsError ? '\n\nPastikan migrasi Phase 52 dan Phase 57 untuk RPC harga modal sudah diterapkan.' : ''}`);
      }
      if (!o.error) setOrders((o.data as Order[]) ?? []);
      if (!b.error) setBrands((b.data as Brand[]) ?? []);
      if (!c.error) setCategories((c.data as TopupCategory[]) ?? []);
      if (!p.error) setPackages((p.data as Package[]) ?? []);
      if (!costs.error) {
        const supplierCostRows = (costs.data ?? []) as Array<{ package_id: string; supplier_cost: number | string }>;
        setSupplierCosts(Object.fromEntries(supplierCostRows.map((row) => [String(row.package_id), Number(row.supplier_cost)])));
      }
      if (!pr.error) setPromos((pr.data as PromoBanner[]) ?? []);
      if (!t.error) setTestimonials((t.data as Testimonial[]) ?? []);
      if (!f.error) setFaqs((f.data as Faq[]) ?? []);
      if (settings.data) { setMaintenanceEnabled(Boolean(settings.data.maintenance_enabled)); setMaintenanceMessage(String(settings.data.maintenance_message || 'Kami sedang melakukan pemeliharaan. Silakan kembali beberapa saat lagi.')); }
      else if (settings.error) { setMaintenanceEnabled(false); }
    } catch (err) {
      window.alert(`Data dashboard gagal dimuat: ${err instanceof Error ? err.message : 'Koneksi atau respons server bermasalah.'}. Periksa koneksi, lalu muat ulang.`);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateOrderStatus = useCallback(async (orderId: string, status: Order['status']) => {
    try {
      const { error: updateError } = await supabase.rpc('admin_update_order_status', {
        p_order_id: orderId,
        p_status: status,
      });
      if (updateError) {
        window.alert(`Status pesanan gagal diperbarui: ${updateError.message}`);
        return;
      }
      await loadAll();
    } catch (err) {
      window.alert(`Status pesanan gagal diperbarui: ${err instanceof Error ? err.message : 'Kesalahan koneksi.'}`);
    }
  }, [loadAll]);


  const deleteOrder = useCallback(async (order: Order) => {
    if (!window.confirm(`Hapus pesanan ${order.code} secara permanen?\n\nTindakan ini tidak dapat dibatalkan dan pesanan akan hilang dari riwayat admin/pelanggan.`)) return;
    try {
      const { error } = await supabase.rpc('admin_delete_order', { p_order_id: order.id });
      if (error) { window.alert(`Pesanan gagal dihapus: ${error.message}`); return; }
      await loadAll();
    } catch (err) {
      window.alert(`Pesanan gagal dihapus: ${err instanceof Error ? err.message : 'Kesalahan koneksi.'}`);
    }
  }, [loadAll]);

  const saveMaintenance = useCallback(async (enabled: boolean) => {
    if (!maintenanceSettingsAvailable) {
      window.alert('Pengaturan maintenance belum tersedia di Supabase. Terapkan migration Phase 44 terlebih dahulu, lalu muat ulang dashboard.');
      return;
    }
    setMaintenanceSaving(true);
    try {
      const { data, error } = await supabase.rpc('admin_set_site_maintenance', {
        p_enabled: enabled, p_message: maintenanceMessage,
      });
      if (error) { window.alert(`Pengaturan maintenance gagal disimpan: ${error.message}. Pastikan migrasi Phase 44 sudah diterapkan.`); return; }
      setMaintenanceEnabled(Boolean(data?.maintenance_enabled ?? enabled));
      window.alert(enabled ? 'Mode maintenance diaktifkan untuk seluruh pengunjung.' : 'Mode maintenance dinonaktifkan. Website kembali dibuka.');
    } catch (err) {
      window.alert(`Pengaturan maintenance gagal disimpan: ${err instanceof Error ? err.message : 'Kesalahan koneksi.'}`);
    } finally {
      setMaintenanceSaving(false);
    }
  }, [maintenanceMessage, maintenanceSettingsAvailable]);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }
    if (!session || !profile || (profile.role !== 'admin' && profile.role !== 'author')) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void loadAll();
  }, [authLoading, session, profile, loadAll]);

  if (authLoading) {
    return (
      <div className="pt-24 max-w-md mx-auto px-4 text-center py-20 text-slate-400" role="status">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
        Memeriksa sesi dan hak akses…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="pt-24 max-w-md mx-auto px-4 text-center py-20">
        <h2 className="font-display text-2xl font-bold">Masuk dulu</h2>
        <p className="text-slate-400 mt-2 text-sm">Dashboard admin hanya untuk staf toko yang sudah login.</p>
        <button onClick={() => navigate('/login')} className="btn-primary mt-5 px-5 py-2.5 rounded-lg">Masuk</button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="pt-24 max-w-md mx-auto px-4 text-center py-20" role="alert">
        <h2 className="font-display text-2xl font-bold">Profil belum bisa diverifikasi</h2>
        <p className="text-slate-400 mt-2 text-sm">Data akses akun tidak berhasil dimuat. Muat ulang halaman atau masuk kembali sebelum membuka dashboard admin.</p>
        <button onClick={() => window.location.reload()} className="btn-ghost mt-5 px-5 py-2.5 rounded-lg">Muat ulang</button>
      </div>
    );
  }

  if (profile.role !== 'admin' && profile.role !== 'author') {
    return (
      <div className="pt-24 max-w-md mx-auto px-4 text-center py-20">
        <h2 className="font-display text-2xl font-bold">Akses ditolak</h2>
        <p className="text-slate-400 mt-2 text-sm">Halaman ini khusus staf toko (author/admin). Akunmu belum terdaftar sebagai staf.</p>
        <button onClick={() => navigate('/')} className="btn-ghost mt-5 px-5 py-2.5 rounded-lg">Kembali ke Beranda</button>
      </div>
    );
  }

  const revenue = orders.filter((o) => o.status === 'success').reduce((s, o) => s + Number(o.total_amount || o.price), 0);
  const successCount = orders.filter((o) => o.status === 'success').length;
  const pendingCount = orders.filter((o) => o.status === 'pending' || o.status === 'processing').length;

  const tabs: { id: Tab; label: string; icon: typeof Receipt }[] = [
    { id: 'overview', label: 'Ringkasan', icon: LayoutDashboard },
    { id: 'orders', label: 'Pesanan', icon: Receipt },
    { id: 'products', label: 'Kelola Produk', icon: PackageIcon },
    { id: 'promos', label: 'Promo', icon: ImageIcon },
    { id: 'testimonials', label: 'Testimoni', icon: Star },
    { id: 'faqs', label: 'FAQ', icon: HelpCircle },
    { id: 'maintenance', label: 'Maintenance Website', icon: Wrench },
  ];

  return (
    <div className="pt-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
      <div className="pt-6 pb-6 flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
          <LayoutDashboard className="w-6 h-6 text-slate-900" />
        </div>
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold">Dashboard Admin</h1>
          <p className="text-slate-400 text-sm">Kelola pesanan, produk, dan konten toko.</p>
        </div>
      </div>

      <div className="admin-tabs flex gap-1 overflow-x-auto pb-2 mb-6 -mx-1 px-1 hide-scrollbar" role="group" aria-label="Navigasi dashboard admin">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-pressed={active}
              className={`admin-tab flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition ${
                active ? 'bg-amber-500/15 text-amber-300 border border-amber-400/30' : 'glass-soft text-slate-300 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="glass rounded-2xl p-10 flex items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" /> Memuat data…
        </div>
      ) : (
        <>
          {tab === 'overview' && (
            <Overview
              revenue={revenue}
              successCount={successCount}
              pendingCount={pendingCount}
              orderCount={orders.length}
              packageCount={packages.length}
              brandCount={brands.length}
              recentOrders={orders.slice(0, 6)}
            />
          )}
          {tab === 'orders' && <OrdersTab orders={orders} onStatusChange={updateOrderStatus} onDelete={deleteOrder} />}
          {tab === 'products' && (
            <ProductsTab packages={packages} supplierCosts={supplierCosts} brands={brands} categories={categories} onChange={loadAll} />
          )}
          {tab === 'promos' && <PromosTab promos={promos} onChange={loadAll} />}
          {tab === 'testimonials' && <TestimonialsTab items={testimonials} onChange={loadAll} />}
          {tab === 'faqs' && <FaqsTab items={faqs} onChange={loadAll} />}
          {tab === 'maintenance' && <MaintenanceTab enabled={maintenanceEnabled} message={maintenanceMessage} saving={maintenanceSaving} available={maintenanceSettingsAvailable} onMessageChange={setMaintenanceMessage} onToggle={saveMaintenance} />}
        </>
      )}
    </div>
  );
}

/* ============ OVERVIEW ============ */
function Overview({
  revenue, successCount, pendingCount, orderCount, packageCount, brandCount, recentOrders,
}: {
  revenue: number; successCount: number; pendingCount: number; orderCount: number;
  packageCount: number; brandCount: number; recentOrders: Order[];
}) {
  const stats = [
    { label: 'Pendapatan', value: formatPrice(revenue), icon: Wallet, color: 'text-emerald-400' },
    { label: 'Pesanan Sukses', value: String(successCount), icon: TrendingUp, color: 'text-amber-400' },
    { label: 'Menunggu Proses', value: String(pendingCount), icon: Receipt, color: 'text-cyan-400' },
    { label: 'Total Pesanan', value: String(orderCount), icon: Receipt, color: 'text-slate-300' },
    { label: 'Paket Aktif', value: String(packageCount), icon: PackageIcon, color: 'text-amber-400' },
    { label: 'Brand', value: String(brandCount), icon: Layers, color: 'text-slate-300' },
  ];
  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="admin-stat-card glass rounded-2xl p-5">
              <div className="admin-stat-icon mb-4"><Icon className={`w-5 h-5 ${s.color}`} /></div>
              <div className="admin-stat-value font-display text-2xl sm:text-3xl font-bold tabular-nums break-anywhere">{s.value}</div>
              <div className="admin-stat-label text-xs text-slate-400 mt-1.5">{s.label}</div>
              <div className="admin-stat-accent" aria-hidden="true" />
            </div>
          );
        })}
      </div>
      <div className="admin-panel glass rounded-2xl p-4 sm:p-6">
        <h2 className="admin-panel-title font-display font-semibold mb-4 flex items-center gap-2">
          <Receipt className="w-5 h-5 text-amber-400" /> Pesanan Terbaru
        </h2>
        {recentOrders.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-6">Belum ada pesanan.</p>
        ) : (
          <div className="space-y-2">
            {recentOrders.map((o) => (
              <div key={o.id} className="admin-order-row flex items-center gap-3 p-3 rounded-xl glass-soft">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{o.brand?.name} • {o.package?.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span className="font-mono">{o.code}</span>
                    <span title={new Date(o.created_at).toLocaleString('id-ID')}>{new Date(o.created_at).toLocaleString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    <span className={o.status === 'success' ? 'text-emerald-400' : o.status === 'failed' ? 'text-rose-400' : 'text-amber-300'}>
                      {statusLabel(o.status)}
                    </span>
                  </div>
                </div>
                <div className="text-sm font-semibold text-amber-300 shrink-0">{formatPrice(Number(o.total_amount) || o.price)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============ ORDERS ============ */
function OrdersTab({ orders, onStatusChange, onDelete }: { orders: Order[]; onStatusChange: (id: string, status: Order['status']) => Promise<void>; onDelete: (order: Order) => Promise<void> }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const changeStatus = async (order: Order, status: Order['status']) => {
    if (status === order.status) return;
    const transitionLabel: Record<Order['status'], string> = {
      pending: 'Menunggu', processing: 'Diproses', success: 'Berhasil', failed: 'Gagal',
    };
    const verifiedStep = status === 'processing'
      ? 'Pastikan pembayaran sudah benar-benar diterima dan diverifikasi.'
      : status === 'success'
        ? 'Pastikan top-up sudah benar-benar selesai untuk pelanggan.'
        : status === 'failed'
          ? 'Pastikan alasan kegagalan sudah diperiksa. Status final tidak dapat dipulihkan dari panel ini.'
          : 'Perubahan status akan dikirim ke server.';
    if (!window.confirm(`Ubah pesanan ${order.code} menjadi ${transitionLabel[status]}?\n\n${verifiedStep}`)) return;
    setUpdatingId(order.id);
    try { await onStatusChange(order.id, status); } finally { setUpdatingId(null); }
  };

  const filtered = orders.filter((o) => {
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    const q = search.trim().toLowerCase();
    const matchSearch = !q || o.code.toLowerCase().includes(q) || (o.target || '').toLowerCase().includes(q) || (o.brand?.name || '').toLowerCase().includes(q) || (o.package?.name || '').toLowerCase().includes(q);
    const createdDate = o.created_at.slice(0, 10);
    const matchFrom = !dateFrom || createdDate >= dateFrom;
    const matchTo = !dateTo || createdDate <= dateTo;
    return matchStatus && matchSearch && matchFrom && matchTo;
  });

  return (
    <div className="glass rounded-2xl p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <div className="relative sm:col-span-2 xl:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kode order, tujuan, atau brand…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-soft text-sm focus:outline-none focus:border-amber-400/40"
          />
        </div>
        <select
          aria-label="Filter status pesanan"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl glass-soft text-sm focus:outline-none focus:border-amber-400/40"
        >
          <option value="all">Semua status</option>
          <option value="pending">Menunggu</option>
          <option value="processing">Diproses</option>
          <option value="success">Berhasil</option>
          <option value="failed">Gagal</option>
        </select>
        <label className="text-xs text-slate-400 flex flex-col gap-1">
          Dari tanggal
          <input aria-label="Tanggal awal" type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-2.5 rounded-xl glass-soft text-sm" />
        </label>
        <label className="text-xs text-slate-400 flex flex-col gap-1">
          Sampai tanggal
          <input aria-label="Tanggal akhir" type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-2.5 rounded-xl glass-soft text-sm" />
        </label>
      </div>
      {(search || statusFilter !== 'all' || dateFrom || dateTo) && (
        <button type="button" onClick={() => { setSearch(''); setStatusFilter('all'); setDateFrom(''); setDateTo(''); }} className="text-xs text-amber-300 hover:text-amber-200 mb-4 underline underline-offset-4">Reset filter</button>
      )}
      <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 mb-4 text-xs text-amber-100/90">
        Alur manual: <strong>Menunggu → Diproses</strong> setelah transfer benar-benar diverifikasi, lalu <strong>Diproses → Berhasil</strong> hanya setelah top-up selesai. Status final tidak dapat diubah kembali.
      </div>
      <div className="text-xs text-slate-500 mb-3">Menampilkan {filtered.length} dari {orders.length} pesanan</div>
      {filtered.length === 0 ? (
        <p className="text-slate-400 text-sm text-center py-10">Tidak ada pesanan yang cocok.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((o) => (
            <div key={o.id} className="admin-order-row admin-order-row--managed flex items-center gap-3 p-3 rounded-xl glass-soft">
              <div className="admin-order-details flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{o.brand?.name} • {o.package?.name}</div>
                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                  <span className="font-mono">{o.code}</span>
                  <span>Tujuan: <span className="font-mono">{o.target}</span></span>
                  {o.server && <span>Server: <span className="font-mono">{o.server}</span></span>}
                  <span title={new Date(o.created_at).toLocaleString('id-ID')}>Dipesan: {new Date(o.created_at).toLocaleString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  {o.payment_method && <span>via {methodById(o.payment_method)?.name ?? o.payment_method}</span>}
                </div>
              </div>
              <div className="admin-order-actions text-right shrink-0 flex flex-col items-end gap-2">
                <div className="text-sm font-semibold text-amber-300 tabular-nums">{formatPrice(Number(o.total_amount) || o.price)}</div>
                <select
                  aria-label={`Status pesanan ${o.code}`}
                  value={o.status}
                  disabled={updatingId === o.id}
                  onChange={(e) => void changeStatus(o, e.target.value as Order['status'])}
                  className="max-w-[145px] rounded-lg glass-soft px-2 py-1.5 text-xs disabled:opacity-50"
                >
                  <option value="pending" disabled={o.status !== 'pending'}>Menunggu</option>
                  <option value="processing" disabled={o.status !== 'pending' && o.status !== 'processing'}>Diproses</option>
                  <option value="success" disabled={o.status !== 'processing' && o.status !== 'success'}>Berhasil</option>
                  <option value="failed" disabled={o.status === 'success' || o.status === 'failed'}>Gagal</option>
                </select>
                <button type="button" onClick={() => void onDelete(o)} aria-label={`Hapus pesanan ${o.code}`} className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-500/20"><Trash className="w-3.5 h-3.5 inline mr-1" />Hapus</button>
                {o.payment_proof_path && <button type="button" onClick={async () => { const { data, error } = await supabase.storage.from('payment-proofs').createSignedUrl(o.payment_proof_path!, 60); if (error || !data?.signedUrl) { window.alert('Bukti pembayaran tidak dapat dibuka. Pastikan migrasi Phase 37 sudah diterapkan.'); return; } window.open(data.signedUrl, '_blank', 'noopener,noreferrer'); }} className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-200">Lihat bukti</button>}
                {updatingId === o.id && <span className="text-[10px] text-slate-500">Menyimpan…</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


/* ============ SITE MAINTENANCE ============ */
function MaintenanceTab({ enabled, message, saving, available, onMessageChange, onToggle }: { enabled: boolean; message: string; saving: boolean; available: boolean; onMessageChange: (value: string) => void; onToggle: (enabled: boolean) => Promise<void> }) {
  return (
    <section className="glass rounded-2xl p-6 sm:p-8 max-w-3xl">
      <div className="flex items-start gap-4 mb-6">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${enabled ? 'bg-rose-500/15 text-rose-300' : 'bg-emerald-500/15 text-emerald-300'}`}><ShieldAlert className="w-6 h-6" /></div>
        <div className="min-w-0 flex-1"><h2 className="font-display text-xl font-bold">Maintenance seluruh website</h2><p className="text-sm text-slate-400 mt-1">Saat aktif, seluruh website untuk pengunjung ditutup dan hanya menampilkan halaman “Sedang Maintenance”, termasuk beranda, katalog, login/daftar, dashboard pelanggan, checkout, dan cek status pesanan. Hanya dashboard admin yang tetap bisa dibuka untuk mengelola dan menonaktifkan maintenance.</p></div>
      </div>
      {!available && <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 mb-5 text-sm text-amber-100" role="alert"><p className="font-semibold">Database maintenance belum disiapkan</p><p className="mt-1 text-xs leading-relaxed">Tabel <code>public.site_settings</code> belum tersedia atau belum dapat dibaca. Terapkan file <code>supabase/migrations/20261027050000_phase44_site_settings_maintenance_only.sql</code> di Supabase SQL Editor, lalu muat ulang dashboard. Fitur admin lain tetap bisa digunakan.</p></div>}
      <div className={`rounded-xl border p-4 mb-5 ${enabled ? 'border-rose-400/30 bg-rose-500/10' : 'border-emerald-400/25 bg-emerald-500/5'}`} role="status"><p className="font-semibold">Status: {enabled ? 'Maintenance AKTIF' : 'Website ONLINE'}</p><p className="text-xs text-slate-400 mt-1">Perubahan disimpan ke Supabase sehingga berlaku lintas pengunjung/perangkat setelah migration diterapkan.</p></div>
      <label className="block text-sm font-medium mb-2" htmlFor="maintenance-message">Pesan untuk pengunjung</label>
      <textarea id="maintenance-message" disabled={!available} maxLength={240} rows={3} value={message} onChange={(event) => onMessageChange(event.target.value)} className="w-full rounded-xl glass-soft p-3 text-sm focus:outline-none focus:border-amber-400/40" placeholder="Kami sedang melakukan pemeliharaan…" />
      <div className="text-xs text-slate-500 mt-1 mb-5">Maksimal 240 karakter. Pesan ini tampil saat maintenance aktif.</div>
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={!available || saving || enabled} onClick={() => { if (window.confirm('Aktifkan maintenance untuk seluruh pengunjung? Katalog dan checkout akan ditutup sampai dinonaktifkan.')) void onToggle(true); }} className="btn-primary px-4 py-2.5 rounded-xl disabled:opacity-50">{saving ? 'Menyimpan…' : 'Aktifkan Maintenance'}</button>
        <button type="button" disabled={!available || saving || !enabled} onClick={() => { if (window.confirm('Nonaktifkan maintenance dan buka kembali website untuk pengunjung?')) void onToggle(false); }} className="btn-ghost px-4 py-2.5 rounded-xl disabled:opacity-50">Buka Kembali Website</button>
      </div>
      <p className="text-xs text-slate-500 mt-5">Maintenance global ini menutup seluruh halaman website untuk pengunjung; pengecualian hanya /admin. Ini adalah gerbang tampilan aplikasi, bukan firewall API. RLS dan RPC database tetap wajib membatasi akses langsung; jangan menaruh secret key di frontend.</p>
    </section>
  );
}

/* ============ PRODUCTS (Kelola Produk) ============ */
function ProductsTab({
  packages, supplierCosts, brands, categories, onChange,
}: {
  packages: Package[]; supplierCosts: Record<string, number>; brands: Brand[]; categories: TopupCategory[]; onChange: () => Promise<void>;
}) {
  const [subTab, setSubTab] = useState<'packages' | 'brands' | 'categories'>('packages');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => setSubTab('packages')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${subTab === 'packages' ? 'bg-amber-500/15 text-amber-300 border border-amber-400/30' : 'glass-soft text-slate-300'}`}
        >
          <PackageIcon className="w-4 h-4 inline mr-1.5" /> Paket & Nominal
        </button>
        <button
          onClick={() => setSubTab('brands')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${subTab === 'brands' ? 'bg-amber-500/15 text-amber-300 border border-amber-400/30' : 'glass-soft text-slate-300'}`}
        >
          <Tag className="w-4 h-4 inline mr-1.5" /> Brand / Operator
        </button>
        <button
          onClick={() => setSubTab('categories')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${subTab === 'categories' ? 'bg-amber-500/15 text-amber-300 border border-amber-400/30' : 'glass-soft text-slate-300'}`}
        >
          <Layers className="w-4 h-4 inline mr-1.5" /> Katalog / Kategori
        </button>
      </div>
      {subTab === 'packages' ? (
        <PackagesManager packages={packages} supplierCosts={supplierCosts} brands={brands} onChange={onChange} />
      ) : subTab === 'brands' ? (
        <BrandsManager brands={brands} categories={categories} onChange={onChange} />
      ) : (
        <CategoriesManager categories={categories} onChange={onChange} />
      )}
    </div>
  );
}

function PackagesManager({
  packages, supplierCosts, brands, onChange,
}: {
  packages: Package[]; supplierCosts: Record<string, number>; brands: Brand[]; onChange: () => Promise<void>;
}) {
  // Keep the price as text while typing. Converting each keystroke to Number can
  // make mobile numeric inputs jump/reset and prevents reliable multi-digit entry.
  type PackageEditor = Omit<Partial<Package>, 'price'> & { price?: number | string; supplier_cost?: number | string };
  const [editing, setEditing] = useState<PackageEditor | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterBrand, setFilterBrand] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [adjustment, setAdjustment] = useState('10');
  const [bulkPreview, setBulkPreview] = useState<Array<{ id: string; name: string; oldPrice: number; newPrice: number; supplierCost: number | null; newSupplierCost?: number; source: 'adjust' | 'import' }>>([]);
  const [bulkErrors, setBulkErrors] = useState<Array<{ row: number; id: string; message: string }>>([]);
  const [bulkMode, setBulkMode] = useState<'adjust' | 'import' | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkReport, setBulkReport] = useState<Array<{ id: string; name: string; status: string; message: string }>>([]);

  const brandName = (id: string) => brands.find((b) => b.id === id)?.name ?? '—';
  const filtered = filterBrand === 'all' ? packages : packages.filter((p) => p.brand_id === filterBrand);
  const selectedPackages = filtered.filter((p) => selectedIds.includes(p.id));
  const money = (value: number) => `Rp${Math.round(value).toLocaleString('id-ID')}`;
  const downloadCsv = (rows: Array<Record<string, unknown>>, filename: string, columns = ['id', 'brand', 'package_name', 'supplier_cost', 'price']) => {
    const blob = new Blob(['\uFEFF', toCsv(rows, columns)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const exportCsv = () => downloadCsv(packages.map((p) => ({ id: p.id, brand: brandName(p.brand_id), package_name: p.name, supplier_cost: supplierCosts[p.id] == null ? '' : Number(supplierCosts[p.id]), price: p.price })), 'fityorastore-harga-produk.csv');
  const exportSupplierCsv = () => downloadCsv(
    packages.map((p) => ({ id: p.id, brand: brandName(p.brand_id), package_name: p.name, supplier_cost: supplierCosts[p.id] == null ? '' : Number(supplierCosts[p.id]) })),
    'fityorastore-template-modal-supplier.csv',
    ['id', 'brand', 'package_name', 'supplier_cost'],
  );

  const prepareAdjustment = () => {
    const amount = parseRupiah(adjustment);
    if (selectedPackages.length === 0) { window.alert('Pilih minimal satu produk terlebih dahulu.'); return; }
    if (amount === null || amount > 99_999_999) { window.alert('Nominal perubahan harus angka rupiah bulat antara Rp0 dan Rp99.999.999.'); return; }
    const preview = selectedPackages.map((p) => ({ id: p.id, name: `${brandName(p.brand_id)} — ${p.name}`, oldPrice: Number(p.price), newPrice: Number(p.price) + amount, supplierCost: supplierCosts[p.id] ?? null, source: 'adjust' as const }));
    if (preview.some((x) => !Number.isSafeInteger(x.oldPrice) || x.oldPrice < 0 || x.newPrice > 99_999_999)) { window.alert('Ada harga yang tidak valid atau melewati batas maksimum.'); return; }
    setBulkErrors([]); setBulkReport([]); setBulkMode('adjust'); setBulkPreview(preview);
  };

  const importCsv = async (file?: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) { window.alert('Pilih file .csv. Untuk Excel, gunakan Save As → CSV UTF-8 terlebih dahulu.'); return; }
    try {
      const rows = parseCsv(await file.text());
      const known = new Map(packages.map((p) => [p.id, p]));
      const seen = new Set<string>();
      const preview: typeof bulkPreview = [];
      const errors: typeof bulkErrors = [];
      rows.forEach((row, index) => {
        const line = index + 2;
        const id = row.id ?? '';
        if (!id) { errors.push({ row: line, id: '', message: 'Kolom id wajib diisi; ekspor template dari dashboard terlebih dahulu.' }); return; }
        if (seen.has(id)) { errors.push({ row: line, id, message: 'ID produk duplikat dalam CSV.' }); return; }
        seen.add(id);
        const existing = known.get(id);
        if (!existing) { errors.push({ row: line, id, message: 'ID tidak ditemukan pada katalog saat ini.' }); return; }
        let newSupplierCost: number | undefined;
        if (String(row.supplier_cost ?? '').trim() !== '') {
          const parsedSupplierCost = parseRupiah(row.supplier_cost);
          if (parsedSupplierCost === null || parsedSupplierCost > 99_999_999) { errors.push({ row: line, id, message: 'Harga modal supplier tidak valid.' }); return; }
          newSupplierCost = parsedSupplierCost;
        }
        const rawPrice = String(row.price ?? '').trim();
        const price = rawPrice === '' && newSupplierCost !== undefined
          ? Math.round(newSupplierCost * 1.07)
          : parseRupiah(rawPrice);
        if (price === null || price > 99_999_999) {
          errors.push({ row: line, id, message: 'Isi harga jual, atau isi harga modal supplier agar harga jual dihitung otomatis dengan markup 7%.' });
          return;
        }
        preview.push({ id, name: `${brandName(existing.brand_id)} — ${existing.name}`, oldPrice: Number(existing.price), newPrice: price, supplierCost: supplierCosts[existing.id] ?? null, ...(newSupplierCost === undefined ? {} : { newSupplierCost }), source: 'import' });
      });
      setBulkErrors(errors); setBulkReport([]); setBulkMode('import'); setBulkPreview(preview);
      if (!preview.length) window.alert(`Tidak ada baris valid untuk dipratinjau. ${errors.length} baris bermasalah.`);
    } catch (error) {
      window.alert(`CSV tidak dapat dibaca: ${error instanceof Error ? error.message : 'format tidak valid'}`);
    }
  };

  const applyBulk = async () => {
    if (!bulkMode || bulkPreview.length === 0) return;
    const invalid = bulkPreview.some((r) => !Number.isSafeInteger(r.newPrice) || r.newPrice < 0 || r.newPrice > 99_999_999 || (r.newSupplierCost !== undefined && (!Number.isSafeInteger(r.newSupplierCost) || r.newSupplierCost < 0 || r.newSupplierCost > 99_999_999)));
    if (invalid) { window.alert('Pratinjau berisi harga tidak valid. Tidak ada perubahan yang disimpan.'); return; }
    const label = bulkMode === 'adjust' ? `mengubah harga ${bulkPreview.length} produk` : `mengimpor harga ${bulkPreview.length} produk`;
    if (!window.confirm(`Konfirmasi: ${label}?\\n\\nSeluruh baris valid akan disimpan dalam satu transaksi. Jika satu baris gagal, seluruh batch dibatalkan.`)) return;

    setBulkBusy(true);
    const invalidRows = bulkErrors.map((e) => ({ id: e.id || `baris ${e.row}`, name: `Baris ${e.row}`, status: 'Gagal', message: e.message }));
    const payload = bulkPreview.map((item) => ({
      id: item.id,
      price: item.newPrice,
      ...(item.newSupplierCost === undefined ? {} : { supplier_cost: item.newSupplierCost }),
    }));
    try {
      const { data, error } = await supabase.rpc('admin_apply_package_pricing_batch', { p_items: payload });
      if (error) {
        const failure = bulkPreview.map((item) => ({
          id: item.id, name: item.name, status: 'Gagal',
          message: `Batch dibatalkan oleh database: ${error.message}. Periksa koneksi dan data sebelum mencoba ulang.`,
        }));
        setBulkReport([...invalidRows, ...failure]);
        setSelectedIds(bulkPreview.map((item) => item.id));
      } else {
        type SavedBulkRow = { package_id: string; price: number; supplier_cost: number | null };
        const savedRows = (Array.isArray(data) ? data : data ? [data] : []) as SavedBulkRow[];
        const savedById = new Map<string, SavedBulkRow>(savedRows.map((row) => [row.package_id, row]));
        const report = bulkPreview.map((item) => {
          const saved = savedById.get(item.id) as { price?: number; supplier_cost?: number | null } | undefined;
          const matches = Boolean(saved)
            && Number(saved?.price) === item.newPrice
            && (item.newSupplierCost === undefined || Number(saved?.supplier_cost) === item.newSupplierCost);
          return matches
            ? { id: item.id, name: item.name, status: 'Berhasil', message: `Harga jual ${money(item.newPrice)}${item.newSupplierCost === undefined ? '' : `; modal ${money(item.newSupplierCost)}`}` }
            : { id: item.id, name: item.name, status: 'Gagal', message: 'Hasil RPC tidak cocok dengan pratinjau. Muat ulang katalog dan periksa Supabase sebelum mengulangi batch.' };
        });
        setBulkReport([...invalidRows, ...report]);
        setSelectedIds(report.filter((item) => item.status !== 'Berhasil').map((item) => item.id));
      }
      try {
        await onChange();
      } catch (refreshError) {
        setBulkReport((previous) => [...previous, {
          id: 'catalog-refresh', name: 'Refresh katalog', status: 'Gagal',
          message: refreshError instanceof Error ? refreshError.message : 'Batch diproses, tetapi katalog gagal dimuat ulang. Refresh sebelum operasi berikutnya.',
        }]);
      }
    } catch (error) {
      setBulkReport([...invalidRows, ...bulkPreview.map((item) => ({
        id: item.id, name: item.name, status: 'Gagal',
        message: `Respons batch tidak pasti: ${error instanceof Error ? error.message : 'Kesalahan koneksi'}. Muat ulang katalog sebelum mengulangi proses.`,
      }))]);
      try { await onChange(); } catch { /* Keep the uncertainty report visible. */ }
    } finally {
      setBulkBusy(false);
    }
  };

  const exportReport = () => downloadCsv(bulkReport.map((r) => ({ id: r.id, package_name: r.name, status: r.status, message: r.message })), 'fityorastore-laporan-harga-massal.csv', ['id', 'package_name', 'status', 'message']);

  const saveSupplierCostOnly = async () => {
    if (saving || !editing?.id) return;
    const packageId = editing.id;
    const supplierCost = parseRupiah(String(editing.supplier_cost ?? '').trim());
    if (supplierCost === null || supplierCost > 99_999_999) {
      window.alert('Masukkan harga modal supplier aktual berupa angka bulat Rp0–Rp99.999.999.');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('admin_upsert_package_supplier_cost', {
        p_package_id: packageId,
        p_supplier_cost: supplierCost,
      });
      const saved = Array.isArray(data) ? data[0] : data;
      if (error || !saved || saved.package_id !== packageId || Number(saved.supplier_cost) !== supplierCost) {
        window.alert(`Harga modal gagal disimpan: ${error?.message ?? 'Hasil database tidak cocok dengan input.'}`);
        return;
      }
      setEditing((current) => current ? { ...current, supplier_cost: String(saved.supplier_cost) } : current);
      await onChange();
      window.alert('Harga modal supplier berhasil disimpan. Harga jual paket tetap.');
    } catch (error) {
      window.alert(`Koneksi gagal saat menyimpan harga modal: ${error instanceof Error ? error.message : 'Kesalahan tidak diketahui.'}`);
    } finally {
      setSaving(false);
    }
  };

  const saveSupplierAndUpdatePrice = async () => {
    if (saving || !editing?.id) return;
    const packageId = editing.id;
    const supplierCost = parseRupiah(String(editing.supplier_cost ?? '').trim());
    if (supplierCost === null || supplierCost > 99_999_999) {
      window.alert('Masukkan harga modal supplier aktual berupa angka bulat Rp0–Rp99.999.999.');
      return;
    }
    const estimatedPrice = Math.round(supplierCost * 1.07);
    if (!Number.isSafeInteger(estimatedPrice) || estimatedPrice > 99_999_999) {
      window.alert('Hasil perhitungan harga jual melewati batas maksimum.');
      return;
    }
    const currentPrice = Number(editing.price ?? 0);
    if (!window.confirm(
      `Perbarui harga supplier dan harga jual produk ini?\n\nModal supplier: ${money(supplierCost)}\nHarga jual lama: ${money(currentPrice)}\nHarga jual baru (modal + 7%): ${money(estimatedPrice)}\n\nHarga jual hanya berubah setelah Anda menyetujuinya.`
    )) return;

    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('admin_update_supplier_cost_and_price', { p_package_id: packageId, p_supplier_cost: supplierCost });
      const saved = Array.isArray(data) ? data[0] : data;
      if (error || !saved || saved.package_id !== packageId || Number(saved.supplier_cost) !== supplierCost || Number(saved.new_price) !== estimatedPrice) {
        window.alert(`Modal/harga jual gagal diverifikasi: ${error?.message ?? 'Nilai database tidak cocok dengan pratinjau.'}`);
        return;
      }
      setEditing((current) => current ? { ...current, supplier_cost: String(saved.supplier_cost), price: String(saved.new_price) } : current);
      await onChange();
      window.alert(`Berhasil. Harga jual diperbarui menjadi ${money(estimatedPrice)} dengan markup 7% atas modal dan tercatat di audit harga.`);
    } catch (error) {
      window.alert(`Koneksi gagal saat memperbarui modal dan harga jual: ${error instanceof Error ? error.message : 'Kesalahan tidak diketahui.'}`);
    } finally { setSaving(false); }
  };

  const save = async () => {
    if (saving) return;
    if (!editing || !editing.brand_id || !editing.name?.trim()) {
      window.alert('Pilih brand dan isi nama paket terlebih dahulu.');
      return;
    }
    if (editing.name.trim().length > 160 || (editing.description?.length ?? 0) > 2000) {
      window.alert('Nama paket maksimal 160 karakter dan deskripsi maksimal 2.000 karakter.');
      return;
    }
    const price = parseRupiah(String(editing.price ?? '').trim());
    if (price === null) {
      window.alert('Harga paket harus berupa angka bulat Rp0–Rp99.999.999.');
      return;
    }
    const supplierCostInput = String(editing.supplier_cost ?? '').trim();
    const supplierCost = supplierCostInput === '' ? null : parseRupiah(supplierCostInput);
    if (supplierCostInput !== '' && (supplierCost === null || supplierCost > 99_999_999)) {
      window.alert('Harga modal supplier harus berupa angka bulat Rp0–Rp99.999.999, atau kosong bila belum dicatat.');
      return;
    }
    const expectedSavedSupplierCost = supplierCost ?? (editing.id ? supplierCosts[editing.id] ?? null : null);
    const sortOrder = readSortOrder(editing.sort_order);
    if (sortOrder === null) {
      window.alert('Urutan paket harus berupa bilangan bulat non-negatif.');
      return;
    }

    setSaving(true);
    try {
      // Phase 57 keeps package metadata and selling price atomic. A blank supplier cost
      // remains unrecorded; it is never converted to Rp0 or copied from the selling price.
      const { data, error } = await supabase.rpc('admin_save_package', {
        p_package_id: editing.id ?? null,
        p_brand_id: editing.brand_id,
        p_name: editing.name.trim(),
        p_description: editing.description?.trim() ?? '',
        p_price: price,
        p_sort_order: sortOrder,
        p_featured: editing.featured ?? false,
        p_supplier_cost: supplierCost,
      });
      const saved = Array.isArray(data) ? data[0] : data;
      if (error || !saved || !saved.saved_package_id) {
        window.alert(`Paket dan harga gagal disimpan: ${error?.message ?? 'Database tidak mengembalikan hasil. Tidak ada perubahan yang dianggap berhasil.'}`);
        return;
      }
      if (Number(saved.saved_price) !== price || (saved.saved_supplier_cost == null ? null : Number(saved.saved_supplier_cost)) !== expectedSavedSupplierCost) {
        setEditing(null);
        await onChange();
        window.alert('Permintaan tersimpan, tetapi nilai yang dikembalikan tidak cocok dengan input. Katalog sudah dimuat ulang; periksa harga yang tampil dan Supabase sebelum mencoba menyimpan lagi.');
        return;
      }
      const wasEditing = Boolean(editing.id);
      setEditing(null);
      await onChange();
      window.alert(`Paket berhasil ${wasEditing ? 'diperbarui' : 'ditambahkan'} dengan harga Rp${price.toLocaleString('id-ID')}.`);
    } catch (err) {
      // A timeout may occur after a commit. Preserve the form so the admin does not lose data;
      // explicitly warn them not to resubmit until the catalog has been checked.
      try { await onChange(); } catch { /* loadAll also reports its own error */ }
      window.alert(`Respons penyimpanan paket tidak pasti: ${err instanceof Error ? err.message : 'Kesalahan koneksi yang tidak diketahui.'}. Form tetap terbuka agar input tidak hilang. Periksa katalog dan Supabase sebelum mencoba menyimpan lagi; jangan kirim ulang jika paket sudah muncul.`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      const linkedOrders = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('package_id', id);
      if (linkedOrders.error) {
        window.alert(`Riwayat paket tidak dapat diperiksa: ${linkedOrders.error.message}`);
        return;
      }
      if ((linkedOrders.count ?? 0) > 0) {
        window.alert(`Paket ini dipakai oleh ${linkedOrders.count} pesanan. Sembunyikan dari katalog atau pertahankan datanya agar riwayat transaksi tetap aman.`);
        return;
      }
      if (!confirm('Hapus paket ini dari katalog? Tindakan ini tidak dapat dibatalkan.')) return;
      const { data, error } = await supabase.from('packages').delete().eq('id', id).select('id').maybeSingle();
      if (error || !data) {
        window.alert(`Paket tidak terhapus: ${error?.message ?? 'Database tidak menghapus baris apa pun. Periksa izin dan muat ulang.'}`);
        return;
      }
      window.alert('Paket berhasil dihapus dari katalog.');
      await onChange();
    } catch (err) {
      window.alert(`Paket gagal diproses: ${err instanceof Error ? err.message : 'Kesalahan koneksi.'}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select
            value={filterBrand}
            onChange={(e) => setFilterBrand(e.target.value)}
            className="px-3 py-2 rounded-lg glass-soft text-sm focus:outline-none focus:border-amber-400/40"
          >
            <option value="all">Semua brand</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <span className="text-sm text-slate-400">{filtered.length} paket</span>
        </div>
        <button
          onClick={() => setEditing({ name: '', price: 0, supplier_cost: '', sort_order: 0, featured: false, brand_id: brands[0]?.id })}
          className="btn-primary px-4 py-2 rounded-lg text-sm flex items-center gap-1.5 justify-center"
        >
          <Plus className="w-4 h-4" /> Tambah Paket
        </button>
      </div>
      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div><h3 className="font-semibold">Manajemen Harga Massal</h3><p className="text-xs text-slate-400 mt-1">Harga modal supplier dipisahkan dari harga jual. Semua perubahan ditinjau sebelum disimpan.</p></div>
          <div className="flex flex-wrap gap-2">
            <button onClick={exportCsv} className="btn-ghost px-3 py-2 rounded-lg text-xs flex items-center gap-1.5"><Download className="w-4 h-4"/> Ekspor CSV / Excel</button>
            <button onClick={exportSupplierCsv} className="btn-ghost px-3 py-2 rounded-lg text-xs flex items-center gap-1.5"><Download className="w-4 h-4"/> Template Modal Supplier</button>
            <label className="btn-ghost px-3 py-2 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer"><Upload className="w-4 h-4"/> Impor CSV<input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { void importCsv(e.target.files?.[0]); e.currentTarget.value = ''; }}/></label>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1"><label className="block text-xs text-slate-400 mb-1" htmlFor="bulk-adjustment">Tambahkan ke harga jual terpilih (Rp)</label><input id="bulk-adjustment" type="number" min="0" max="100000000" step="1" value={adjustment} onChange={(e) => setAdjustment(e.target.value)} className="inp" /></div>
          <button onClick={() => setSelectedIds(selectedIds.length === filtered.length ? [] : filtered.map((p) => p.id))} className="btn-ghost px-3 py-2.5 rounded-lg text-sm">{filtered.length > 0 && filtered.every((p) => selectedIds.includes(p.id)) ? 'Batalkan pilih semua' : 'Pilih semua hasil filter'}</button>
          <button onClick={prepareAdjustment} className="btn-primary px-4 py-2.5 rounded-lg text-sm flex items-center justify-center gap-1.5"><CheckSquare className="w-4 h-4"/> Pratinjau perubahan ({selectedPackages.length})</button>
        </div>
        <p className="text-xs text-amber-200/80">Catatan: nilai awal Rp10 sesuai instruksi Anda. Itu berarti sepuluh rupiah, bukan Rp10.000. Ubah nilainya sebelum pratinjau bila yang dimaksud berbeda.</p>
      </div>
      <div className="glass rounded-2xl divide-y divide-white/5">
        {filtered.map((p) => (
          <div key={p.id} className="flex items-center gap-3 p-4">
            <button type="button" onClick={() => setSelectedIds((prev) => prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id])} aria-label={selectedIds.includes(p.id) ? `Batalkan pilihan ${p.name}` : `Pilih ${p.name}`} className="text-slate-400 hover:text-amber-300">{selectedIds.includes(p.id) ? <CheckSquare className="w-5 h-5 text-amber-300"/> : <Square className="w-5 h-5"/>}</button>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm flex items-center gap-2">
                {p.name}
                {p.featured && <span className="px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 text-[10px] font-bold uppercase">Populer</span>}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">{brandName(p.brand_id)} • #{p.sort_order}</div>
            </div>
            <div className="text-right shrink-0"><div className="text-sm font-semibold text-amber-300">{formatPrice(p.price)}</div><div className="text-[10px] text-slate-500">{supplierCosts[p.id] == null ? 'Modal belum diisi' : `Modal ${formatPrice(Number(supplierCosts[p.id]))} · Margin ${formatPrice(Number(p.price) - Number(supplierCosts[p.id]))}`}</div></div>
            <div className="flex gap-1 shrink-0">
              <button aria-label={`Edit paket ${p.name}`} onClick={() => setEditing({ ...p, supplier_cost: supplierCosts[p.id] ?? '' })} className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-amber-300 transition"><Pencil className="w-4 h-4" /></button>
              <button aria-label={`Hapus paket ${p.name}`} onClick={() => remove(p.id)} className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-rose-300 transition"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-slate-400 text-sm text-center py-8">Belum ada paket.</p>}
      </div>

      {bulkMode && (
        <Modal title={bulkMode === 'adjust' ? 'Pratinjau Perubahan Harga' : 'Pratinjau Impor Harga CSV'} onClose={() => { if (!bulkBusy) { setBulkMode(null); setBulkPreview([]); } }}>
          <div className="text-sm text-slate-300 space-y-1"><p><strong>{bulkPreview.length}</strong> produk valid untuk diproses.</p><p><strong>{bulkErrors.length}</strong> baris bermasalah akan dilewati dan masuk laporan.</p><p className="text-amber-200">Belum ada harga yang berubah. Perubahan hanya diterapkan setelah tombol konfirmasi.</p></div>
          {bulkErrors.length > 0 && <div className="max-h-32 overflow-auto rounded-lg border border-rose-400/20 p-3 text-xs text-rose-200 space-y-1">{bulkErrors.slice(0, 30).map((e, i) => <p key={`${e.row}-${i}`}>Baris {e.row} ({e.id || 'tanpa ID'}): {e.message}</p>)}{bulkErrors.length > 30 && <p>Dan {bulkErrors.length - 30} baris lain.</p>}</div>}
          <div className="max-h-64 overflow-auto rounded-lg border border-white/10"><table className="w-full text-xs"><thead className="sticky top-0 bg-slate-900"><tr><th className="p-2 text-left">Produk</th><th className="p-2 text-right">Harga lama</th><th className="p-2 text-right">Harga baru</th><th className="p-2 text-right">Modal</th></tr></thead><tbody>{bulkPreview.map((r) => <tr key={r.id} className="border-t border-white/5"><td className="p-2">{r.name}</td><td className="p-2 text-right">{money(r.oldPrice)}</td><td className="p-2 text-right text-amber-200">{money(r.newPrice)}</td><td className="p-2 text-right">{r.newSupplierCost !== undefined ? money(r.newSupplierCost) : r.supplierCost === null ? 'Belum diisi' : money(r.supplierCost)}</td></tr>)}</tbody></table></div>
          {!bulkBusy && bulkReport.length === 0 && <div className="flex gap-2"><button onClick={() => { setBulkMode(null); setBulkPreview([]); }} className="btn-ghost px-4 py-2 rounded-lg flex-1">Batal</button><button onClick={() => void applyBulk()} disabled={!bulkPreview.length} className="btn-primary px-4 py-2 rounded-lg flex-1 disabled:opacity-50">Konfirmasi & Simpan</button></div>}
          {bulkBusy && <p className="text-sm text-amber-200">Menyimpan perubahan dan memeriksa hasil…</p>}
          {bulkReport.length > 0 && <div className="space-y-2"><p className="font-semibold">Laporan hasil: {bulkReport.filter((r) => r.status === 'Berhasil').length} berhasil, {bulkReport.filter((r) => r.status === 'Gagal').length} gagal.</p><div className="max-h-36 overflow-auto text-xs space-y-1">{bulkReport.map((r, i) => <p key={`${r.id}-${i}`} className={r.status === 'Berhasil' ? 'text-emerald-300' : 'text-rose-300'}>{r.status} — {r.name}: {r.message}</p>)}</div><button onClick={exportReport} className="btn-ghost px-3 py-2 rounded-lg text-sm flex items-center gap-2"><Download className="w-4 h-4"/> Unduh laporan CSV</button><button onClick={() => { setBulkMode(null); setBulkPreview([]); setBulkErrors([]); setBulkReport([]); }} className="btn-primary px-4 py-2 rounded-lg w-full">Selesai</button></div>}
        </Modal>
      )}

      {editing && (
        <Modal title={editing.id ? 'Edit Paket' : 'Tambah Paket'} onClose={() => { if (!saving) setEditing(null); }}>
          <Field label="Brand">
            <select
              value={editing.brand_id ?? ''}
              onChange={(e) => setEditing({ ...editing, brand_id: e.target.value })}
              className="inp"
            >
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Nama Paket">
            <input maxLength={160} value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="inp" placeholder="mis. 86 Diamonds" />
          </Field>
          <Field label="Deskripsi (opsional)">
            <input maxLength={2000} value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="inp" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Harga modal supplier (Rp)">
              <input type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" value={String(editing.supplier_cost ?? '')} onChange={(e) => setEditing({ ...editing, supplier_cost: e.target.value.replace(/[^\d]/g, '') })} className="inp" aria-label="Harga modal supplier dalam rupiah" placeholder="Kosong jika belum ada data" />
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">Paket baru: kosong berarti belum dicatat. Paket lama: kosong mempertahankan modal tersimpan. Masukkan 0 hanya jika harga supplier memang Rp0.</p>
            </Field>
            <Field label="Harga jual (Rp)">
              <input type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" value={String(editing.price ?? '')} onChange={(e) => setEditing({ ...editing, price: e.target.value.replace(/[^\d]/g, '') })} className="inp" aria-label="Harga paket dalam rupiah" placeholder="Contoh: 15000" />
            </Field>
            <Field label="Urutan">
              <input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} className="inp" />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={editing.featured ?? false} onChange={(e) => setEditing({ ...editing, featured: e.target.checked })} className="accent-amber-400" />
            Tandai sebagai populer
          </label>
          {editing.id && (
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-3 space-y-2">
              <div>
                <p className="text-sm font-semibold text-cyan-100">Simpan harga modal saja</p>
                <p className="text-xs text-slate-400 mt-1">Aksi ini hanya mengubah harga modal supplier. Harga jual paket tidak dikirim dan tidak diubah.</p>
              </div>
              <button type="button" disabled={saving} onClick={() => void saveSupplierCostOnly()} className="w-full rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 hover:bg-cyan-400/15 disabled:opacity-50">
                {saving ? 'Menyimpan…' : 'Simpan Modal Saja — Harga Jual Tetap'}
              </button>
              <button type="button" disabled={saving} onClick={() => void saveSupplierAndUpdatePrice()} className="w-full rounded-xl border border-amber-300/30 bg-amber-400/10 px-4 py-2.5 text-sm font-semibold text-amber-100 hover:bg-amber-400/15 disabled:opacity-50">
                {saving ? 'Menyimpan…' : 'Simpan Modal + Perbarui Harga Jual (7%)'}
              </button>
            </div>
          )}
          <SaveBar saving={saving} onSave={save} onCancel={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  );
}

function BrandsManager({
  brands, categories, onChange,
}: {
  brands: Brand[]; categories: TopupCategory[]; onChange: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<Partial<Brand> | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterCat, setFilterCat] = useState<string>('all');

  const catName = (id: string) => categories.find((c) => c.id === id)?.label ?? '—';
  const filtered = filterCat === 'all' ? brands : brands.filter((b) => b.category_id === filterCat);

  const save = async () => {
    if (saving) return;
    if (!editing || !editing.name?.trim() || !editing.category_id) {
      window.alert('Nama brand dan kategori wajib diisi.');
      return;
    }
    if (editing.name.trim().length > 100 || (editing.server_label?.trim().length ?? 0) > 80) {
      window.alert('Nama brand maksimal 100 karakter dan label server maksimal 80 karakter.');
      return;
    }
    const imageUrl = editing.image_url?.trim() ?? '';
    if (!isSafeMediaUrl(imageUrl)) {
      window.alert('Logo URL harus berupa URL HTTPS yang valid atau path lokal website (mis. /icons/game.svg).');
      return;
    }
    const sortOrder = readSortOrder(editing.sort_order);
    if (sortOrder === null) { window.alert('Urutan brand harus berupa bilangan bulat non-negatif.'); return; }
    setSaving(true);
    try {
      const slug = normalizeSlug(editing.slug?.trim() || editing.name);
      if (!slug) {
        window.alert('Slug brand tidak valid.');
        return;
      }
      const payload = {
        name: editing.name.trim(), slug, category_id: editing.category_id,
        image_url: imageUrl,
        requires_server: editing.requires_server ?? false,
        server_label: editing.server_label?.trim() ?? '',
        sort_order: sortOrder,
      };
      const result = editing.id
        ? await supabase.from('brands').update(payload).eq('id', editing.id).select('id').maybeSingle()
        : await supabase.from('brands').insert(payload).select('id').maybeSingle();
      if (result.error || !result.data) {
        window.alert(`Brand/operator gagal disimpan: ${result.error?.message ?? 'Tidak ada baris yang berubah. Periksa sesi dan izin admin.'}`);
        return;
      }
      setEditing(null);
      await onChange();
    } catch (err) {
      window.alert(`Brand/operator gagal disimpan: ${err instanceof Error ? err.message : 'Kesalahan tidak diketahui.'}`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      const linkedOrders = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('brand_id', id);
      if (linkedOrders.error) {
        window.alert(`Riwayat brand tidak dapat diperiksa: ${linkedOrders.error.message}`);
        return;
      }
      if ((linkedOrders.count ?? 0) > 0) {
        window.alert(`Brand ini dipakai oleh ${linkedOrders.count} pesanan. Jangan hapus; pertahankan agar riwayat transaksi tetap aman.`);
        return;
      }
      if (!confirm('Hapus brand/operator beserta paket terkait? Tindakan ini tidak dapat dibatalkan.')) return;
      const { data, error } = await supabase.from('brands').delete().eq('id', id).select('id').maybeSingle();
      if (error || !data) {
        window.alert(`Brand/operator tidak terhapus: ${error?.message ?? 'Database tidak menghapus baris apa pun. Periksa izin dan muat ulang.'}`);
        return;
      }
      window.alert('Brand/operator dan paket terkait berhasil dihapus.');
      await onChange();
    } catch (err) {
      window.alert(`Brand/operator gagal diproses: ${err instanceof Error ? err.message : 'Kesalahan koneksi.'}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="px-3 py-2 rounded-lg glass-soft text-sm focus:outline-none focus:border-amber-400/40"
          >
            <option value="all">Semua kategori</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <span className="text-sm text-slate-400">{filtered.length} brand</span>
        </div>
        <button
          onClick={() => setEditing({ name: '', image_url: '', requires_server: false, server_label: '', sort_order: 0, category_id: categories[0]?.id })}
          className="btn-primary px-4 py-2 rounded-lg text-sm flex items-center gap-1.5 justify-center"
        >
          <Plus className="w-4 h-4" /> Tambah Brand
        </button>
      </div>
      <div className="glass rounded-2xl divide-y divide-white/5">
        {filtered.map((b) => (
          <div key={b.id} className="flex items-center gap-3 p-4">
            <BrandLogo brand={b} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{b.name}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {catName(b.category_id)} • #{b.sort_order}
                {b.requires_server && <span className="ml-2 text-cyan-300">Perlu {b.server_label || 'Server'}</span>}
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <button aria-label={`Edit brand ${b.name}`} onClick={() => setEditing(b)} className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-amber-300 transition"><Pencil className="w-4 h-4" /></button>
              <button aria-label={`Hapus brand ${b.name}`} onClick={() => remove(b.id)} className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-rose-300 transition"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-slate-400 text-sm text-center py-8">Belum ada brand.</p>}
      </div>

      {editing && (
        <Modal title={editing.id ? 'Edit Brand' : 'Tambah Brand'} onClose={() => { if (!saving) setEditing(null); }}>
          <Field label="Kategori">
            <select value={editing.category_id ?? ''} onChange={(e) => setEditing({ ...editing, category_id: e.target.value })} className="inp">
              {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Nama Brand">
            <input maxLength={100} value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="inp" placeholder="mis. Mobile Legends" />
          </Field>
          <Field label="Logo URL (opsional)">
            <input maxLength={2048} value={editing.image_url ?? ''} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} className="inp" placeholder="https://alamat-sumber-online/logo.svg" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Urutan">
              <input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} className="inp" />
            </Field>
            <Field label="Label Server (jika perlu)">
              <input value={editing.server_label ?? ''} onChange={(e) => setEditing({ ...editing, server_label: e.target.value })} className="inp" placeholder="Server ID" />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={editing.requires_server ?? false} onChange={(e) => setEditing({ ...editing, requires_server: e.target.checked })} className="accent-amber-400" />
            Wajib input server (untuk game)
          </label>
          <SaveBar saving={saving} onSave={save} onCancel={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  );
}

/* ============ CATEGORIES / CATALOGUE ============ */
function CategoriesManager({
  categories, onChange,
}: {
  categories: TopupCategory[]; onChange: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<Partial<TopupCategory> | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    if (!editing?.label?.trim()) {
      window.alert('Nama kategori wajib diisi.');
      return;
    }
    if (editing.label.trim().length > 80 || (editing.icon?.trim().length ?? 0) > 64) {
      window.alert('Nama kategori maksimal 80 karakter dan nama ikon maksimal 64 karakter.');
      return;
    }
    const slug = normalizeSlug(editing.slug?.trim() || editing.label);
    if (!slug) {
      window.alert('Slug kategori tidak valid.');
      return;
    }
    const sortOrder = readSortOrder(editing.sort_order);
    if (sortOrder === null) { window.alert('Urutan kategori harus berupa bilangan bulat non-negatif.'); return; }
    setSaving(true);
    const payload = {
      label: editing.label.trim(),
      slug,
      icon: editing.icon?.trim() || 'Gamepad2',
      accent: editing.accent || '#f5b301',
      sort_order: sortOrder,
    };
    try {
      const result = editing.id
        ? await supabase.from('topup_categories').update(payload).eq('id', editing.id).select('id').maybeSingle()
        : await supabase.from('topup_categories').insert(payload).select('id').maybeSingle();
      if (result.error || !result.data) {
        window.alert(`Kategori gagal disimpan: ${result.error?.message ?? 'Tidak ada baris yang berubah. Periksa izin dan muat ulang.'}`);
        return;
      }
      setEditing(null);
      await onChange();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan yang tidak diketahui.';
      window.alert(`Kategori gagal disimpan: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (category: TopupCategory) => {
    try {
      const linkedBrands = await supabase.from('brands').select('id', { count: 'exact', head: true }).eq('category_id', category.id);
      const linkedOrders = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('category_id', category.id);
      if (linkedBrands.error || linkedOrders.error) {
        window.alert(`Tidak bisa memeriksa relasi kategori: ${linkedBrands.error?.message || linkedOrders.error?.message}`);
        return;
      }
      const brandCount = linkedBrands.count ?? 0;
      const orderCount = linkedOrders.count ?? 0;
      const warning = orderCount > 0
        ? `Kategori ini terkait dengan ${orderCount} pesanan. Hapus kategori tidak diizinkan agar riwayat transaksi tetap aman.`
        : `Kategori ${category.label} beserta ${brandCount} brand dan paket terkait akan dihapus. Tindakan ini tidak dapat dibatalkan.`;
      if (orderCount > 0) {
        window.alert(warning);
        return;
      }
      if (!confirm(warning + '\n\nLanjutkan penghapusan?')) return;
      const { data, error } = await supabase.from('topup_categories').delete().eq('id', category.id).select('id').maybeSingle();
      if (error || !data) {
        window.alert(`Kategori tidak terhapus: ${error?.message ?? 'Tidak ada baris yang berubah. Periksa izin dan muat ulang.'}`);
        return;
      }
      window.alert('Kategori dan katalog terkait berhasil dihapus.');
      await onChange();
    } catch (err) {
      window.alert(`Kategori gagal diproses: ${err instanceof Error ? err.message : 'Kesalahan koneksi.'}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Katalog & Kategori</h3>
          <p className="text-xs text-slate-400 mt-1">Hapus kategori juga menghapus brand dan paket terkait. Riwayat pesanan dilindungi.</p>
        </div>
        <button onClick={() => setEditing({ label: '', slug: '', icon: 'Gamepad2', accent: '#f5b301', sort_order: 0 })} className="btn-primary px-4 py-2 rounded-lg text-sm flex items-center gap-1.5 justify-center">
          <Plus className="w-4 h-4" /> Tambah Kategori
        </button>
      </div>
      <div className="glass rounded-2xl divide-y divide-white/5">
        {categories.map((category) => (
          <div key={category.id} className="flex items-center gap-3 p-4">
            <span className="w-3 h-10 rounded-full shrink-0" style={{ background: category.accent }} />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{category.label}</div>
              <div className="text-xs text-slate-500 mt-0.5">/{category.slug} · ikon {category.icon} · urutan #{category.sort_order}</div>
            </div>
            <div className="flex gap-1 shrink-0">
              <button aria-label={`Edit kategori ${category.label}`} onClick={() => setEditing(category)} className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-amber-300 transition"><Pencil className="w-4 h-4" /></button>
              <button aria-label={`Hapus kategori ${category.label}`} onClick={() => void remove(category)} className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-rose-300 transition"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        {categories.length === 0 && <p className="text-slate-400 text-sm text-center py-8">Belum ada kategori katalog.</p>}
      </div>
      {editing && (
        <Modal title={editing.id ? 'Edit Kategori' : 'Tambah Kategori'} onClose={() => { if (!saving) setEditing(null); }}>
          <Field label="Nama kategori"><input maxLength={80} value={editing.label ?? ''} onChange={(e) => setEditing({ ...editing, label: e.target.value })} className="inp" placeholder="mis. Game Mobile" /></Field>
          <Field label="Slug (alamat/kode unik)"><input maxLength={120} value={editing.slug ?? ''} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} className="inp" placeholder="mis. game-mobile" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nama ikon"><input value={editing.icon ?? 'Gamepad2'} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} className="inp" placeholder="Gamepad2" /></Field>
            <Field label="Urutan"><input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} className="inp" /></Field>
          </div>
          <Field label="Warna aksen"><input type="color" value={editing.accent ?? '#f5b301'} onChange={(e) => setEditing({ ...editing, accent: e.target.value })} className="inp h-11" /></Field>
          <SaveBar saving={saving} onSave={save} onCancel={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  );
}

/* ============ PROMOS ============ */
function PromosTab({ promos, onChange }: { promos: PromoBanner[]; onChange: () => Promise<void> }) {
  const [editing, setEditing] = useState<Partial<PromoBanner> | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    if (!editing || !editing.title?.trim()) {
      window.alert('Judul promo wajib diisi.');
      return;
    }
    if (editing.title.trim().length > 160 || (editing.subtitle?.length ?? 0) > 500 || (editing.cta_label?.length ?? 0) > 60) {
      window.alert('Judul promo maksimal 160 karakter, subjudul 500, dan teks tombol 60 karakter.');
      return;
    }
    const sortOrder = readSortOrder(editing.sort_order);
    if (sortOrder === null) { window.alert('Urutan promo harus berupa bilangan bulat non-negatif.'); return; }
    const ctaLabel = editing.cta_label?.trim() ?? '';
    const ctaLink = editing.cta_link?.trim() ?? '';
    if (ctaLabel && !ctaLink) {
      window.alert('Link tujuan wajib diisi jika teks tombol promo ditampilkan.');
      return;
    }
    if (ctaLink && !parsePromoDestination(ctaLink)) {
      window.alert('Link promo hanya boleh berupa rute internal #/... atau URL HTTPS yang valid.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: editing.title.trim(),
        subtitle: editing.subtitle?.trim() ?? '',
        cta_label: ctaLabel,
        cta_link: ctaLink,
        accent: editing.accent || '#f5b301',
        active: editing.active ?? true,
        sort_order: sortOrder,
      };
      const result = editing.id
        ? await supabase.from('promo_banners').update(payload).eq('id', editing.id).select('id').maybeSingle()
        : await supabase.from('promo_banners').insert(payload).select('id').maybeSingle();
      if (result.error || !result.data) {
        window.alert(`Promo gagal disimpan: ${result.error?.message ?? 'Tidak ada baris yang berubah. Periksa izin admin.'}`);
        return;
      }
      setEditing(null);
      await onChange();
    } catch (err) {
      window.alert(`Promo gagal disimpan: ${err instanceof Error ? err.message : 'Kesalahan koneksi.'}`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      if (!confirm('Hapus promo ini?')) return;
      const { data, error } = await supabase.from('promo_banners').delete().eq('id', id).select('id').maybeSingle();
      if (error || !data) {
        window.alert(`Promo tidak terhapus: ${error?.message ?? 'Database tidak menghapus baris apa pun. Periksa izin admin dan muat ulang.'}`);
        return;
      }
      await onChange();
    } catch (err) {
      window.alert(`Promo gagal diproses: ${err instanceof Error ? err.message : 'Kesalahan koneksi.'}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{promos.length} banner promo</p>
        <button onClick={() => setEditing({ title: '', subtitle: '', cta_label: '', cta_link: '', accent: '#f5b301', active: true, sort_order: 0 })} className="btn-primary px-4 py-2 rounded-lg text-sm flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Tambah Promo
        </button>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {promos.map((p) => (
          <div key={p.id} className="glass rounded-2xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.accent }} />
                  <div className="font-medium text-sm truncate">{p.title}</div>
                </div>
                <div className="text-xs text-slate-500 mt-1 line-clamp-2">{p.subtitle}</div>
                <div className="text-xs text-slate-500 mt-2">Urutan #{p.sort_order} • {p.active ? 'Aktif' : 'Nonaktif'}</div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button aria-label={`Edit promo ${p.title}`} onClick={() => setEditing(p)} className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-amber-300 transition"><Pencil className="w-4 h-4" /></button>
                <button aria-label={`Hapus promo ${p.title}`} onClick={() => remove(p.id)} className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-rose-300 transition"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <Modal title={editing.id ? 'Edit Promo' : 'Tambah Promo'} onClose={() => { if (!saving) setEditing(null); }}>
          <Field label="Judul"><input maxLength={160} value={editing.title ?? ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="inp" /></Field>
          <Field label="Subjudul"><input maxLength={500} value={editing.subtitle ?? ''} onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })} className="inp" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Teks Tombol"><input maxLength={60} value={editing.cta_label ?? ''} onChange={(e) => setEditing({ ...editing, cta_label: e.target.value })} className="inp" placeholder="mis. Lihat katalog" /></Field>
            <Field label="Link Tujuan"><input maxLength={2048} value={editing.cta_link ?? ''} onChange={(e) => setEditing({ ...editing, cta_link: e.target.value })} className="inp" placeholder="#/topup/game" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Warna Aksen"><input type="color" value={editing.accent ?? '#f5b301'} onChange={(e) => setEditing({ ...editing, accent: e.target.value })} className="inp h-11" /></Field>
            <Field label="Urutan"><input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} className="inp" /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={editing.active ?? true} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} className="accent-amber-400" /> Aktif (tampil di slider)
          </label>
          <SaveBar saving={saving} onSave={save} onCancel={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  );
}

/* ============ TESTIMONIALS ============ */
function TestimonialsTab({ items, onChange }: { items: Testimonial[]; onChange: () => Promise<void> }) {
  const [editing, setEditing] = useState<Partial<Testimonial> | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    const cleanName = editing?.name?.trim() ?? '';
    const cleanMessage = editing?.message?.trim() ?? '';
    const rating = Number(editing?.rating ?? 5);
    if (!editing || !cleanName || !cleanMessage) {
      window.alert('Nama dan pesan testimoni wajib diisi.');
      return;
    }
    if (cleanName.length > 100 || (editing.role?.trim().length ?? 0) > 100 || cleanMessage.length > 2000) {
      window.alert('Nama dan peran maksimal 100 karakter; pesan maksimal 2.000 karakter.');
      return;
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      window.alert('Rating testimoni harus berupa angka bulat 1–5.');
      return;
    }
    const sortOrder = readSortOrder(editing.sort_order);
    if (sortOrder === null) { window.alert('Urutan testimoni harus berupa bilangan bulat non-negatif.'); return; }
    setSaving(true);
    try {
      const payload = {
        name: cleanName,
        role: editing.role?.trim() ?? '',
        rating,
        message: cleanMessage,
        sort_order: sortOrder,
      };
      const result = editing.id
        ? await supabase.from('testimonials').update(payload).eq('id', editing.id).select('id').maybeSingle()
        : await supabase.from('testimonials').insert(payload).select('id').maybeSingle();
      if (result.error || !result.data) {
        window.alert(`Testimoni gagal disimpan: ${result.error?.message ?? 'Tidak ada baris yang berubah. Periksa izin admin.'}`);
        return;
      }
      setEditing(null);
      await onChange();
    } catch (err) {
      window.alert(`Testimoni gagal disimpan: ${err instanceof Error ? err.message : 'Kesalahan koneksi.'}`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      if (!confirm('Hapus testimoni ini?')) return;
      const { data, error } = await supabase.from('testimonials').delete().eq('id', id).select('id').maybeSingle();
      if (error || !data) {
        window.alert(`Testimoni tidak terhapus: ${error?.message ?? 'Database tidak menghapus baris apa pun. Periksa izin admin dan muat ulang.'}`);
        return;
      }
      await onChange();
    } catch (err) {
      window.alert(`Testimoni gagal diproses: ${err instanceof Error ? err.message : 'Kesalahan koneksi.'}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{items.length} testimoni</p>
        <button onClick={() => setEditing({ name: '', role: '', rating: 5, message: '', sort_order: 0 })} className="btn-primary px-4 py-2 rounded-lg text-sm flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Tambah Testimoni
        </button>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {items.map((t) => (
          <div key={t.id} className="glass rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: avatarGradient(t.name) }}>{initials(t.name)}</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{t.name}</div>
                <div className="text-xs text-slate-500">{t.role}</div>
                <div className="flex gap-0.5 mt-1">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`w-3 h-3 ${i < t.rating ? 'text-amber-400' : 'text-white/15'}`} fill="currentColor" />)}</div>
                <p className="text-xs text-slate-400 mt-2 line-clamp-3">{t.message}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button aria-label={`Edit testimoni ${t.name}`} onClick={() => setEditing(t)} className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-amber-300 transition"><Pencil className="w-4 h-4" /></button>
                <button aria-label={`Hapus testimoni ${t.name}`} onClick={() => remove(t.id)} className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-rose-300 transition"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <Modal title={editing.id ? 'Edit Testimoni' : 'Tambah Testimoni'} onClose={() => { if (!saving) setEditing(null); }}>
          <Field label="Nama"><input maxLength={100} value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="inp" /></Field>
          <Field label="Peran (opsional)"><input maxLength={100} value={editing.role ?? ''} onChange={(e) => setEditing({ ...editing, role: e.target.value })} className="inp" placeholder="mis. Gamer, Mahasiswa" /></Field>
          <Field label="Pesan"><textarea maxLength={2000} value={editing.message ?? ''} onChange={(e) => setEditing({ ...editing, message: e.target.value })} rows={3} className="inp resize-none" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Rating (1-5)"><input type="number" min={1} max={5} value={editing.rating ?? 5} onChange={(e) => setEditing({ ...editing, rating: Number(e.target.value) })} className="inp" /></Field>
            <Field label="Urutan"><input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} className="inp" /></Field>
          </div>
          <SaveBar saving={saving} onSave={save} onCancel={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  );
}

/* ============ FAQs ============ */
function FaqsTab({ items, onChange }: { items: Faq[]; onChange: () => Promise<void> }) {
  const [editing, setEditing] = useState<Partial<Faq> | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    const question = editing?.question?.trim() ?? '';
    const answer = editing?.answer?.trim() ?? '';
    if (!editing || !question || !answer) {
      window.alert('Pertanyaan dan jawaban FAQ wajib diisi.');
      return;
    }
    if (question.length > 500 || answer.length > 5000 || (editing.category?.trim().length ?? 0) > 80) {
      window.alert('Pertanyaan maksimal 500 karakter, jawaban 5.000, dan kategori 80 karakter.');
      return;
    }
    const sortOrder = readSortOrder(editing.sort_order);
    if (sortOrder === null) { window.alert('Urutan FAQ harus berupa bilangan bulat non-negatif.'); return; }
    setSaving(true);
    try {
      const payload = {
        question,
        answer,
        category: editing.category?.trim() || 'Umum',
        sort_order: sortOrder,
      };
      const result = editing.id
        ? await supabase.from('faqs').update(payload).eq('id', editing.id).select('id').maybeSingle()
        : await supabase.from('faqs').insert(payload).select('id').maybeSingle();
      if (result.error || !result.data) {
        window.alert(`FAQ gagal disimpan: ${result.error?.message ?? 'Tidak ada baris yang berubah. Periksa izin admin.'}`);
        return;
      }
      setEditing(null);
      await onChange();
    } catch (err) {
      window.alert(`FAQ gagal disimpan: ${err instanceof Error ? err.message : 'Kesalahan koneksi.'}`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      if (!confirm('Hapus FAQ ini?')) return;
      const { data, error } = await supabase.from('faqs').delete().eq('id', id).select('id').maybeSingle();
      if (error || !data) {
        window.alert(`FAQ tidak terhapus: ${error?.message ?? 'Database tidak menghapus baris apa pun. Periksa izin admin dan muat ulang.'}`);
        return;
      }
      await onChange();
    } catch (err) {
      window.alert(`FAQ gagal diproses: ${err instanceof Error ? err.message : 'Kesalahan koneksi.'}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{items.length} pertanyaan</p>
        <button onClick={() => setEditing({ question: '', answer: '', category: 'Umum', sort_order: 0 })} className="btn-primary px-4 py-2 rounded-lg text-sm flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Tambah FAQ
        </button>
      </div>
      <div className="glass rounded-2xl divide-y divide-white/5">
        {items.map((f) => (
          <div key={f.id} className="flex items-start gap-3 p-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300">{f.category}</span>
                <span className="font-medium text-sm">#{f.sort_order}</span>
              </div>
              <div className="text-sm mt-1">{f.question}</div>
              <div className="text-xs text-slate-400 mt-1 line-clamp-2">{f.answer}</div>
            </div>
            <div className="flex gap-1 shrink-0">
              <button aria-label={`Edit FAQ ${f.question}`} onClick={() => setEditing(f)} className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-amber-300 transition"><Pencil className="w-4 h-4" /></button>
              <button aria-label={`Hapus FAQ ${f.question}`} onClick={() => remove(f.id)} className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-rose-300 transition"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-slate-400 text-sm text-center py-8">Belum ada FAQ.</p>}
      </div>
      {editing && (
        <Modal title={editing.id ? 'Edit FAQ' : 'Tambah FAQ'} onClose={() => { if (!saving) setEditing(null); }}>
          <Field label="Kategori"><input maxLength={80} value={editing.category ?? 'Umum'} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className="inp" /></Field>
          <Field label="Pertanyaan"><input maxLength={500} value={editing.question ?? ''} onChange={(e) => setEditing({ ...editing, question: e.target.value })} className="inp" /></Field>
          <Field label="Jawaban"><textarea maxLength={5000} value={editing.answer ?? ''} onChange={(e) => setEditing({ ...editing, answer: e.target.value })} rows={4} className="inp resize-none" /></Field>
          <Field label="Urutan"><input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} className="inp" /></Field>
          <SaveBar saving={saving} onSave={save} onCancel={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  );
}

/* ============ Shared UI ============ */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  // Keep the latest close handler without re-running the focus effect whenever form state changes.
  // Depending directly on onClose used to restore focus to the opener after every keystroke.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // Portal avoids clipping by dashboard containers. Keep scroll restoration deterministic.
  const panelRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!panel.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus({ preventScroll: true });
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    const focusTimer = window.setTimeout(() => {
      const firstField = panelRef.current?.querySelector<HTMLElement>('input:not([type="checkbox"]):not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])');
      const fallbackButton = panelRef.current?.querySelector<HTMLElement>('button:not([disabled]):not([aria-label="Tutup formulir"])');
      (firstField ?? fallbackButton ?? panelRef.current)?.focus({ preventScroll: true });
    }, 0);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
  }, []);
  if (typeof document === 'undefined' || !document.body) return null;
  return createPortal(
    <div
      className="fityora-modal-backdrop fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto p-3 sm:p-4"
      role="presentation"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-describedby="fityora-modal-hint"
        className="fityora-modal-panel relative my-auto w-full max-w-lg max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl p-4 text-slate-100 shadow-2xl sm:max-h-[90dvh] sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 -mx-1 mb-4 flex items-center justify-between gap-3 border-b border-white/10 px-1 pb-3">
          <h3 className="font-display font-semibold text-base sm:text-lg">{title}</h3>
          <button type="button" aria-label="Tutup formulir" onClick={onClose} className="shrink-0 rounded-lg p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <p id="fityora-modal-hint" className="sr-only">Formulir dialog. Tekan Escape untuk menutup.</p>
        <div className="space-y-3">{children}</div>
      </section>
    </div>,
    document.body,
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  const controlId = isValidElement<{ id?: string }>(children) && children.props.id
    ? children.props.id
    : id;
  const control = isValidElement<{ id?: string }>(children)
    ? cloneElement(children, { id: controlId })
    : children;
  return (
    <div>
      <label htmlFor={controlId} className="text-xs text-slate-400 block mb-1.5">{label}</label>
      {control}
    </div>
  );
}

function SaveBar({ saving, onSave, onCancel }: { saving: boolean; onSave: () => void; onCancel: () => void }) {
  return (
    <div className="flex gap-2 pt-2">
      <button type="button" onClick={onCancel} disabled={saving} className="btn-ghost flex-1 px-4 py-2.5 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed">Batal</button>
      <button type="button" onClick={onSave} disabled={saving} className="btn-primary flex-1 px-4 py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 disabled:opacity-60">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan
      </button>
    </div>
  );
}
