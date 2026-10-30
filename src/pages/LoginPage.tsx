import { useState, type FormEvent } from 'react';
import { Mail, Lock, LogIn, Sparkles, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useRoute } from '@/lib/router';

export default function LoginPage({ maintenanceAccessOnly = false }: { maintenanceAccessOnly?: boolean }) {
  const { navigate } = useRoute();
  const { refreshProfile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError('Email dan password wajib diisi.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (authError) {
        const message = authError.message.toLowerCase();
        setError(message.includes('invalid login credentials')
          ? 'Email atau password tidak cocok.'
          : message.includes('email not confirmed')
            ? 'Email belum diverifikasi. Periksa kotak masuk email terlebih dahulu.'
            : message.includes('too many requests')
              ? 'Terlalu banyak percobaan masuk. Coba lagi beberapa saat.'
              : 'Login belum berhasil. Periksa data akun dan coba lagi.');
        return;
      }
      await refreshProfile();
      navigate('/dashboard');
    } catch {
      setError('Koneksi ke layanan akun bermasalah. Periksa internet lalu coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-24 min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 animate-fade-up">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 items-center justify-center mb-4 shadow-lg shadow-amber-500/30">
            <Sparkles className="w-7 h-7 text-slate-900" />
          </div>
          <h1 className="font-display text-3xl font-bold">
            Selamat <span className="text-gradient-gold">Datang</span>
          </h1>
          <p className="text-slate-400 mt-2 text-sm">Masuk ke akun FityoraStore kamu.</p>
        </div>

        <form onSubmit={submit} className="glass rounded-2xl p-6 space-y-4 animate-fade-up delay-100">
          <div>
            <label htmlFor="login-email" className="text-xs text-slate-400 mb-1.5 block">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                id="login-email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                autoCapitalize="none"
                disabled={loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="kamu@email.com"
                className="w-full pl-10 pr-4 py-3 rounded-xl glass-soft text-sm focus:outline-none focus:border-amber-400/40"
              />
            </div>
          </div>
          <div>
            <label htmlFor="login-password" className="text-xs text-slate-400 mb-1.5 block">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-12 py-3 rounded-xl glass-soft text-sm focus:outline-none focus:border-amber-400/40 disabled:opacity-60"
              />
              <button type="button" onClick={() => setShowPassword((visible) => !visible)} disabled={loading} aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"} aria-pressed={showPassword} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-300 disabled:opacity-40">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && <p role="alert" aria-live="polite" className="text-rose-300 text-xs">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full px-5 py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <LogIn className="w-4 h-4" /> {loading ? 'Memproses…' : 'Masuk'}
          </button>

          {maintenanceAccessOnly ? (
            <p className="text-center text-xs text-amber-200/80">Website sedang ditutup. Login hanya tersedia untuk Author/Admin.</p>
          ) : (
            <p className="text-center text-sm text-slate-400">
              Belum punya akun?{' '}
              <button type="button" onClick={() => navigate('/signup')} className="text-amber-300 hover:text-amber-200 font-medium inline-flex items-center gap-1">
                Daftar <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
