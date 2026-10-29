import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const home = readFileSync(new URL('../src/pages/HomePage.tsx', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('homepage includes accessible game search input', () => {
  assert.match(home, /aria-label="Cari game"/);
  assert.match(home, /value=\{gameSearch\}/);
  assert.match(home, /setGameSearch\(event\.target\.value\)/);
});
test('game list is filtered by case-insensitive brand name', () => {
  assert.match(home, /brand\.name\.toLowerCase\(\)\.includes\(gameSearch\.trim\(\)\.toLowerCase\(\)\)/);
  assert.match(home, /filteredGameBrands\.map/);
});
test('catalog failures show a retry action instead of a silent empty state', () => {
  assert.match(home, /setCatalogError\(timedOut[\s\S]*Katalog belum berhasil dimuat/);
  assert.match(home, /role="alert"/);
  assert.match(home, /setCatalogAttempt\(\(attempt\) => attempt \+ 1\)/);
});
test('empty search results have a clear recovery action', () => {
  assert.match(home, /Game tidak ditemukan/);
  assert.match(home, /setGameSearch\(''\)/);
});
test('Phase 11 UI audit command is registered', () => {
  assert.equal(pkg.scripts['audit:phase11'], 'node --test scripts/phase11-ui.test.mjs');
});
