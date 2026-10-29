const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #f5b301, #f59e0b 40%, #b45309)',
  'linear-gradient(135deg, #22d3ee, #0891b2 50%, #155e75)',
  'linear-gradient(135deg, #6366f1, #4f46e5 50%, #3730a3)',
  'linear-gradient(135deg, #34d399, #059669 50%, #065f46)',
  'linear-gradient(135deg, #f472b6, #db2777 50%, #831843)',
  'linear-gradient(135deg, #fb923c, #ea580c 50%, #7c2d12)',
];

export function avatarGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash << 5) - hash + seed.charCodeAt(i);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

export function brandGradient(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = (hash << 5) - hash + slug.charCodeAt(i);
  const h = Math.abs(hash) % 360;
  return `linear-gradient(135deg, hsl(${h} 70% 55%), hsl(${(h + 40) % 360} 65% 42%))`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function formatPrice(n: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('id-ID').format(n);
}

export function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'baru saja';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} menit lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} hari lalu`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo} bulan lalu`;
  return `${Math.floor(mo / 12)} tahun lalu`;
}

export function statusLabel(s: 'pending' | 'processing' | 'success' | 'failed'): string {
  switch (s) {
    case 'pending': return 'Menunggu';
    case 'processing': return 'Diproses';
    case 'success': return 'Berhasil';
    case 'failed': return 'Gagal';
  }
}
