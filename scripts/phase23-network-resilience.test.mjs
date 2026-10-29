import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const home = readFileSync(new URL('../src/pages/HomePage.tsx', import.meta.url), 'utf8');
const topup = readFileSync(new URL('../src/pages/TopupPage.tsx', import.meta.url), 'utf8');

test('home catalog requests have bounded network timeouts', () => {
  assert.match(home, /topup_categories[\s\S]*?AbortSignal\.timeout\(12000\)/);
  assert.match(home, /gameCategory\.id\)[\s\S]*?AbortSignal\.timeout\(12000\)/);
  assert.match(home, /pulsaCategory\.id\)[\s\S]*?AbortSignal\.timeout\(12000\)/);
});

test('top-up category, brand and package queries have bounded timeouts', () => {
  assert.equal((topup.match(/AbortSignal\.timeout\(12000\)/g) ?? []).length >= 3, true);
});

test('timeout failures show actionable messages and keep retry flow available', () => {
  assert.match(home, /Koneksi katalog terlalu lama merespons/);
  assert.match(topup, /Koneksi katalog terlalu lama merespons/);
  assert.match(topup, /Pemuatan nominal terlalu lama/);
  assert.match(home, /setCatalogAttempt\(\(attempt\) => attempt \+ 1\)/);
});

test('network error handling does not print credentials or raw error details', () => {
  assert.doesNotMatch(home, /console\.log\(.*(?:key|token|secret)/i);
  assert.doesNotMatch(topup, /console\.log\(.*(?:key|token|secret)/i);
});
