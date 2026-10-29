import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

/** Prevent a single uncaught React render error from leaving the entire app as a blank screen. */
class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep diagnostic detail in the browser console without exposing it to customers.
    console.error('[FITYORA] Kesalahan tampilan aplikasi:', error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="min-h-screen flex items-center justify-center bg-[#070914] px-5 py-12 text-slate-100">
          <section className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/80 p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-400/10 text-rose-300" aria-hidden="true">!</div>
            <h1 className="text-xl font-semibold">Halaman mengalami kendala</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">Tampilan tidak dapat dimuat dengan benar. Coba muat ulang halaman. Jika masalah terus terjadi, hubungi admin toko.</p>
            <button type="button" onClick={() => window.location.reload()} className="btn-primary mt-5 rounded-xl px-5 py-3">Muat Ulang Halaman</button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Elemen root aplikasi tidak ditemukan.');

createRoot(rootElement).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>
);
