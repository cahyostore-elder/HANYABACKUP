import { AuthProvider } from '@/context/AuthContext';
import AnimatedBackground from '@/components/AnimatedBackground';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import HomePage from '@/pages/HomePage';
import TopupPage from '@/pages/TopupPage';
import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';
import DashboardPage from '@/pages/DashboardPage';
import AdminPage from '@/pages/AdminPage';
import OrderStatusPage from '@/pages/OrderStatusPage';
import { useRoute, parseRoute } from '@/lib/router';
import { useEffect, useState } from 'react';
import { Wrench } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { supabaseConfigured } from '@/lib/supabase';

function Routes() {
  const { path } = useRoute();
  const route = parseRoute(path);

  switch (route.name) {
    case 'home':
      return <HomePage />;
    case 'topup':
      return <TopupPage category={route.params.category || 'game'} />;
    case 'login':
      return <LoginPage />;
    case 'signup':
      return <SignupPage />;
    case 'dashboard':
      return <DashboardPage />;
    case 'admin':
      return <AdminPage />;
    case 'order-status':
      return <OrderStatusPage />;
    default:
      return <HomePage />;
  }
}

function Shell() {
  const { path } = useRoute();
  const route = parseRoute(path);
  const [maintenance, setMaintenance] = useState<{ enabled: boolean; message: string } | null>(null);

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let refreshTimer: number | undefined;
    let unavailableLogged = false;
    const loadMaintenance = async () => {
      const { data, error } = await supabase.from('site_settings').select('maintenance_enabled, maintenance_message').eq('id', true).maybeSingle();
      if (!active) return;
      // Fail open when the optional maintenance table is missing. Do not keep polling a broken
      // endpoint or spam the console; refresh the page after applying the Phase 44 migration.
      if (error) {
        if (!unavailableLogged) console.warn('Global maintenance is unavailable until the Phase 44 Supabase migration is applied.', error.message);
        unavailableLogged = true;
        setMaintenance({ enabled: false, message: '' });
        return;
      }
      setMaintenance({ enabled: Boolean(data?.maintenance_enabled), message: String(data?.maintenance_message || 'Kami sedang melakukan pemeliharaan. Silakan kembali beberapa saat lagi.') });
      if (!channel) {
        channel = supabase.channel('site-maintenance-status').on('postgres_changes', { event: '*', schema: 'public', table: 'site_settings' }, () => { void loadMaintenance(); }).subscribe();
        refreshTimer = window.setInterval(() => { void loadMaintenance(); }, 30000);
      }
    };
    void loadMaintenance();
    return () => { active = false; if (refreshTimer !== undefined) window.clearInterval(refreshTimer); if (channel) void supabase.removeChannel(channel); };
  }, []);

  if (maintenance?.enabled && route.name !== 'admin') {
    return <div className="relative min-h-screen flex items-center justify-center px-5 py-12 text-center"><AnimatedBackground /><section className="relative z-10 glass rounded-3xl p-8 sm:p-12 max-w-xl w-full"><div className="mx-auto mb-5 w-16 h-16 rounded-2xl bg-amber-400/10 border border-amber-300/20 flex items-center justify-center"><Wrench className="w-8 h-8 text-amber-300" /></div><p className="text-xs uppercase tracking-[0.24em] text-amber-300 mb-3">FITYORA TOPUP</p><h1 className="font-display text-3xl sm:text-4xl font-bold">Sedang Maintenance</h1><p className="text-slate-300 mt-4 leading-relaxed">{maintenance.message}</p><p className="text-xs text-slate-500 mt-6">Terima kasih atas pengertiannya. Silakan kunjungi kembali nanti.</p></section></div>;
  }

  return (
    <div className="relative min-h-screen flex flex-col">
      <AnimatedBackground />
      <Navbar />
      {!supabaseConfigured && (
        <div role="alert" className="mx-4 mt-3 mb-1 max-w-2xl self-center rounded-xl border border-amber-400/40 bg-slate-950/95 px-4 py-3 text-xs sm:text-sm text-amber-100 shadow-xl backdrop-blur">
          Konfigurasi Supabase belum valid atau belum diatur. Isi <code>VITE_SUPABASE_URL</code> dan <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> (nama lama <code>VITE_SUPABASE_ANON_KEY</code> tetap didukung). Gunakan hanya publishable/anon key; secret atau service-role key tidak boleh dipakai di frontend.
        </div>
      )}
      <main className="flex-1 page-transition"><Routes /></main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
