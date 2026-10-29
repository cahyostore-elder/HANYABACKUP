import { Mail, MessageCircle, Send } from 'lucide-react';
import { useRoute } from '@/lib/router';
import { STORE_CONTACT } from '@/lib/contact';

export default function Footer() {
  const { navigate } = useRoute();
  return (
    <footer className="relative mt-24 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-4 gap-10">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl bg-[#070b16] border border-cyan-300/30 flex items-center justify-center overflow-hidden">
                <img src="/icons/fityora-icon.svg" alt="" aria-hidden="true" width="36" height="36" className="w-full h-full object-contain" loading="lazy" />
              </div>
              <div className="font-display text-lg font-bold">
                Fityora<span className="text-gradient-gold">Store</span>
              </div>
            </div>
            <p className="text-slate-400 text-sm max-w-md leading-relaxed">
              Platform top-up untuk game, pulsa semua operator, dan token PLN. Rincian pembayaran ditampilkan sebelum checkout dan konfirmasi dapat dikirim ke admin.
            </p>
            <div className="flex items-center gap-3 mt-5">
              <a href={STORE_CONTACT.whatsappLink} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-lg glass-soft flex items-center justify-center text-slate-300 hover:text-emerald-300 hover:border-emerald-400/40 transition" aria-label="WhatsApp" title={`WhatsApp ${STORE_CONTACT.whatsappDisplay}`}>
                <MessageCircle className="w-4 h-4" />
              </a>
              <a href={STORE_CONTACT.telegramLink} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-lg glass-soft flex items-center justify-center text-slate-300 hover:text-cyan-300 hover:border-cyan-400/40 transition" aria-label="Telegram" title={`Telegram @${STORE_CONTACT.telegramUsername}`}>
                <Send className="w-4 h-4" />
              </a>
              <a href={`mailto:${STORE_CONTACT.email}`} className="w-9 h-9 rounded-lg glass-soft flex items-center justify-center text-slate-300 hover:text-amber-300 hover:border-amber-400/40 transition" aria-label="Email" title={STORE_CONTACT.email}>
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-display font-semibold mb-4 text-sm uppercase tracking-wider text-slate-300">
              Layanan
            </h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><button onClick={() => navigate('/topup/game')} className="hover:text-amber-300 transition">Top-Up Game</button></li>
              <li><button onClick={() => navigate('/topup/pulsa')} className="hover:text-amber-300 transition">Pulsa & Paket Data</button></li>
              <li><button onClick={() => navigate('/topup/pln')} className="hover:text-amber-300 transition">Token PLN</button></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-semibold mb-4 text-sm uppercase tracking-wider text-slate-300">
              Bantuan
            </h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <a href={`mailto:${STORE_CONTACT.email}`} className="flex items-center gap-2 hover:text-amber-300 transition">
                  <Mail className="w-4 h-4" /> {STORE_CONTACT.email}
                </a>
              </li>
              <li>
                <a href={STORE_CONTACT.whatsappLink} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-emerald-300 transition">
                  <MessageCircle className="w-4 h-4" /> WhatsApp {STORE_CONTACT.whatsappDisplay}
                </a>
              </li>
              <li>
                <a href={STORE_CONTACT.telegramLink} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-cyan-300 transition">
                  <Send className="w-4 h-4" /> Telegram @{STORE_CONTACT.telegramUsername}
                </a>
              </li>
              <li><a href={`mailto:${STORE_CONTACT.email}`} className="hover:text-amber-300 transition">Hubungi Admin</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} FityoraStore. Top-up digital untuk Indonesia.</p>
          <p>Rincian jelas • Konfirmasi WhatsApp • Status pesanan</p>
        </div>
      </div>
    </footer>
  );
}
