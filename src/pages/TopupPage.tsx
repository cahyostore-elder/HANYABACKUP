import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Check, Search, Zap, Smartphone, Gamepad2, Loader2,
  Hash, Server, ShieldCheck, Wallet, Construction, Copy, Landmark, MessageCircle, QrCode, Upload, FileImage,
} from 'lucide-react';
import { supabase, type TopupCategory, type Brand, type Package } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useRoute } from '@/lib/router';
import { formatPrice, statusLabel } from '@/lib/format';
import BrandLogo from '@/components/BrandLogo';
import {
  PAYMENT_METHODS, paymentFeeForMethod, groupMethods, methodById,
  type PaymentMethod,
} from '@/lib/payment';
import { STORE_CONTACT } from '@/lib/contact';

type Step = 'brand' | 'package' | 'target' | 'payment' | 'confirm';

type PlacedOrder = {
  id: string;
  code: string;
  status: string;
  methodId: string;
  totalAmount: number;
};

function createOrderRequestId(): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  // UUID-shaped fallback for older browsers; the key is for retry deduplication,
  // not authentication or authorization.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

function orderRequestStorageKey(fingerprint: string): string {
  // Store only a compact hash of the payload, not the target ID/phone itself.
  // A collision cannot create a mismatched order because the RPC checks payload equality.
  let hash = 14695981039346656037n;
  for (let index = 0; index < fingerprint.length; index += 1) {
    hash ^= BigInt(fingerprint.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 1099511628211n);
  }
  return `fityora:order-request:${hash.toString(16)}`;
}

function loadOrCreateOrderRequestId(storageKey: string): string {
  try {
    const saved = window.sessionStorage.getItem(storageKey);
    if (saved && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saved)) {
      return saved;
    }
  } catch {
    // Storage may be disabled; in-memory retry protection still applies.
  }
  const requestId = createOrderRequestId();
  try {
    window.sessionStorage.setItem(storageKey, requestId);
  } catch {
    // Storage may be disabled; the checkout remains usable for the current page.
  }
  return requestId;
}

function clearStoredOrderRequestId(storageKey: string): void {
  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // Storage may be disabled; no checkout functionality depends on this cleanup.
  }
}

