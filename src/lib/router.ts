import { useEffect, useState, useCallback } from 'react';

export function useRoute() {
  const [path, setPath] = useState(() => window.location.hash.replace(/^#/, '') || '/');

  useEffect(() => {
    const onHash = () => {
      setPath(window.location.hash.replace(/^#/, '') || '/');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = useCallback((to: string) => {
    window.location.hash = to;
  }, []);

  return { path, navigate };
}

export function parseRoute(path: string): { name: string; params: Record<string, string> } {
  const clean = path.split('?')[0];
  const segments = clean.split('/').filter(Boolean);

  if (segments.length === 0) return { name: 'home', params: {} };
  if (segments[0] === 'login') return { name: 'login', params: {} };
  if (segments[0] === 'signup') return { name: 'signup', params: {} };
  if (segments[0] === 'dashboard') return { name: 'dashboard', params: {} };
  if (segments[0] === 'admin') return { name: 'admin', params: {} };
  if (segments[0] === 'order-status') return { name: 'order-status', params: {} };
  if (segments[0] === 'topup') {
    if (segments[1]) return { name: 'topup', params: { category: segments[1] } };
    return { name: 'topup', params: {} };
  }
  return { name: 'home', params: {} };
}
