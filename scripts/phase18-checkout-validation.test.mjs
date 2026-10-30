import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const topup = readFileSync(new URL('../src/pages/TopupPage.tsx', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('phone destination validation checks 8–15 digits after permitted formatting is removed', () => {
  assert.match(topup, /categorySlug === 'pulsa'/);
  assert.match(topup, /replace\(\/\[\\s\(\)\+\-\]\/g, ''\)/);
  assert.match(topup, /\\d\{8,15\}/);
});

test('PLN destination validation accepts only 8–20 digits after spaces and hyphens', () => {
  assert.match(topup, /categorySlug === 'pln'/);
  assert.match(topup, /\\d\{8,20\}/);
});

test('destination and server validation errors are connected to inputs accessibly', () => {
  assert.match(topup, /aria-invalid=\{Boolean\(targetError\)\}/);
  assert.match(topup, /aria-describedby=\{targetError \? 'target-error' : undefined\}/);
  assert.match(topup, /aria-invalid=\{Boolean\(serverError\)\}/);
  assert.match(topup, /role="alert"/);
});

test('target and server fields have explicit maximum lengths', () => {
  assert.match(topup, /maxLength=\{100\}/);
  assert.match(topup, /maxLength=\{32\}/);
});

test('order creation uses a synchronous lock to prevent rapid duplicate submission', () => {
  assert.match(topup, /const placingLock = useRef\(false\)/);
  assert.match(topup, /if \(placingLock\.current \|\| !validateTarget\(\)/);
  assert.match(topup, /placingLock\.current = true/);
  assert.match(topup, /placingLock\.current = false/);
  assert.match(topup, /disabled=\{placing \|\| \(orderMaintenanceEnabled && !isAuthor\)\}/);
});

test('Phase 18 checkout validation audit is registered', () => {
  assert.equal(pkg.scripts['audit:phase18'], 'node --test scripts/phase18-checkout-validation.test.mjs');
});