export default function TopupPage({
  category: categorySlug,
  orderMaintenanceEnabled = false,
  orderMaintenanceMessage = 'Pemesanan sedang dihentikan sementara. Silakan coba kembali nanti.',
}: {
  category: string;
  orderMaintenanceEnabled?: boolean;
  orderMaintenanceMessage?: string;
}) {
  const { navigate } = useRoute();
  const { session, profile } = useAuth();
  const isAuthor = profile?.role === 'author' || profile?.role === 'admin';

  const [category, setCategory] = useState<TopupCategory | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [packageLoading, setPackageLoading] = useState(false);
  const [packageError, setPackageError] = useState('');
  const [packageRetry, setPackageRetry] = useState(0);

  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [target, setTarget] = useState('');
  const [server, setServer] = useState('');
  const [search, setSearch] = useState('');
  const [packageSearch, setPackageSearch] = useState('');
  const [packageSort, setPackageSort] = useState<'recommended' | 'price-asc' | 'price-desc'>('recommended');
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('brand');
  const [placing, setPlacing] = useState(false);
  const placingLock = useRef(false);
  const requestIdRef = useRef<{ fingerprint: string; id: string; storageKey: string } | null>(null);
  const [targetError, setTargetError] = useState('');
  const [serverError, setServerError] = useState('');
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError('');
      setCatalogError('');
      try {
        const { data: cat, error: categoryError } = await supabase
          .from('topup_categories')
          .select('*')
          .eq('slug', categorySlug)
          .abortSignal(AbortSignal.timeout(12000))
          .maybeSingle();
        if (!active) return;
        if (categoryError) {
          setCategory(null);
          setBrands([]);
          setCatalogError('Kategori gagal dimuat. Periksa koneksi dan konfigurasi database, lalu coba lagi.');
          return;
        }
        setCategory((cat as TopupCategory) ?? null);
        if (!cat) {
          setBrands([]);
          return;
        }

        const { data: brs, error: brandsError } = await supabase
          .from('brands')
          .select('*')
          .eq('category_id', (cat as TopupCategory).id)
          .order('sort_order')
          .abortSignal(AbortSignal.timeout(12000));
        if (!active) return;
        if (brandsError) {
          setBrands([]);
          setCatalogError('Daftar produk gagal dimuat. Periksa koneksi dan pengaturan database, lalu coba lagi.');
          return;
        }
        const availableBrands = (brs as Brand[]) ?? [];
        setBrands(availableBrands);

        const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
        const brandSlug = params.get('brand');
        if (brandSlug) {
          const b = availableBrands.find((x) => x.slug === brandSlug);
          if (b) {
            setSelectedBrand(b);
            setSelectedPackage(null);
            setStep('package');
          }
        }
      } catch (error) {
        if (active) {
          const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
          setCatalogError(timedOut
            ? 'Koneksi katalog terlalu lama merespons. Periksa internet lalu coba lagi.'
            : 'Koneksi bermasalah saat memuat katalog. Periksa konfigurasi Supabase lalu coba lagi.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [categorySlug, catalogAttempt]);

  useEffect(() => {
    let active = true;
    if (!selectedBrand) {
      setPackages([]);
      setPackageError('');
      setPackageLoading(false);
      return () => { active = false; };
    }

    setPackages([]);
    setPackageError('');
    setPackageLoading(true);
    (async () => {
      try {
        const { data, error: packagesError } = await supabase
          .from('packages')
          .select('*')
          .eq('brand_id', selectedBrand.id)
          .order('sort_order')
          .abortSignal(AbortSignal.timeout(12000));
        if (!active) return;
        if (packagesError) {
          setPackages([]);
          setPackageError('Nominal gagal dimuat. Periksa koneksi, lalu coba lagi.');
          return;
        }
        setPackages((data as Package[]) ?? []);
      } catch (error) {
        if (active) {
          const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
          setPackageError(timedOut
            ? 'Pemuatan nominal terlalu lama. Periksa internet lalu coba lagi.'
            : 'Koneksi bermasalah saat memuat nominal. Coba lagi.');
        }
      } finally {
        if (active) setPackageLoading(false);
      }
    })();
    return () => { active = false; };
  }, [selectedBrand, packageRetry]);

  useEffect(() => {
    setStep('brand');
    setSelectedBrand(null);
    setSelectedPackage(null);
    setPackageSearch('');
    setPackageSort('recommended');
    setTarget('');
    setServer('');
    setSelectedMethod(null);
    setTargetError('');
    setServerError('');
    setPlacedOrder(null);
    requestIdRef.current = null;
  }, [categorySlug]);

  const selectBrand = (b: Brand) => {
    setSelectedBrand(b);
    setSelectedPackage(null);
    setPackageSearch('');
    setPackageSort('recommended');
    setTarget('');
    setServer('');
    setSelectedMethod(null);
    setTargetError('');
    setServerError('');
    setError('');
    requestIdRef.current = null;
    setStep('package');
  };

  const filteredBrands = useMemo(() => {
    if (!search.trim()) return brands;
    const q = search.toLowerCase();
    return brands.filter((b) => b.name.toLowerCase().includes(q));
  }, [brands, search]);

  const filteredPackages = useMemo(() => {
    const q = packageSearch.trim().toLocaleLowerCase('id-ID');
    const matches = !q ? packages : packages.filter((item) =>
      `${item.name} ${item.description ?? ''}`.toLocaleLowerCase('id-ID').includes(q)
    );
    if (packageSort === 'price-asc') return [...matches].sort((a, b) => Number(a.price) - Number(b.price));
    if (packageSort === 'price-desc') return [...matches].sort((a, b) => Number(b.price) - Number(a.price));
    return matches;
  }, [packages, packageSearch, packageSort]);

  const accent = category?.accent ?? '#f5b301';
  const targetPlaceholder =
    categorySlug === 'pulsa'
      ? 'Nomor HP (contoh: 08123456789)'
      : categorySlug === 'pln'
      ? 'ID Pelanggan / Nomor meter'
      : 'User ID akun game';

  const basePrice = selectedPackage?.price ?? 0;

  const selectedPaymentFee = paymentFeeForMethod(selectedMethod);
  const grandTotal = useMemo(
    () => (selectedMethod ? basePrice + selectedPaymentFee : basePrice),
    [selectedMethod, basePrice, selectedPaymentFee]
  );

  const validateTarget = () => {
    const value = target.trim();
    let targetMessage = '';
    let serverMessage = '';
    if (!value) {
      targetMessage = 'ID tujuan wajib diisi.';
    } else if (value.length > 100) {
      targetMessage = 'ID tujuan terlalu panjang (maksimal 100 karakter).';
    } else if (categorySlug === 'pulsa') {
      const digits = value.replace(/[\s()+-]/g, '');
      if (!/^\d{8,15}$/.test(digits)) targetMessage = 'Nomor HP harus berisi 8–15 digit. Boleh memakai spasi, +, tanda kurung, atau tanda hubung.';
    } else if (categorySlug === 'pln' && !/^\d{8,20}$/.test(value.replace(/[\s-]/g, ''))) {
      targetMessage = 'ID Pelanggan atau nomor meter harus berisi 8–20 digit.';
    }
    if (selectedBrand?.requires_server) {
      if (!server.trim()) serverMessage = `${selectedBrand.server_label || 'Server'} wajib diisi.`;
      else if (server.trim().length > 32) serverMessage = 'Data server terlalu panjang (maksimal 32 karakter).';
    }
    setTargetError(targetMessage);
    setServerError(serverMessage);
    return !targetMessage && !serverMessage && Boolean(selectedBrand && selectedPackage && Number(selectedPackage.price) > 0);
  };

  const canConfirmTarget = () => Boolean(
    selectedBrand && selectedPackage && Number(selectedPackage.price) > 0 && target.trim() && target.trim().length <= 100 &&
    (!selectedBrand.requires_server || (server.trim() && server.trim().length <= 32))
  );

  const copyToClipboard = async (text: string, key: string) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      setError('Gagal menyalin otomatis. Tekan lama teks lalu pilih Salin.');
    }
  };

  const placeOrder = async () => {
    if (!session) {
      navigate('/login');
      return;
    }
    if (orderMaintenanceEnabled && !isAuthor) {
      setError(orderMaintenanceMessage);
      return;
    }
    if (placingLock.current || !validateTarget() || !category || !selectedBrand || !selectedPackage || Number(selectedPackage.price) <= 0 || !selectedMethod) {
      if (selectedPackage && Number(selectedPackage.price) <= 0) setError('Paket ini belum bisa dipesan karena harga belum ditetapkan admin.');
      return;
    }
    const method = methodById(selectedMethod);
    if (!method || method.maintenance) {
      setError('Metode pembayaran tidak tersedia.');
      return;
    }
    const requestFingerprint = JSON.stringify([
      category.id,
      selectedBrand.id,
      selectedPackage.id,
      target.trim(),
      server.trim(),
      method.id,
    ]);
    const existingRequest = requestIdRef.current;
    const storageKey = orderRequestStorageKey(requestFingerprint);
    const idempotencyRequest = existingRequest && existingRequest.fingerprint === requestFingerprint
      ? existingRequest
      : { fingerprint: requestFingerprint, storageKey, id: loadOrCreateOrderRequestId(storageKey) };
    requestIdRef.current = idempotencyRequest;

    placingLock.current = true;
    setPlacing(true);
    setError('');
    try {
      // Pricing and idempotency are enforced by the database. Reuse the same key
      // after a timeout so a committed order is returned instead of duplicated.
      const { data, error: orderError } = await supabase.rpc('create_topup_order', {
        p_category_id: category.id,
        p_brand_id: selectedBrand.id,
        p_package_id: selectedPackage.id,
        p_target: target.trim(),
        p_server: server.trim(),
        p_payment_method: method.id,
        p_request_id: idempotencyRequest.id,
      });

      const order = Array.isArray(data) ? data[0] : data;
      const returnedTotal = Number(order?.total_amount);
      if (orderError || !order?.code || !Number.isFinite(returnedTotal) || returnedTotal <= 0) {
        setError(orderError?.message || 'Pesanan belum dapat dipastikan. Jangan transfer berdasarkan estimasi; coba periksa status atau ulangi dengan tombol yang sama.');
        return;
      }

      setPlacedOrder({
        id: order.id,
        code: order.code,
        status: order.status || 'pending',
        methodId: method.id,
        totalAmount: returnedTotal,
      });
      clearStoredOrderRequestId(idempotencyRequest.storageKey);
      requestIdRef.current = null;
      setStep('confirm');
    } catch {
      setError('Koneksi bermasalah. Pesanan belum dapat dibuat. Coba lagi beberapa saat.');
    } finally {
      setPlacing(false);
      placingLock.current = false;
    }
  };

  const CategoryIcon = categorySlug === 'pulsa' ? Smartphone : categorySlug === 'pln' ? Zap : Gamepad2;
  const stepIndex = ['brand', 'package', 'target', 'payment', 'confirm'].indexOf(step);
  const grouped = groupMethods(PAYMENT_METHODS);

  return (
    <div className="pt-24 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-amber-300 transition mb-5"
      >
        <ArrowLeft className="w-4 h-4" /> Beranda
      </button>

      <div className="flex items-center gap-3 mb-2">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ background: `${accent}22`, border: `1px solid ${accent}55` }}
        >
          <CategoryIcon className="w-6 h-6" style={{ color: accent }} />
        </div>
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold">{category?.label ?? 'Top-Up'}</h1>
          <p className="text-slate-400 text-sm">Pesanan diproses setelah pembayaran terverifikasi.</p>
        </div>
      </div>

      {orderMaintenanceEnabled && !isAuthor && (
        <div role="alert" className="mt-5 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          <p className="font-semibold">Pemesanan sedang ditutup sementara</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-100/80">{orderMaintenanceMessage}</p>
          <p className="mt-2 text-xs text-slate-400">Katalog tetap dapat dilihat. Pesanan yang sudah dibuat dan cek status tetap dapat diakses.</p>
        </div>
      )}

      {/* Stepper */}
      <div className="flex items-center gap-1 mt-6 mb-6 text-xs">
        {['Pilih', 'Nominal', 'Tujuan', 'Bayar', 'Selesai'].map((label, i) => (
          <div key={label} className="flex items-center gap-1 flex-1">
            <div
              className={`h-1.5 rounded-full flex-1 transition-all ${i <= stepIndex ? '' : 'bg-white/10'}`}
              style={i <= stepIndex ? { background: accent } : undefined}
            />
            <span className={i === stepIndex ? 'text-white font-medium' : 'text-slate-500'}>{label}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="glass rounded-2xl p-8">
          <div className="h-8 w-48 bg-white/5 rounded animate-pulse mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-24 bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      ) : catalogError ? (
        <div className="glass rounded-2xl p-10 text-center" role="alert">
          <p className="text-slate-300">{catalogError}</p>
          <button onClick={() => setCatalogAttempt((attempt) => attempt + 1)} className="btn-primary mt-4 px-5 py-2.5 rounded-xl">Coba lagi</button>
        </div>
      ) : !category ? (
        <div className="glass rounded-2xl p-10 text-center">
          <p className="text-slate-400">Kategori top-up tidak ditemukan.</p>
        </div>
      ) : placedOrder ? (
        <ResultPanel
          placedOrder={placedOrder}
          userId={session?.user.id ?? ''}
          brandName={selectedBrand?.name ?? ''}
          packageName={selectedPackage?.name ?? ''}
          target={target}
          server={server}
          navigate={navigate}
          reset={() => {
            setPlacedOrder(null);
            requestIdRef.current = null;
            setStep('brand');
            setSelectedBrand(null);
            setSelectedPackage(null);
            setTarget('');
            setServer('');
            setSelectedMethod(null);
            setTargetError('');
            setServerError('');
            setError('');
          }}
          copied={copied}
          copy={copyToClipboard}
          error={error}
        />
      ) : step === 'brand' ? (
        <div className="animate-fade-in">
          {brands.length > 6 && (
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari brand / operator…"
                className="w-full pl-10 pr-4 py-3 rounded-xl glass-soft text-sm focus:outline-none focus:border-amber-400/40"
              />
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredBrands.map((b, i) => (
              <button
                key={b.id}
                onClick={() => selectBrand(b)}
                className="glass rounded-2xl p-4 flex items-center gap-3 card-hover animate-fade-up text-left"
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                <BrandLogo brand={b} size="md" />
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{b.name}</div>
                  {b.requires_server && (
                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Server className="w-3 h-3" /> Perlu {b.server_label}
                    </div>
                  )}
                </div>
              </button>
            ))}
            {filteredBrands.length === 0 && (
              <p className="col-span-full text-center text-slate-500 text-sm py-8">Tidak ditemukan.</p>
            )}
          </div>
        </div>
      ) : step === 'package' ? (
        <div className="animate-fade-in">
          <div className="flex items-center justify-between gap-3 mb-4">
            <button
              onClick={() => setStep('brand')}
              className="text-sm text-slate-400 hover:text-amber-300 flex items-center gap-1 shrink-0"
            >
              <ArrowLeft className="w-4 h-4" /> Ganti {categorySlug === 'pulsa' ? 'operator' : 'brand'}
            </button>
            <div className="text-sm text-slate-300 font-medium text-right truncate">{selectedBrand?.name}</div>
          </div>
          {packageLoading ? (
            <div className="glass rounded-2xl p-8 text-center text-slate-400 text-sm" role="status">
              <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Memuat nominal…
            </div>
          ) : packageError ? (
            <div className="glass rounded-2xl p-8 text-center text-slate-300 text-sm" role="alert">
              <p>{packageError}</p>
              <button onClick={() => setPackageRetry((attempt) => attempt + 1)} className="btn-primary mt-4 px-4 py-2 rounded-xl">Coba lagi</button>
            </div>
          ) : packages.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center text-slate-400 text-sm">
              Belum ada nominal tersedia untuk {selectedBrand?.name ?? 'produk ini'}. Silakan pilih brand lain atau coba lagi nanti.
            </div>
          ) : (
            <>
              <div className="glass-soft package-search-panel rounded-2xl p-3 sm:p-4 mb-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <h2 className="font-display font-semibold">Pilih nominal</h2>
                    <p className="text-xs text-slate-400 mt-1">Pilih paket sesuai kebutuhan. Harga ditampilkan sebelum biaya pembayaran.</p>
                  </div>
                  <span className="package-count-pill" aria-live="polite">{filteredPackages.length} dari {packages.length} paket</span>
                </div>
                <label className="package-sort-row">
                  <span>Urutkan berdasarkan</span>
                  <select value={packageSort} onChange={(event) => setPackageSort(event.target.value as typeof packageSort)} aria-label="Urutkan nominal berdasarkan harga">
                    <option value="recommended">Urutan katalog</option>
                    <option value="price-asc">Harga termurah</option>
                    <option value="price-desc">Harga termahal</option>
                  </select>
                </label>
                {packages.length > 4 && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
                    <input
                      value={packageSearch}
                      onChange={(event) => setPackageSearch(event.target.value)}
                      aria-label="Cari nominal atau deskripsi paket"
                      placeholder="Cari nominal atau paket…"
                      className="w-full pl-10 pr-10 py-3 rounded-xl glass-soft text-sm focus:outline-none focus:border-amber-400/40"
                    />
                    {packageSearch && (
                      <button type="button" onClick={() => setPackageSearch('')} aria-label="Hapus pencarian nominal" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs text-slate-400 hover:text-white">
                        Hapus
                      </button>
                    )}
                  </div>
                )}
              </div>
              {filteredPackages.length === 0 ? (
                <div className="glass rounded-2xl p-8 text-center text-slate-400 text-sm" role="status">
                  <Search className="w-6 h-6 mx-auto mb-2 opacity-70" aria-hidden="true" />
                  Nominal tidak ditemukan untuk “{packageSearch}”.
                  <button type="button" onClick={() => setPackageSearch('')} className="block mx-auto mt-3 text-amber-300 hover:text-amber-200 font-medium">Tampilkan semua nominal</button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredPackages.map((p, i) => {
                const selected = selectedPackage?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={selected}
                    aria-label={Number(p.price) > 0 ? `Pilih ${p.name}, harga ${formatPrice(Number(p.price))}${p.featured ? ', paket populer' : ''}` : `${p.name}, harga belum diatur`}
                    disabled={Number(p.price) <= 0}
                    onClick={() => {
                      if (Number(p.price) <= 0) return;
                      setSelectedPackage(p);
                      setStep('target');
                    }}
                    className={`package-card relative rounded-2xl p-4 text-left transition-all animate-fade-up ${
                      selected ? 'package-card--selected glass gold-border' : Number(p.price) <= 0 ? 'glass opacity-70 cursor-not-allowed' : 'glass card-hover'
                    }`}
                    style={{ animationDelay: `${Math.min(i, 8) * 0.035}s` }}
                  >
                    {p.featured && (
                      <span className="package-popular-badge"><Zap className="w-3 h-3" aria-hidden="true" /> Populer</span>
                    )}
                    <div className="font-display font-semibold text-sm leading-snug">{p.name}</div>
                    <div className="package-description">{p.description || selectedBrand?.name}</div>
                    <div className="package-card-bottom">
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-wider text-slate-500">Harga</div>
                        <div className="package-card-price">{Number(p.price) > 0 ? formatPrice(Number(p.price)) : 'Harga belum diatur'}</div>
                      </div>
                      <span className={`package-pick-indicator ${selected ? 'is-selected' : ''}`} aria-hidden="true">
                        {selected ? <Check className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                      </span>
                    </div>
                  </button>
                );
              })}
                </div>
              )}
            </>
          )}
        </div>
      ) : step === 'target' ? (
        <div className="animate-fade-in max-w-xl">
          <button
            onClick={() => setStep('package')}
            className="text-sm text-slate-400 hover:text-amber-300 flex items-center gap-1 mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Ganti nominal
          </button>

          <div className="glass rounded-2xl p-6 space-y-5">
            <div>
              <label className="text-xs text-slate-400 block mb-2 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5" /> {targetPlaceholder}
              </label>
              <input
                value={target}
                onChange={(e) => { setTarget(e.target.value); setTargetError(''); }}
                placeholder={targetPlaceholder}
                inputMode={categorySlug === 'pulsa' || categorySlug === 'pln' ? 'numeric' : 'text'}
                autoComplete="off"
                maxLength={100}
                aria-invalid={Boolean(targetError)}
                aria-describedby={targetError ? 'target-error' : undefined}
                className="w-full px-4 py-3 rounded-xl glass-soft text-sm focus:outline-none focus:border-amber-400/40"
              />
              {targetError && <p id="target-error" className="text-xs text-rose-400 mt-2" role="alert">{targetError}</p>}
            </div>
            {selectedBrand?.requires_server && (
              <div>
                <label className="text-xs text-slate-400 block mb-2 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5" /> {selectedBrand.server_label || 'Server'}
                </label>
                <input
                  value={server}
                  onChange={(e) => { setServer(e.target.value); setServerError(''); }}
                  placeholder={selectedBrand.server_label || 'Contoh: 1234'}
                  maxLength={32}
                  aria-invalid={Boolean(serverError)}
                  aria-describedby={serverError ? 'server-error' : undefined}
                  className="w-full px-4 py-3 rounded-xl glass-soft text-sm focus:outline-none focus:border-amber-400/40"
                />
                {serverError && <p id="server-error" className="text-xs text-rose-400 mt-2" role="alert">{serverError}</p>}
                <p className="text-xs text-slate-500 mt-1.5">
                  Cek server di dalam game (profil). Wajib diisi agar top-up masuk ke akun benar.
                </p>
              </div>
            )}

            {categorySlug === 'pln' && (
              <p className="text-xs text-slate-500 flex items-start gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                Pastikan ID Pelanggan benar. Pesanan diproses setelah pembayaran diverifikasi admin.
              </p>
            )}
            {categorySlug === 'pulsa' && (
              <p className="text-xs text-slate-500 flex items-start gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                Pastikan nomor HP aktif dan benar sebelum membuat pesanan.
              </p>
            )}

            <button
              onClick={() => { if (validateTarget()) setStep('payment'); }}
              disabled={!canConfirmTarget()}
              className="btn-primary w-full px-5 py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
            >
              Lanjut ke Pembayaran <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : step === 'payment' ? (
        <div className="animate-fade-in max-w-2xl">
          <button
            onClick={() => setStep('target')}
            className="text-sm text-slate-400 hover:text-amber-300 flex items-center gap-1 mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Ubah data tujuan
          </button>

          <h2 className="font-display text-lg font-bold mb-1">Pilih Metode Pembayaran</h2>
          <p className="text-xs text-slate-400 mb-5">
            Biaya admin mengikuti metode pembayaran. Kode unik acak Rp101–Rp999 ditentukan server saat pesanan dibuat.
          </p>

          {/* E-Wallet */}
          <SectionTitle icon={Wallet} title="E-Wallet" />
          <div className="grid sm:grid-cols-2 gap-3 mb-5">
            {grouped.ewallet.map((m) => (
              <MethodCard
                key={m.id}
                method={m}
                selected={selectedMethod === m.id}
                onSelect={() => setSelectedMethod(m.id)}
              />
            ))}
          </div>

          {/* QRIS: original store QR image is retained without modification. */}
          <SectionTitle icon={QrCode} title="QRIS" />
          <div className="grid sm:grid-cols-2 gap-3 mb-5">
            {grouped.qris.map((m) => (
              <MethodCard
                key={m.id}
                method={m}
                selected={selectedMethod === m.id}
                onSelect={() => setSelectedMethod(m.id)}
              />
            ))}
          </div>

          {/* VA (maintenance — intentionally unchanged) */}
          <SectionTitle icon={Landmark} title="Virtual Account (VA)" />
          <div className="mb-5">
            {grouped.va.map((m) => (
              <div
                key={m.id}
                className="glass rounded-2xl p-4 flex items-center gap-3 opacity-80 border-dashed border border-white/10"
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${m.color}22`, border: `1px solid ${m.color}55` }}
                >
                  <Construction className="w-5 h-5" style={{ color: m.color }} />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{m.name}</div>
                  <div className="text-xs text-amber-300 flex items-center gap-1 mt-0.5">
                    <Construction className="w-3 h-3" /> {m.note}
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-amber-500/15 text-amber-300">
                  Maintenance
                </span>
              </div>
            ))}
          </div>

          {/* Bank */}
          <SectionTitle icon={Landmark} title="Transfer Bank" />
          <div className="grid sm:grid-cols-2 gap-3 mb-5">
            {grouped.bank.map((m) => (
              <MethodCard
                key={m.id}
                method={m}
                selected={selectedMethod === m.id}
                onSelect={() => setSelectedMethod(m.id)}
              />
            ))}
          </div>

          {/* Price summary */}
          <div className="glass rounded-2xl p-5 mb-5">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Harga</span>
              <span>{formatPrice(basePrice)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1.5">
              <span className="text-slate-400">Biaya admin</span>
              <span>{formatPrice(selectedPaymentFee)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1.5">
              <span className="text-slate-400">Kode unik</span>
              <span className="text-amber-300">Ditentukan setelah dibuat</span>
            </div>
            <div className="h-px bg-white/5 my-3" />
            <div className="flex justify-between items-center">
              <span className="text-slate-300 text-sm">Estimasi sebelum kode unik</span>
              <span className="font-display text-xl font-bold text-gradient-gold">{formatPrice(grandTotal)}</span>
            </div>
          </div>

          {error && <p className="text-rose-400 text-xs mb-3">{error}</p>}

          <button
            onClick={() => setStep('confirm')}
            disabled={!selectedMethod}
            className="btn-primary w-full px-5 py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
          >
            Lanjut <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        /* CONFIRM PREVIEW */
        <div className="animate-fade-in max-w-xl">
          <button
            onClick={() => setStep('payment')}
            className="text-sm text-slate-400 hover:text-amber-300 flex items-center gap-1 mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Ganti pembayaran
          </button>
          <div className="glass rounded-2xl p-6">
            <h2 className="font-display text-lg font-bold mb-4">Konfirmasi Pesanan</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-400">Layanan</dt>
                <dd>{category.label}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Brand</dt>
                <dd>{selectedBrand?.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Nominal</dt>
                <dd>{selectedPackage?.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Tujuan</dt>
                <dd className="max-w-[60%] text-right break-all font-mono">{target}</dd>
              </div>
              {selectedBrand?.requires_server && (
                <div className="flex justify-between">
                  <dt className="text-slate-400">{selectedBrand.server_label}</dt>
                  <dd className="font-mono">{server}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-slate-400">Pembayaran</dt>
                <dd className="text-right">{methodById(selectedMethod)?.name}</dd>
              </div>
              <div className="h-px bg-white/5 my-2" />
              <div className="flex justify-between text-xs text-slate-500">
                <span>Harga + biaya admin (estimasi, sebelum kode unik)</span>
                <span>{formatPrice(basePrice + selectedPaymentFee)}</span>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-slate-400 flex items-center gap-1">
                  <Wallet className="w-4 h-4" /> Estimasi Total
                </dt>
                <dd className="font-display text-xl font-bold text-gradient-gold">{formatPrice(basePrice + selectedPaymentFee)}</dd>
              </div>
              <p className="text-xs text-amber-300/90 mt-2">Nominal final akan ditampilkan setelah pesanan berhasil dibuat. Bayar sesuai nominal final tersebut.</p>
              <div className="mt-4 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-3 text-xs text-slate-300" role="note">
                <span className="font-semibold text-cyan-200">Pembayaran manual:</span> tombol di bawah hanya membuat pesanan dan menampilkan instruksi. Pembayaran akan diperiksa admin; top-up tidak otomatis dikirim saat tombol ditekan.
              </div>
            </dl>

            {error && <p className="text-rose-400 text-xs mt-4">{error}</p>}

            <button
              onClick={placeOrder}
              disabled={placing || (orderMaintenanceEnabled && !isAuthor)}
              className="btn-primary w-full mt-5 px-5 py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {placing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Memproses…
                </>
              ) : orderMaintenanceEnabled && !isAuthor ? (
                <>Pemesanan Ditutup Sementara</>
              ) : (
                <>
                  <Check className="w-4 h-4" /> Buat Pesanan & Lihat Instruksi
                </>
              )}
            </button>
            {!session && (
              <p className="text-xs text-slate-500 mt-3 text-center">
                Kamu akan diarahkan ke halaman masuk untuk menyelesaikan transaksi.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: typeof Wallet; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-slate-400" />
      <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-slate-300">{title}</h3>
    </div>
  );
}

function MethodCard({
  method,
  selected,
  onSelect,
}: {
  method: PaymentMethod;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = method.icon;
  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      data-selected={selected ? 'true' : 'false'}
      className={`payment-method-card glass rounded-2xl p-4 flex items-center gap-3 text-left ${
        selected ? 'gold-border ring-1 ring-cyan-300/20' : 'card-hover'
      }`}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${method.color}22`, border: `1px solid ${method.color}55` }}
      >
        <Icon className="w-5 h-5" style={{ color: method.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{method.name}</div>
        <div className="text-xs text-slate-500 font-mono truncate">{method.id === 'qris' ? 'Pindai kode QR toko' : method.accountNumber}</div>
      </div>
      <div
        className={`payment-method-check w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
          selected ? 'border-cyan-300 bg-cyan-300' : 'border-white/20'
        }`}
      >
        {selected && <Check className="w-3 h-3 text-slate-900" />}
      </div>
    </button>
  );
}

function ResultPanel({
  placedOrder,
  userId,
  brandName,
  packageName,
  target,
  server,
  navigate,
  reset,
  copied,
  copy,
  error,
}: {
  placedOrder: PlacedOrder;
  userId: string;
  brandName: string;
  packageName: string;
  target: string;
  server: string;
  navigate: (to: string) => void;
  reset: () => void;
  copied: string | null;
  copy: (text: string, key: string) => void;
  error?: string;
}) {
  const method = methodById(placedOrder.methodId);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofState, setProofState] = useState<'idle' | 'uploading' | 'submitted' | 'error'>('idle');
  const [proofMessage, setProofMessage] = useState('');
  const submitProof = async () => {
    if (!proofFile || proofState === 'uploading' || proofState === 'submitted') return;
    if (!userId) { setProofState('error'); setProofMessage('Sesi login tidak ditemukan. Silakan masuk kembali.'); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(proofFile.type) || proofFile.size > 5 * 1024 * 1024) {
      setProofState('error'); setProofMessage('Pilih gambar JPG, PNG, atau WebP maksimal 5 MB.'); return;
    }
    setProofState('uploading'); setProofMessage('');
    const safeName = `${Date.now()}-${proofFile.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)}`;
    const path = `${userId}/${placedOrder.code}/${safeName}`;
    try {
      const { error: uploadError } = await supabase.storage.from('payment-proofs').upload(path, proofFile, { contentType: proofFile.type, upsert: false });
      if (uploadError) throw uploadError;
      const { error: submitError } = await supabase.rpc('submit_payment_proof', { p_order_id: placedOrder.id, p_proof_path: path });
      if (submitError) { await supabase.storage.from('payment-proofs').remove([path]); throw submitError; }
      setProofState('submitted'); setProofMessage('Bukti berhasil dikirim. Admin akan memeriksa pembayaran secara manual.');
    } catch (e) {
      setProofState('error'); setProofMessage(e instanceof Error ? e.message : 'Bukti belum berhasil dikirim. Coba lagi.');
    }
  };
  return (
    <div className="glass rounded-2xl p-8 text-center animate-scale-in max-w-xl mx-auto">
      <div
        className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${
          placedOrder.status === 'success' ? 'bg-emerald-500/15' : 'bg-amber-500/15'
        }`}
      >
        {placedOrder.status === 'success' ? (
          <Check className="w-8 h-8 text-emerald-400" />
        ) : (
          <Wallet className="w-8 h-8 text-amber-400" />
        )}
      </div>
      <h2 className="font-display text-2xl font-bold">
        {placedOrder.status === 'success' ? 'Transaksi Berhasil!' : 'Menunggu Pembayaran…'}
      </h2>
      <p className="text-slate-400 text-sm mt-2" aria-live="polite">
        {placedOrder.status === 'success'
          ? `Status pesanan ${brandName} ${packageName} telah ditandai berhasil oleh admin untuk ${target}.`
          : 'Selesaikan pembayaran dengan nominal yang tepat, lalu konfirmasi ke admin melalui WhatsApp.'}
      </p>

      <div className="mt-5 glass-soft rounded-xl p-4 text-left text-sm">
        <div className="flex items-center gap-2 text-slate-400">
          <Hash className="w-4 h-4" /> Kode Order
        </div>
        <div className="font-display font-bold text-lg text-amber-300">{placedOrder.code}</div>
        <div className="mt-3 text-xs text-slate-400">Tujuan</div>
        <div className="font-mono text-sm break-all">{target}</div>
        {server && <><div className="mt-2 text-xs text-slate-400">Server</div><div className="font-mono text-sm">{server}</div></>}
        <div className="mt-3 text-xs text-slate-400">Status</div>
        <div
          className={`font-medium ${
            placedOrder.status === 'success' ? 'text-emerald-400' : 'text-amber-300'
          }`}
        >
          {statusLabel(placedOrder.status as 'pending' | 'processing' | 'success' | 'failed')}
        </div>
        <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3">
          <div className="text-xs text-slate-400">Total yang harus dibayar</div>
          <div className="font-display text-2xl font-bold text-amber-200 mt-1">{formatPrice(placedOrder.totalAmount)}</div>
        </div>

        {method && !method.maintenance && (
          <>
            <div className="h-px bg-white/5 my-4" />
            <div className="text-xs text-slate-400 mb-1">Instruksi Pembayaran</div>
            <div className="text-sm font-medium">{method.name}</div>
            {method.id === 'qris' ? (
              <>
                <p className="text-xs text-slate-400 mt-1.5">
                  Pindai QRIS dengan aplikasi pembayaran, lalu masukkan nominal persis seperti total di atas. Setelah membayar, kirim konfirmasi beserta kode order ke admin.
                </p>
                <a href="/qris-cahyo-store.png" target="_blank" rel="noreferrer" className="mt-4 block rounded-xl bg-white p-3 max-w-sm mx-auto">
                  <img src="/qris-cahyo-store.png" alt="QRIS Cahyo Store, Pulsa & Tagihan" className="w-full h-auto object-contain" />
                </a>
                <p className="text-[11px] text-slate-500 mt-2">Bila aplikasi pembayaran dan QRIS dibuka di ponsel yang sama, simpan gambar atau buka gambar ini pada perangkat lain untuk memindainya.</p>
              </>
            ) : (
              <>
                <p className="text-xs text-slate-400 mt-1.5">
                  Transfer dengan jumlah tepat (termasuk biaya dan kode unik), lalu konfirmasi via WhatsApp admin dengan kode order.
                </p>
                <div className="mt-3 space-y-2">
                  <CopyRow
                    label="No. Tujuan"
                    value={method.accountNumber}
                    copied={copied === 'num'}
                    onCopy={() => copy(method.accountNumber, 'num')}
                  />
                  <CopyRow
                    label="Atas Nama"
                    value={method.accountHolder}
                    copied={copied === 'holder'}
                    onCopy={() => copy(method.accountHolder, 'holder')}
                  />
                </div>
              </>
            )}
            <div className="mt-3 space-y-2">
              <CopyRow
                label="Total pembayaran"
                value={String(placedOrder.totalAmount)}
                copied={copied === 'amount'}
                onCopy={() => copy(String(placedOrder.totalAmount), 'amount')}
              />
              <CopyRow
                label="Kode Order (berita)"
                value={placedOrder.code}
                copied={copied === 'code'}
                onCopy={() => copy(placedOrder.code, 'code')}
              />
            </div>
            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left">
              <div className="flex items-center gap-2 font-medium text-sm"><FileImage className="w-4 h-4 text-cyan-300" /> Kirim bukti pembayaran (opsional)</div>
              <p className="text-xs text-slate-400 mt-1">JPG, PNG, atau WebP maksimal 5 MB. Jangan unggah gambar yang memuat PIN, kata sandi, atau data rahasia.</p>
              <input aria-label="File bukti pembayaran" type="file" accept="image/jpeg,image/png,image/webp" disabled={proofState === 'uploading' || proofState === 'submitted'} onChange={(e) => { setProofFile(e.target.files?.[0] ?? null); setProofState('idle'); setProofMessage(''); }} className="mt-3 block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-slate-100" />
              <button type="button" onClick={() => void submitProof()} disabled={!proofFile || proofState === 'uploading' || proofState === 'submitted'} className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-500/15 border border-cyan-400/30 px-4 py-2 text-sm text-cyan-200 disabled:opacity-50">
                {proofState === 'uploading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}{proofState === 'submitted' ? 'Bukti Terkirim' : proofState === 'uploading' ? 'Mengunggah…' : 'Kirim Bukti'}
              </button>
              {proofMessage && <p role={proofState === 'error' ? 'alert' : 'status'} className={`mt-2 text-xs ${proofState === 'error' ? 'text-rose-300' : 'text-emerald-300'}`}>{proofMessage}</p>}
            </div>
            <p className="text-[11px] text-slate-500 mt-3">
              Bukti pembayaran tidak otomatis menandai pesanan lunas. Admin wajib memverifikasi dana yang benar-benar diterima.
            </p>
            <a
              href={`${STORE_CONTACT.whatsappLink}?text=${encodeURIComponent(
                `Halo admin, saya ingin konfirmasi pembayaran order ${placedOrder.code}`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/25 transition"
            >
              <MessageCircle className="w-4 h-4" /> Konfirmasi via WhatsApp
            </a>
          </>
        )}
      </div>

      {error && <p role="alert" className="text-rose-300 text-xs mt-4">{error}</p>}

      <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
        <button onClick={() => navigate('/dashboard')} className="btn-ghost px-5 py-2.5 rounded-lg text-sm">
          Lihat Riwayat
        </button>
        <button onClick={reset} className="btn-primary px-5 py-2.5 rounded-lg text-sm">
          Top-Up Lagi
        </button>
      </div>
    </div>
  );
}

function CopyRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white/5">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
        <div className="font-mono text-sm text-slate-200 truncate">{value}</div>
      </div>
      <button
        onClick={onCopy}
        className="btn-ghost px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 shrink-0"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? 'Tersalin' : 'Salin'}
      </button>
    </div>
  );
}
