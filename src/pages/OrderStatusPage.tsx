import { useRef, useState } from 'react';
import { ArrowLeft, Search, Hash, Loader2, Package as PackageIcon, Wallet, Calendar, MessageCircle, RefreshCw } from 'lucide-react';
import { supabase, type OrderLookup } from '@/lib/supabase';
import { useRoute } from '@/lib/router';
import { formatPrice, statusLabel } from '@/lib/format';
import { STORE_CONTACT } from '@/lib/contact';

type Result =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'notfound' }
  | { kind: 'error'; message: string }
  | { kind: 'found'; order: OrderLookup };

const STATUS_STYLES: Record<string, { dot: string; text: string; bg: string }> = {
  pending: { dot: 'bg-amber-400', text: 'text-amber-300', bg: 'bg-amber-500/15 border-amber-400/30' },
  processing: { dot: 'bg-cyan-400', text: 'text-cyan-300', bg: 'bg-cyan-500/15 border-cyan-400/30' },
  success: { dot: 'bg-emerald-400', text: 'text-emerald-300', bg: 'bg-emerald-500/15 border-emerald-400/30' },
  failed: { dot: 'bg-rose-400', text: 'text-rose-300', bg: 'bg-rose-500/15 border-rose-400/30' },
};

export default function OrderStatusPage() {
  const { navigate } = useRoute();
  const [code, setCode] = useState('');
  const [result, setResult] = useState<Result>({ kind: 'idle' });
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const checkingLock = useRef(false);

  const lookup = async (requestedCode = code) => {
    const trimmed = requestedCode.trim().toUpperCase();
    if (!trimmed || checkingLock.current) return;
    if (trimmed.length < 4 || !/^[A-Z0-9-]+$/.test(trimmed)) {
      setResult({ kind: 'error', message: 'Format kode order tidak valid. Gunakan kode order dari halaman checkout.' });
      return;
    }
    const keepShowingFoundOrder = result.kind === 'found';
    if (!keepShowingFoundOrder) setResult({ kind: 'loading' });
    setLookupError('');
    checkingLock.current = true;
    setIsChecking(true);
    try {
      const { data, error } = await supabase.rpc('lookup_order', { code: trimmed });
      if (error) {
        const message = 'Status order belum dapat diperiksa. Coba lagi beberapa saat.';
        if (keepShowingFoundOrder) setLookupError(message);
        else setResult({ kind: 'error', message });
        return;
      }
      if (!data || (Array.isArray(data) && data.length === 0)) {
        setLookupError('');
        setResult({ kind: 'notfound' });
        return;
      }
      const order = Array.isArray(data) ? data[0] : data;
      if (!order?.o_code) {
        setLookupError('');
        setResult({ kind: 'notfound' });
        return;
      }
      setLookupError('');
      setResult({ kind: 'found', order });
      setLastChecked(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    } catch {
      const message = 'Koneksi bermasalah. Periksa internet lalu coba lagi.';
      if (keepShowingFoundOrder) setLookupError(message);
      else setResult({ kind: 'error', message });
    } finally {
      checkingLock.current = false;
      setIsChecking(false);
    }
  };

  const status = result.kind === 'found' ? STATUS_STYLES[result.order.o_status] ?? STATUS_STYLES.pending : null;

  return (
    <div className="pt-24 max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-amber-300 transition mb-5"
      >
        <ArrowLeft className="w-4 h-4" /> Beranda
      </button>

      <div className="text-center mb-8">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center mb-4">
          <Search className="w-7 h-7 text-amber-400" />
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold">Cek Status Order</h1>
        <p className="text-slate-400 text-sm mt-2 max-w-md mx-auto">
          Masukkan kode order yang diterima setelah checkout untuk melihat status transaksi terbaru.
        </p>
      </div>

      <div className="glass rounded-2xl p-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={code}
              disabled={isChecking}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setLookupError(''); if (result.kind !== 'idle') setResult({ kind: 'idle' }); }}
              onKeyDown={(e) => e.key === 'Enter' && lookup()}
              aria-label="Kode order"
              aria-describedby="order-code-help"
              autoComplete="off"
              placeholder="Kode order (FS…)"
              className="w-full pl-10 pr-4 py-3 rounded-xl glass-soft text-sm font-mono uppercase tracking-wider focus:outline-none focus:border-amber-400/40"
            />
            <p id="order-code-help" className="sr-only">Masukkan kode order dengan huruf, angka, atau tanda hubung.</p>
          </div>
          <button
            onClick={() => void lookup()}
            disabled={isChecking || result.kind === 'loading' || !code.trim()}
            className="btn-primary px-5 py-3 rounded-xl text-sm flex items-center gap-2 justify-center disabled:opacity-50"
          >
            {isChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Cek
          </button>
        </div>

        {result.kind === 'notfound' && (
          <div className="mt-5 rounded-xl bg-rose-500/10 border border-rose-400/30 p-4 text-sm text-rose-200 text-center animate-fade-in">
            Order dengan kode <span className="font-mono font-semibold">{code.trim().toUpperCase()}</span> tidak ditemukan. Periksa kembali kode order kamu.
          </div>
        )}
        {result.kind === 'error' && (
          <div role="alert" className="mt-5 rounded-xl bg-amber-500/10 border border-amber-400/30 p-4 text-sm text-amber-100 text-center animate-fade-in">
            {result.message}
          </div>
        )}

        {result.kind === 'found' && status && (
          <div className="mt-6 animate-scale-in">
            <div className={`rounded-xl border p-4 ${status.bg}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">Kode Order</div>
                  <div className="font-display font-bold text-lg font-mono">{result.order.o_code}</div>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${status.bg} ${status.text} text-sm font-medium`}>
                  <span className={`w-2 h-2 rounded-full ${status.dot} ${result.order.o_status === 'processing' ? 'animate-pulse' : ''}`} />
                  {statusLabel(result.order.o_status as 'pending' | 'processing' | 'success' | 'failed')}
                </div>
              </div>
            </div>

            {lookupError && <p role="status" className="mt-3 rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">{lookupError} Data status terakhir tetap ditampilkan; periksa ulang koneksi sebelum mengambil keputusan.</p>}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
              <span role="status">{lastChecked ? `Diperiksa pukul ${lastChecked}` : 'Status berhasil dimuat'}</span>
              <button type="button" onClick={() => void lookup(result.order.o_code)} disabled={isChecking} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 hover:border-amber-400/40 hover:text-amber-200 disabled:opacity-50">
                <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} /> Perbarui status
              </button>
            </div>
            <p className="mt-3 text-sm text-slate-300">{result.order.o_status === 'pending' ? 'Pesanan menunggu konfirmasi pembayaran. Status ini belum berarti transaksi berhasil.' : result.order.o_status === 'processing' ? 'Pesanan sedang diproses. Tunggu pembaruan status sebelum menganggap transaksi selesai.' : result.order.o_status === 'success' ? 'Pesanan telah ditandai berhasil. Jika produk belum diterima, hubungi admin.' : 'Pesanan ditandai gagal. Hubungi admin untuk pemeriksaan lebih lanjut.'}</p>

            <div className="mt-4 grid sm:grid-cols-2 gap-3">
              <DetailRow icon={PackageIcon} label="Produk" value={`${result.order.o_brand_name} — ${result.order.o_package_name}`} />
              <DetailRow icon={Hash} label="Tujuan" value={result.order.o_target} />
              <DetailRow icon={Wallet} label="Total Pembayaran" value={formatPrice(Number(result.order.o_total_amount) || 0)} />
              <DetailRow icon={Calendar} label="Waktu Order" value={new Date(result.order.o_created_at).toLocaleString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
            </div>

            {result.order.o_status !== 'success' && (
              <a
                href={`${STORE_CONTACT.whatsappLink}?text=${encodeURIComponent(
                  `Halo admin, saya ingin menanyakan status order ${result.order.o_code}`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/25 transition"
              >
                <MessageCircle className="w-4 h-4" /> Tanya admin via WhatsApp
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof Hash; label: string; value: string }) {
  return (
    <div className="glass-soft rounded-xl p-3.5">
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="text-sm text-slate-100 mt-1 font-medium break-words">{value}</div>
    </div>
  );
}
