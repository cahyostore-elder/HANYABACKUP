import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const page = readFileSync(new URL('../src/pages/TopupPage.tsx', import.meta.url), 'utf8');

test('Phase 27 styles selected payment methods clearly', () => {
  assert.match(css, /\.payment-method-card\[aria-pressed="true"\]/);
  assert.match(css, /\.payment-method-check/);
  assert.match(page, /aria-pressed=\{selected\}/);
});

test('Phase 27 preserves accessible invalid-input and alert states', () => {
  assert.match(css, /\[aria-invalid="true"\]/);
  assert.match(css, /\[role="alert"\]/);
  assert.match(page, /aria-describedby=\{targetError \? 'target-error' : undefined\}/);
});

test('Phase 27 respects reduced motion and mobile layouts', () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(max-width: 639px\)/);
});

test('Phase 27 keeps price totals legible with tabular numerals', () => {
  assert.match(css, /\.checkout-price-summary/);
  assert.match(css, /font-variant-numeric: tabular-nums/);
});
