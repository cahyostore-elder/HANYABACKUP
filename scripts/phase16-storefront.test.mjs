import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const home = readFileSync(new URL('../src/pages/HomePage.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('hero provides primary top-up and order-status navigation', () => {
  assert.match(home, /Mulai Top-Up/);
  assert.match(home, /Cek Status Pesanan/);
  assert.match(home, /navigate\('\/order-status'\)/);
});

test('hero service shortcuts route to game, pulsa, and PLN pages', () => {
  assert.match(home, /aria-label="Pilih layanan top-up game"/);
  assert.match(home, /aria-label="Pilih layanan pulsa dan paket data"/);
  assert.match(home, /aria-label="Pilih layanan token listrik PLN"/);
  assert.match(home, /navigate\('\/topup\/pln'\)/);
});

test('storefront stats are data-driven and do not claim hard-coded payment counts', () => {
  assert.match(home, /String\(gameBrands\.length\)/);
  assert.match(home, /String\(pulsaBrands\.length\)/);
  assert.match(home, /supabaseConfigured/);
  assert.doesNotMatch(home, /Metode Bayar Aktif/);
});

test('catalog category and operator sections have loading and empty states', () => {
  assert.match(home, /category-skeleton-/);
  assert.match(home, /Kategori belum tersedia/);
  assert.match(home, /operator-skeleton-/);
  assert.match(home, /Operator belum tersedia/);
});

test('hero and stats have responsive and reduced-motion styling', () => {
  assert.match(css, /\.storefront-hero-panel\s*\{/);
  assert.match(css, /\.storefront-quick-link\s*\{/);
  assert.match(css, /\.storefront-stat-card\s*\{/);
  assert.match(css, /@media \(max-width: 639px\)[\s\S]*?\.storefront-hero-panel/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.storefront-quick-link, \.storefront-stat-card/);
});

test('Phase 16 audit is registered without introducing dependencies', () => {
  assert.equal(pkg.scripts['audit:phase16'], 'node --test scripts/phase16-storefront.test.mjs');
  assert.equal(pkg.dependencies.react, '^18.3.1');
  assert.equal(pkg.dependencies['lucide-react'], '^0.446.0');
});
