import { useState, type FormEvent } from 'react';
import { Mail, Lock, User as UserIcon, UserPlus, Sparkles, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useRoute } from '@/lib/router';

export default function SignupPage() {
  const { navigate } = useRoute();
  const { refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const cleanName = displayName.trim();
    const cleanEmail = email.trim().toLowerCase();
    setError('');
    setSuccess('');
    if (!cleanName || cleanName.length > 40) {
      setError('Nama tampilan wajib diisi dan maksimal 40 karakter.');
      return;
    }
    if (!cleanEmail || cleanEmail.length > 254) {
      setError('Masukkan alamat email yang valid (maksimal 254 karakter).');
      return;
    }
    if (password.length < 6) {
      setError('Password minimal 6 karakter.');
      return;
    }
    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: { data: { display_name: cleanName } },
      });
      if (authError) {
        const message = authError.message.toLowerCase();
        setError(message.includes('already registered') || message.includes('already been registered')
          ? 'Email tersebut sudah terdaftar. Silakan masuk menggunakan akun yang ada.'
          : message.includes('password')
            ? 'Password belum memenuhi ketentuan keamanan.'
            : message.includes('too many requests')
              ? 'Terlalu banyak permintaan pendaftaran. Coba lagi beberapa saat.'
              : 'Pendaftaran belum berhasil. Periksa data dan koneksi lalu coba lagi.');
        return;
      }
      if (data.session) {
        await refreshProfile();
        navigate('/dashboard');
        return;
      }
      setSuccess('Akun berhasil dibuat. Periksa email untuk menyelesaikan verifikasi sebelum masuk.');
    } catch {
      setError('Koneksi ke layanan akun bermasalah. Periksa internet lalu coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-24 min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 animate-fade-up">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 items-center justify-center mb-4 shadow-lg shadow-amber-500/30">
            <Sparkles className="w-7 h-7 text-slate-900" />
          </div>
          <h1 className="font-display text-3xl font-bold">
            Buat <span className="text-gradient-gold">Akun</span>
          </h1>
          <p className="text-slate-400 mt-2 text-sm">Gabung untuk mulai top-up game, pulsa, dan token PLN.</p>
        </div>

        <form onSubmit={submit} className="glass rounded-2xl p-6 space-y-4 animate-fade-up delay-100">
          <div>
            <label htmlFor="signup-name" className="text-xs text-slate-400 mb-1.5 block">Nama Tampilan</label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                id="signup-name"
                type="text"
                required
                maxLength={40}
                autoComplete="name"
                disabled={loading}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nama kamu"
                className="w-full pl-10 pr-4 py-3 rounded-xl glass-soft text-sm focus:outline-none focus:border-amber-400/40"
              />
            </div>
          </div>
          <div>
            <label htmlFor="signup-email" className="text-xs text-slate-400 mb-1.5 block">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                id="signup-email"
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
            <label htmlFor="signup-password" className="text-xs text-slate-400 mb-1.5 block">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                autoComplete="new-password"
                disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 6 karakter"
                className="w-full pl-10 pr-12 py-3 rounded-xl glass-soft text-sm focus:outline-none focus:border-amber-400/40 disabled:opacity-60"
              />
              <button type="button" onClick={() => setShowPassword((visible) => !visible)} disabled={loading} aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"} aria-pressed={showPassword} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-300 disabled:opacity-40">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && <p role="alert" aria-live="polite" className="text-rose-300 text-xs">{error}</p>}
          {success && <p role="status" aria-live="polite" className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-3 text-emerald-200 text-xs leading-relaxed">{success}</p>}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full px-5 py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <UserPlus className="w-4 h-4" /> {loading ? 'Memproses…' : 'Daftar Sekarang'}
          </button>

          <p className="text-center text-sm text-slate-400">
            Sudah punya akun?{' '}
            <button type="button" onClick={() => navigate('/login')} className="text-amber-300 hover:text-amber-200 font-medium inline-flex items-center gap-1">
              Masuk <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
