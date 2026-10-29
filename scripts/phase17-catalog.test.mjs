import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const topup = readFileSync(new URL('../src/pages/TopupPage.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('package count updates with the search and remains announced accessibly', () => {
  assert.match(topup, /\{filteredPackages\.length\} dari \{packages\.length\} paket/);
  assert.match(topup, /aria-live="polite"/);
  assert.match(topup, /aria-label="Cari nominal atau deskripsi paket"/);
});

test('search reset returns the catalog after a no-results state', () => {
  assert.match(topup, /Nominal tidak ditemukan untuk/);
  assert.match(topup, /Tampilkan semua nominal/);
  assert.match(topup, /onClick=\{\(\) => setPackageSearch\(''\)\}/);
});

test('switching brand and category resets package search and sort state', () => {
  assert.match(topup, /const selectBrand = \(b: Brand\) => \{[\s\S]*?setPackageSearch\(''\)[\s\S]*?setPackageSort\('recommended'\)/);
  assert.match(topup, /useEffect\(\(\) => \{[\s\S]*?setPackageSearch\(''\)[\s\S]*?setPackageSort\('recommended'\)[\s\S]*?\}, \[categorySlug\]\)/);
});

test('nominal cards use catalog prices and accessible button labels', () => {
  assert.match(topup, /aria-pressed=\{selected\}/);
  assert.match(topup, /aria-label=\{Number\(p\.price\) > 0 \? `Pilih \$\{p\.name\}, harga \$\{formatPrice\(Number\(p\.price\)\)\}/);
  assert.match(topup, /formatPrice\(Number\(p\.price\)\)/);
});

test('Phase 17 catalog enhancements preserve mobile and reduced-motion styles', () => {
  assert.match(css, /\.package-search-panel\s*\{/);
  assert.match(css, /@media \(max-width: 420px\)[\s\S]*?\.package-card/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.package-pick-indicator/);
});

test('Phase 17 audit command includes both catalog test suites without adding dependencies', () => {
  assert.equal(pkg.scripts['audit:phase17'], 'node --test scripts/phase17-catalog.test.mjs scripts/phase17-package-catalog.test.mjs');
  assert.equal(pkg.dependencies.react, '^18.3.1');
  assert.equal(pkg.dependencies['@supabase/supabase-js'], '^2.57.4');
});
