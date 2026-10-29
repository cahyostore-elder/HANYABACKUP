import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const topup = readFileSync(new URL('../src/pages/TopupPage.tsx', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
test('checkout clearly states manual payment and admin verification', () => {
  assert.match(topup, /Pembayaran manual:/);
  assert.match(topup, /Pembayaran akan diperiksa admin/);
  assert.match(topup, /top-up tidak otomatis dikirim/);
});
test('order creation button does not imply payment was processed', () => {
  assert.match(topup, /Buat Pesanan &amp; Lihat Instruksi|Buat Pesanan & Lihat Instruksi/);
  assert.doesNotMatch(topup, /Check className="w-4 h-4" \/> Bayar Sekarang/);
});
test('checkout preview wraps long target values on narrow screens', () => {
  assert.match(topup, /max-w-\[60%\] text-right break-all font-mono/);
});
test('order confirmation status message is announced accessibly', () => {
  assert.match(topup, /aria-live="polite"/);
});
test('Phase 13 audit command is registered', () => {
  assert.equal(pkg.scripts['audit:phase13'], 'node --test scripts/phase13-checkout-ux.test.mjs');
});
