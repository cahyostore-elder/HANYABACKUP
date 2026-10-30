import { useEffect, useState } from 'react';
import { Zap, Home, LayoutDashboard, LogIn, LogOut, User, Menu, X, Receipt, Search, Shield } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRoute } from '@/lib/router';
import { initials, avatarGradient } from '@/lib/format';

export default function Navbar() {
  const { profile, signOut } = useAuth();
  const { path, navigate } = useRoute();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setMobileOpen(false), [path]);

  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileOpen]);

  const isActive = (p: string) => (p === '/' ? path === '/' : path.startsWith(p));

  const navItems = [
    { label: 'Beranda', to: '/', icon: Home },
    { label: 'Top-Up Game', to: '/topup/game', icon: Zap },
    { label: 'Pulsa', to: '/topup/pulsa', icon: Receipt },
  ];

  const go = (to: string) => navigate(to);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? 'glass shadow-2xl shadow-black/40' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <button onClick={() => go('/')} className="flex items-center gap-2 group">
            <div className="relative w-9 h-9 rounded-xl bg-[#070b16] border border-cyan-300/30 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform overflow-hidden">
              <img src="/icons/fityora-icon.svg" alt="" aria-hidden="true" width="36" height="36" className="w-full h-full object-contain" />
              <div className="absolute -inset-1 rounded-xl bg-cyan-400/20 blur-md -z-10 animate-pulse-glow" />
            </div>
            <div className="font-display text-lg font-bold tracking-tight">
              Fityora<span className="text-gradient-gold">Store</span>
            </div>
          </button>

          {/* Desktop nav */}
          <nav aria-label="Navigasi utama" className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.to}
                  type="button"
                  aria-current={isActive(item.to) ? "page" : undefined}
                  onClick={() => go(item.to)}
                  className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                    isActive(item.to)
                      ? 'text-amber-300 bg-amber-500/10'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
            <button
              onClick={() => go('/topup/pln')}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive('/topup/pln') ? 'text-emerald-300 bg-emerald-500/10' : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              Token PLN
            </button>
            <button
              onClick={() => go('/order-status')}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                isActive('/order-status') ? 'text-amber-300 bg-amber-500/10' : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Search className="w-4 h-4" /> Cek Order
            </button>
            {(profile?.role === 'admin' || profile?.role === 'author') && (
              <button
                onClick={() => go('/admin')}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                  isActive('/admin') ? 'text-amber-300 bg-amber-500/10' : 'text-rose-300 hover:text-rose-200 hover:bg-rose-500/10'
                }`}
              >
                <Shield className="w-4 h-4" /> Admin
              </button>
            )}
          </nav>

          {/* Right */}
          <div className="hidden lg:flex items-center gap-2">
            {profile ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => go('/dashboard')}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: avatarGradient(profile.id) }}
                  >
                    {initials(profile.display_name || 'User')}
                  </div>
                  <span className="text-sm text-slate-200 max-w-[110px] truncate">
                    {profile.display_name || 'Member'}
                  </span>
                </button>
                <button onClick={signOut} className="btn-ghost p-2 rounded-lg" title="Keluar">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => go('/login')}
                  className="btn-ghost px-4 py-2 rounded-lg text-sm flex items-center gap-2"
                >
                  <LogIn className="w-4 h-4" /> Masuk
                </button>
                <button
                  onClick={() => go('/signup')}
                  className="btn-primary px-4 py-2 rounded-lg text-sm flex items-center gap-2"
                >
                  <User className="w-4 h-4" /> Daftar
                </button>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="lg:hidden p-2 rounded-lg hover:bg-white/5"
            aria-label="Menu"
            aria-expanded={mobileOpen}
            aria-controls="fityora-mobile-navigation"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <nav id="fityora-mobile-navigation" aria-label="Navigasi mobile" className="lg:hidden glass border-t border-white/5 animate-fade-in">
          <div className="px-4 py-4 space-y-1">
            <button
              onClick={() => go('/')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
                isActive('/') ? 'text-amber-300 bg-amber-500/10' : 'text-slate-200 hover:bg-white/5'
              }`}
            >
              <Home className="w-4 h-4" /> Beranda
            </button>
            <button
              onClick={() => go('/topup/game')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
                isActive('/topup/game') ? 'text-amber-300 bg-amber-500/10' : 'text-slate-200 hover:bg-white/5'
              }`}
            >
              <Zap className="w-4 h-4" /> Top-Up Game
            </button>
            <button
              onClick={() => go('/topup/pulsa')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
                isActive('/topup/pulsa') ? 'text-cyan-300 bg-cyan-500/10' : 'text-slate-200 hover:bg-white/5'
              }`}
            >
              <Receipt className="w-4 h-4" /> Pulsa & Paket Data
            </button>
            <button
              onClick={() => go('/topup/pln')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
                isActive('/topup/pln') ? 'text-emerald-300 bg-emerald-500/10' : 'text-slate-200 hover:bg-white/5'
              }`}
            >
              <Zap className="w-4 h-4" /> Token PLN
            </button>
            <button
              onClick={() => go('/order-status')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
                isActive('/order-status') ? 'text-amber-300 bg-amber-500/10' : 'text-slate-200 hover:bg-white/5'
              }`}
            >
              <Search className="w-4 h-4" /> Cek Status Order
            </button>
            {(profile?.role === 'admin' || profile?.role === 'author') && (
              <button
                onClick={() => go('/admin')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
                  isActive('/admin') ? 'text-amber-300 bg-amber-500/10' : 'text-rose-300 hover:bg-rose-500/10'
                }`}
              >
                <Shield className="w-4 h-4" /> Dashboard Admin
              </button>
            )}
            <div className="h-px bg-white/5 my-2" />
            {profile ? (
              <>
                <button
                  onClick={() => go('/dashboard')}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-slate-200 hover:bg-white/5"
                >
                  <LayoutDashboard className="w-4 h-4" /> Dashboard Saya
                </button>
                <button
                  onClick={signOut}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-rose-300 hover:bg-rose-500/10"
                >
                  <LogOut className="w-4 h-4" /> Keluar
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => go('/login')}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-slate-200 hover:bg-white/5"
                >
                  <LogIn className="w-4 h-4" /> Masuk
                </button>
                <button
                  onClick={() => go('/signup')}
                  className="w-full btn-primary px-4 py-3 rounded-lg text-sm flex items-center justify-center gap-2"
                >
                  <User className="w-4 h-4" /> Daftar
                </button>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
