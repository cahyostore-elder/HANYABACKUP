import { AuthProvider, useAuth } from '@/context/AuthContext';
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
import { supabase, supabaseConfigured } from '@/lib/supabase';

function Routes({ orderMaintenanceEnabled, orderMaintenanceMessage, loginOnly }: {
  orderMaintenanceEnabled: boolean;
  orderMaintenanceMessage: string;
  loginOnly: boolean;
}) {
  const { path } = useRoute();
  const route = parseRoute(path);

  switch (route.name) {
    case 'home':
      return <HomePage />;
    case 'topup':
      return (
        <TopupPage
          category={route.params.category || 'game'}
          orderMaintenanceEnabled={orderMaintenanceEnabled}
          orderMaintenanceMessage={orderMaintenanceMessage}
        />
      );
    case 'login':
      return <LoginPage maintenanceAccessOnly={loginOnly} />;
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

type MaintenanceState = {
  globalEnabled: boolean;
  globalMessage: string;
  orderEnabled: boolean;
  orderMessage: string;
};

function Shell() {
  const { path, navigate } = useRoute();
  const route = parseRoute(path);
  const { profile } = useAuth();
  const [maintenance, setMaintenance] = useState<MaintenanceState | null>(null);

  useEffect(() => {
    let active = true;
    let unavailableLogged = false;
    const loadMaintenance = async () => {
      const { data, error } = await supabase
        .from('site_settings')
        .select('maintenance_enabled, maintenance_message, order_maintenance_enabled, order_maintenance_message')
        .eq('id', true)
        .maybeSingle();
      if (!active) return;

      // Fail closed if the maintenance state cannot be verified. PostgreSQL also
      // guards order INSERTs, so this is an additional customer-facing safeguard.
      if (error || !data) {
        if (!unavailableLogged) {
          console.warn('Maintenance state could not be verified. Customer access is restricted.', error?.message ?? 'Missing site_settings row');
        }
        unavailableLogged = true;
        setMaintenance({
          globalEnabled: true,
          globalMessage: 'Status operasional toko belum dapat diverifikasi. Silakan coba kembali nanti.',
          orderEnabled: true,
          orderMessage: 'Pemesanan sementara dihentikan karena status layanan belum dapat diverifikasi.',
        });
        return;
      }

      setMaintenance({
        globalEnabled: Boolean(data.maintenance_enabled),
        globalMessage: String(data.maintenance_message || 'Kami sedang melakukan pemeliharaan. Silakan kembali nanti.'),
        orderEnabled: Boolean(data.order_maintenance_enabled),
        orderMessage: String(data.order_maintenance_message || 'Pemesanan sedang dihentikan sementara. Silakan coba kembali nanti.'),
      });
    };
    // Keep retrying even after a read failure, so an Author can recover the app
    // by repairing settings or reopening the site without a manual page reload.
    const channel = supabase.channel('site-maintenance-status').on('postgres_changes', { event: '*', schema: 'public', table: 'site_settings' }, () => { void loadMaintenance(); }).subscribe();
    const refreshTimer = window.setInterval(() => { void loadMaintenance(); }, 30000);
    void loadMaintenance();
    return () => { active = false; window.clearInterval(refreshTimer); void supabase.removeChannel(channel); };
  }, []);

  if (!maintenance) {
    return (
      <div className="relative min-h-screen flex items-center justify-center px-5 py-12 text-center">
        <AnimatedBackground />
        <div className="relative z-10 text-sm text-slate-300" role="status">Memeriksa status layanan FityoraStore…</div>
      </div>
    );
  }

  const isAuthor = profile?.role === 'author' || profile?.role === 'admin';
  if (maintenance.globalEnabled && !isAuthor && route.name !== 'login') {
    return (
      <div className="relative min-h-screen flex items-center justify-center px-5 py-12 text-center">
        <AnimatedBackground />
        <section className="relative z-10 glass rounded-3xl p-8 sm:p-12 max-w-xl w-full">
          <div className="mx-auto mb-5 w-16 h-16 rounded-2xl bg-amber-400/10 border border-amber-300/20 flex items-center justify-center"><Wrench className="w-8 h-8 text-amber-300" /></div>
          <p className="text-xs uppercase tracking-[0.24em] text-amber-300 mb-3">FITYORA TOPUP</p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold">Website Ditutup Sementara</h1>
          <p className="text-slate-300 mt-4 leading-relaxed">{maintenance.globalMessage}</p>
          <p className="text-xs text-slate-500 mt-6">Akses website hanya tersedia bagi Author/Admin selama penutupan.</p>
          <button type="button" onClick={() => navigate('/login')} className="btn-primary mt-6 px-5 py-2.5 rounded-xl">Masuk sebagai Author</button>
        </section>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col">
      <AnimatedBackground />
      {(!maintenance.globalEnabled || isAuthor) && <Navbar />}
      {!supabaseConfigured && (
        <div role="alert" className="mx-4 mt-3 mb-1 max-w-2xl self-center rounded-xl border border-amber-400/40 bg-slate-950/95 px-4 py-3 text-xs sm:text-sm text-amber-100 shadow-xl backdrop-blur">
          Konfigurasi Supabase belum valid atau belum diatur. Isi <code>VITE_SUPABASE_URL</code> dan <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> (nama lama <code>VITE_SUPABASE_ANON_KEY</code> tetap didukung). Gunakan hanya publishable/anon key; secret atau service-role key tidak boleh dipakai di frontend.
        </div>
      )}
      <main className="flex-1 page-transition">
        <Routes
          orderMaintenanceEnabled={maintenance.orderEnabled && !isAuthor}
          orderMaintenanceMessage={maintenance.orderMessage}
          loginOnly={maintenance.globalEnabled && !isAuthor}
        />
      </main>
      {(!maintenance.globalEnabled || isAuthor) && <Footer />}
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
