/**
 * Allow only app hash-routes or credential-free HTTPS links for promo CTAs.
 * Never pass arbitrary schemes (for example javascript: or data:) to window.open.
 */
export function parsePromoDestination(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw || raw.length > 2048 || /[\u0000-\u001f\u007f]/.test(raw)) return null;

  if (raw.startsWith('#/')) {
    if (raw.includes('\\')) return null;
    return { type: 'internal', href: raw.slice(1) };
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return null;
  return { type: 'external', href: parsed.href };
}
