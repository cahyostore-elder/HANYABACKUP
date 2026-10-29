import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const topup = readFileSync(new URL('../src/pages/TopupPage.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('package search matches name and description with Indonesian locale handling', () => {
  assert.match(topup, /packageSearch\.trim\(\)\.toLocaleLowerCase\('id-ID'\)/);
  assert.match(topup, /\$\{item\.name\} \$\{item\.description \?\? ''\}/);
});

test('package sort supports catalog order and ascending or descending price', () => {
  assert.match(topup, /packageSort === 'price-asc'/);
  assert.match(topup, /packageSort === 'price-desc'/);
  assert.match(topup, /Number\(a\.price\) - Number\(b\.price\)/);
  assert.match(topup, /Number\(b\.price\) - Number\(a\.price\)/);
  assert.match(topup, /value="recommended"/);
});

test('changing brand resets package filters and stale checkout choices', () => {
  assert.match(topup, /setPackageSearch\(''\)/);
  assert.match(topup, /setPackageSort\('recommended'\)/);
  assert.match(topup, /setSelectedMethod\(null\)/);
  assert.match(topup, /setSelectedPackage\(null\)/);
});

test('package cards expose accessible selection state and a readable label', () => {
  assert.match(topup, /aria-pressed=\{selected\}/);
  assert.match(topup, /aria-label=\{Number\(p\.price\) > 0 \? `Pilih \$\{p\.name\}, harga \$\{formatPrice\(Number\(p\.price\)\)\}/);
  assert.match(topup, /package-card--selected/);
});

test('prices remain derived from the package catalog and use IDR formatting', () => {
  assert.match(topup, /formatPrice\(Number\(p\.price\)\)/);
  assert.match(topup, /setPackages\(\(data as Package\[\]\) \?\? \[\]\)/);
  assert.doesNotMatch(topup, /const\s+fakePackages\s*=|mockPackagePrice/);
});

test('empty search has a recovery action to restore all packages', () => {
  assert.match(topup, /Nominal tidak ditemukan/);
  assert.match(topup, /Tampilkan semua nominal/);
  assert.match(topup, /onClick=\{\(\) => setPackageSearch\(''\)\}/);
});

test('package selection styling is responsive and respects reduced motion', () => {
  assert.match(css, /\.package-card\s*\{/);
  assert.match(css, /\.package-card:focus-visible/);
  assert.match(css, /@media \(max-width: 420px\)[\s\S]*?\.package-card/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.package-pick-indicator/);
});

test('Phase 17 audit is registered without adding runtime dependencies', () => {
  assert.equal(pkg.scripts['audit:phase17'], 'node --test scripts/phase17-catalog.test.mjs scripts/phase17-package-catalog.test.mjs');
  assert.equal(pkg.dependencies.react, '^18.3.1');
  assert.equal(pkg.dependencies['@supabase/supabase-js'], '^2.57.4');
});
