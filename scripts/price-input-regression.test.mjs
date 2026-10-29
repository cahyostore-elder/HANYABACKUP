import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRupiah } from '../src/lib/bulkPricing.mjs';

const admin = readFileSync(new URL('../src/pages/AdminPage.tsx', import.meta.url), 'utf8');

test('package price field preserves text while typing and validates only on save', () => {
  assert.match(admin, /type="text" inputMode="numeric" pattern="\[0-9\]\*"/);
  assert.match(admin, /value=\{String\(editing\.price \?\? ''\)\}/);
  assert.match(admin, /price: e\.target\.value\.replace\(\/\[\^\\d\]\/g, ''\)/);
  assert.match(admin, /const price = parseRupiah\(String\(editing\.price \?\? ''\)\.trim\(\)\)/);
  assert.match(admin, /Harga paket harus berupa angka bulat Rp0–Rp99\.999\.999/);
});

test('price parser covers common mobile input edge cases', () => {
  assert.equal(parseRupiah('15000'), 15000);
  assert.equal(parseRupiah('150000'), 150000);
  assert.equal(parseRupiah('Rp 15.000'), 15000);
  assert.equal(parseRupiah(''), null);
  assert.equal(parseRupiah('10.5'), null);
  assert.equal(parseRupiah('-100'), null);
  assert.equal(parseRupiah('100000000'), null);
});
