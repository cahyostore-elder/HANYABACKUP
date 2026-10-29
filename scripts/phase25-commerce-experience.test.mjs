import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const report = readFileSync(new URL('../PHASE25_COMMERCE_EXPERIENCE_REPORT.md', import.meta.url), 'utf8');

test('Phase 25 defines a reusable loading placeholder and reduced-motion behavior', () => {
  assert.match(css, /\.ui-skeleton/);
  assert.match(css, /@keyframes ui-skeleton-wave/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test('Phase 25 keeps responsive catalog density and touch-friendly controls', () => {
  assert.match(css, /max-width:\s*639px/);
  assert.match(css, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /\.btn-primary,\s*\.btn-ghost\s*\{\s*min-height:\s*2\.75rem/);
});

test('Phase 25 aligns browser theme color and documents dependency restraint', () => {
  assert.match(html, /name="theme-color" content="#070914"/);
  assert.match(report, /No new dependency was added/);
});
