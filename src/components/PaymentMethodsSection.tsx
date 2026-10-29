import { ShieldCheck, Check, MessageCircle, Wallet } from 'lucide-react';
import { PAYMENT_METHODS } from '@/lib/payment';

export default function PaymentMethodsSection() {
  const active = PAYMENT_METHODS.filter((m) => !m.maintenance);

  return (
    <div className="glass rounded-3xl p-8 sm:p-10">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs mb-3">
          <ShieldCheck className="w-3.5 h-3.5" /> Pilihan Pembayaran
        </div>
        <h2 className="font-display text-2xl sm:text-3xl font-bold">
          Metode <span className="text-gradient-gold">Pembayaran</span>
        </h2>
        <p className="text-slate-400 text-sm mt-2 max-w-md mx-auto">
          Pilih e-wallet, QRIS, atau transfer bank. Simpan kode order dan konfirmasi pembayaran ke admin.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
        {active.map((m, i) => {
          const Icon = m.icon || Wallet;
          return (
            <div
              key={m.id}
              className="glass-soft rounded-2xl p-5 flex items-center gap-4 card-hover animate-fade-up"
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${m.color}22`, border: `1px solid ${m.color}55` }}
              >
                <Icon className="w-6 h-6" style={{ color: m.color }} />
              </div>
              <div className="min-w-0">
                <div className="font-display font-semibold">{m.name}</div>
                <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-400" /> Aktif
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-400">
        <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Status pesanan tersimpan</span>
        <span className="flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5 text-emerald-400" /> Konfirmasi WhatsApp</span>
        <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" /> Total terlihat sebelum pesan</span>
      </div>
    </div>
  );
}
